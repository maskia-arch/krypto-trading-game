module.exports = (db) => ({
  async getLeveragePositions(profileId) {
    const { data, error } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async openPosition(profileId, symbol, direction, collateral, leverage) {
    const price = await db.getCurrentPrice(symbol);
    if (!price) throw new Error('Preis nicht verfügbar');

    const fee = (collateral * leverage) * 0.005;
    const totalCost = collateral + fee;

    const { data: profile } = await db.supabase
      .from('profiles')
      .select('balance')
      .eq('id', profileId)
      .single();

    if (Number(profile.balance) < totalCost) {
      throw new Error('Guthaben unzureichend für Marge + Gebühr');
    }

    const liqPrice = direction === 'LONG' 
      ? price * (1 - 1 / leverage) 
      : price * (1 + 1 / leverage);

    const { data: pos, error: posErr } = await db.supabase
      .from('leveraged_positions')
      .insert({
        profile_id: profileId,
        symbol: symbol.toUpperCase(),
        direction,
        leverage,
        collateral,
        entry_price: price,
        liquidation_price: liqPrice,
        status: 'OPEN'
      })
      .select()
      .single();

    if (posErr) throw posErr;

    await db.updateBalance(profileId, Number(profile.balance) - totalCost);
    
    await db.supabase.from('transactions').insert({
      profile_id: profileId,
      type: 'LEVERAGE_OPEN',
      amount_eur: -totalCost,
      symbol: symbol.toUpperCase(),
      details: `${leverage}x ${direction} @ ${price.toFixed(2)}€`
    });

    return pos;
  },

  async closePosition(positionId, profileId) {
    const { data: pos } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('id', positionId)
      .eq('profile_id', profileId)
      .eq('status', 'OPEN')
      .single();

    if (!pos) throw new Error('Position nicht gefunden');

    const currentPrice = await db.getCurrentPrice(pos.symbol);
    const entryPrice = Number(pos.entry_price);
    const collateral = Number(pos.collateral);
    const leverage = Number(pos.leverage);
    const notional = collateral * leverage;

    let pnl = 0;
    if (pos.direction === 'LONG') {
      pnl = ((currentPrice - entryPrice) / entryPrice) * notional;
    } else {
      pnl = ((entryPrice - currentPrice) / entryPrice) * notional;
    }

    let payout = collateral + pnl;
    if (payout < 0) payout = 0;

    const { error: updErr } = await db.supabase
      .from('leveraged_positions')
      .update({
        status: 'CLOSED',
        exit_price: currentPrice,
        closed_at: new Date().toISOString(),
        pnl: pnl
      })
      .eq('id', positionId);

    if (updErr) throw updErr;

    const { data: profile } = await db.supabase.from('profiles').select('balance').eq('id', profileId).single();
    await db.updateBalance(profileId, Number(profile.balance) + payout);

    await db.supabase.from('transactions').insert({
      profile_id: profileId,
      type: 'LEVERAGE_CLOSE',
      amount_eur: payout,
      symbol: pos.symbol,
      details: `PnL: ${pnl.toFixed(2)}€`
    });

    return { pnl, payout };
  },

  async checkLiquidations() {
    const { data: positions } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('status', 'OPEN');

    if (!positions || positions.length === 0) return [];

    const prices = await db.getAllPrices();
    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    const liquidated = [];

    for (const pos of positions) {
      const currentPrice = priceMap[pos.symbol];
      if (!currentPrice) continue;

      let shouldLiquidate = false;
      if (pos.direction === 'LONG' && currentPrice <= Number(pos.liquidation_price)) {
        shouldLiquidate = true;
      } else if (pos.direction === 'SHORT' && currentPrice >= Number(pos.liquidation_price)) {
        shouldLiquidate = true;
      }

      if (shouldLiquidate) {
        await db.supabase
          .from('leveraged_positions')
          .update({
            status: 'LIQUIDATED',
            exit_price: currentPrice,
            closed_at: new Date().toISOString(),
            pnl: -Number(pos.collateral)
          })
          .eq('id', pos.id);

        await db.supabase.from('transactions').insert({
          profile_id: pos.profile_id,
          type: 'LIQUIDATION',
          amount_eur: 0,
          symbol: pos.symbol,
          details: `Totalverlust bei ${currentPrice.toFixed(2)}€`
        });

        liquidated.push(pos.id);
      }
    }
    return liquidated;
  }
});
