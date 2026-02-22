module.exports = (db) => ({
  async getLeveragePositions(profileId) {
    const { data, error } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'OPEN')
      .order('entry_time', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getOpenLeveragedPositions(profileId) {
    return this.getLeveragePositions(profileId);
  },

  // v0.3.2: Alle offenen Positionen (für Scheduler, Liquidation, Auto-Close)
  async getAllOpenLeveragedPositions() {
    const { data, error } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('status', 'OPEN');
    if (error) throw error;
    return data || [];
  },

  async generateOrderId(direction) {
    const prefix = direction === 'LONG' ? 'L' : 'S';
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
  },

  async openLeveragedPosition(profileId, symbol, direction, collateral, leverage, entryPrice, options = {}) {
    const fee = (collateral * leverage) * 0.005;
    const totalCost = collateral + fee;

    const { data: profile, error: profileErr } = await db.supabase
      .from('profiles')
      .select('balance')
      .eq('id', profileId)
      .single();

    if (profileErr || !profile) throw new Error('Profil nicht gefunden');
    if (Number(profile.balance) < totalCost) throw new Error('Guthaben unzureichend');

    const liqPrice = direction === 'LONG'
      ? entryPrice * (1 - (1 / leverage) * 0.9)
      : entryPrice * (1 + (1 / leverage) * 0.9);

    const orderId = await this.generateOrderId(direction);

    const { data: pos, error: posErr } = await db.supabase
      .from('leveraged_positions')
      .insert({
        profile_id: profileId,
        order_id: orderId,
        symbol: symbol.toUpperCase(),
        direction,
        leverage,
        collateral,
        entry_price: entryPrice,
        liquidation_price: liqPrice,
        status: 'OPEN',
        stop_loss: options.stop_loss || null,
        take_profit: options.take_profit || null,
        limit_price: options.limit_price || null,
        trailing_stop: options.trailing_stop || false,
        is_limit_order: !!options.limit_price,
        entry_time: new Date().toISOString()
      })
      .select()
      .single();

    if (posErr) throw posErr;

    await db.updateBalance(profileId, Number(profile.balance) - totalCost);

    await db.supabase.from('transactions').insert({
      profile_id: profileId,
      type: 'LEVERAGE_OPEN',
      total_eur: -totalCost,
      symbol: symbol.toUpperCase(),
      details: `[${orderId}] ${leverage}x ${direction} @ ${entryPrice.toFixed(2)}€`
    });

    return pos;
  },

  async closeLeveragedPosition(positionId, currentPrice, isLiquidation = false) {
    const { data: pos, error: fetchErr } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('id', positionId)
      .eq('status', 'OPEN')
      .single();

    if (fetchErr || !pos) {
      throw new Error('Position nicht gefunden oder bereits geschlossen');
    }

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

    if (isLiquidation) {
      pnl = -collateral;
    }

    const fee = notional * 0.005;
    let payout = (collateral + pnl) - fee;
    if (payout < 0) payout = 0;

    const { data: updated, error: updErr } = await db.supabase
      .from('leveraged_positions')
      .update({
        status: isLiquidation ? 'LIQUIDATED' : 'CLOSED',
        close_price: currentPrice,
        close_time: new Date().toISOString(),
        pnl,
        equity_at_close: collateral + pnl,
        liquidation_reason: isLiquidation ? 'AUTO_LIQUIDATION' : null
      })
      .eq('id', positionId)
      .eq('status', 'OPEN')
      .select();

    if (updErr) {
      console.error('Update Error in close:', updErr.message);
      throw updErr;
    }

    if (!updated || updated.length !== 1) {
      throw new Error('Position wurde bereits von einem anderen Request geschlossen');
    }

    const { data: profile } = await db.supabase
      .from('profiles')
      .select('balance')
      .eq('id', pos.profile_id)
      .single();

    await db.updateBalance(pos.profile_id, Number(profile.balance) + payout);

    await db.supabase.from('transactions').insert({
      profile_id: pos.profile_id,
      type: isLiquidation ? 'LIQUIDATION' : 'LEVERAGE_CLOSE',
      total_eur: isLiquidation ? 0 : payout,
      symbol: pos.symbol,
      details: `[${pos.order_id || pos.id}] PnL: ${pnl.toFixed(2)}€ (Fee: ${fee.toFixed(2)}€)`
    });

    return { pnl, payout, status: isLiquidation ? 'LIQUIDATED' : 'CLOSED' };
  },

  async partialCloseLeveragedPosition(positionId, profileId, percentage = 0.5) {
    const { data: pos, error: fetchErr } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('id', positionId)
      .eq('status', 'OPEN')
      .single();

    if (fetchErr || !pos) {
      throw new Error('Position nicht gefunden oder bereits geschlossen');
    }

    if (pos.profile_id !== profileId) {
      throw new Error('Zugriff verweigert');
    }

    const currentPrice = await db.getCurrentPrice(pos.symbol);
    const closingCollateral = Number(pos.collateral) * percentage;
    const closingNotional = closingCollateral * Number(pos.leverage);

    let pnl = 0;
    if (pos.direction === 'LONG') {
      pnl = ((currentPrice - Number(pos.entry_price)) / Number(pos.entry_price)) * closingNotional;
    } else {
      pnl = ((Number(pos.entry_price) - currentPrice) / Number(pos.entry_price)) * closingNotional;
    }

    const fee = closingNotional * 0.005;
    const payout = Math.max(0, (closingCollateral + pnl) - fee);
    const newCollateral = Number(pos.collateral) - closingCollateral;

    const { data: updated, error: updErr } = await db.supabase
      .from('leveraged_positions')
      .update({ collateral: newCollateral })
      .eq('id', positionId)
      .eq('status', 'OPEN')
      .select();

    if (updErr) throw updErr;
    if (!updated || updated.length !== 1) {
      throw new Error('Partial Close fehlgeschlagen – Position bereits geändert');
    }

    const { data: profile } = await db.supabase
      .from('profiles')
      .select('balance')
      .eq('id', profileId)
      .single();

    await db.updateBalance(profileId, Number(profile.balance) + payout);

    await db.supabase.from('transactions').insert({
      profile_id: profileId,
      type: 'LEVERAGE_CLOSE',
      total_eur: payout,
      symbol: pos.symbol,
      details: `[${pos.order_id || pos.id}] Partial ${percentage * 100}% | PnL: ${pnl.toFixed(2)}€`
    });

    return { pnl, payout, new_collateral: newCollateral };
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
        try {
          await this.closeLeveragedPosition(pos.id, currentPrice, true);
          liquidated.push(pos.id);
        } catch (e) {
          console.error(`Liquidation für ${pos.id} fehlgeschlagen:`, e.message);
        }
      }
    }

    return liquidated;
  },

  async getLeverageHistory(profileId) {
    const { data, error } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('profile_id', profileId)
      .neq('status', 'OPEN')
      .order('close_time', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  }
});
