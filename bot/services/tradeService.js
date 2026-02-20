const { db } = require('../core/database');

const tradeService = {
  async checkLiquidations(bot) {
    try {
      const prices = await db.getAllPrices();
      const priceMap = {};
      prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

      const { data: positions } = await db.supabase
        .from('leveraged_positions')
        .select('*, profiles(telegram_id, balance)')
        .eq('status', 'OPEN')
        .eq('is_limit_order', false);

      if (!positions || positions.length === 0) return;

      for (const pos of positions) {
        const currentPrice = priceMap[pos.symbol];
        if (!currentPrice) continue;

        const isLiquidated = pos.direction === 'LONG'
          ? currentPrice <= Number(pos.liquidation_price)
          : currentPrice >= Number(pos.liquidation_price);

        if (isLiquidated) {
          await db.closeLeveragedPosition(pos.id, currentPrice, true);

          try {
            await bot.api.sendMessage(pos.profiles.telegram_id,
              `💥 <b>LIQUIDIERT!</b>\n\n` +
              `Deine ${pos.leverage}x ${pos.direction} Position auf ${pos.symbol} wurde liquidiert!\n` +
              `Der Kurs erreichte ${currentPrice.toFixed(2)}€.\n\n` +
              `Verlust: -${Number(pos.collateral).toFixed(2)}€`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('❌ Fehler beim Liquidation-Check:', err);
    }
  },

  async executeLimitOrders(bot) {
    try {
      const prices = await db.getAllPrices();
      const priceMap = {};
      prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

      const { data: orders } = await db.supabase
        .from('leveraged_positions')
        .select('*, profiles(telegram_id)')
        .eq('status', 'OPEN')
        .eq('is_limit_order', true);

      if (!orders || orders.length === 0) return;

      for (const order of orders) {
        const currentPrice = priceMap[order.symbol];
        const limitPrice = Number(order.limit_price);
        if (!currentPrice || !limitPrice) continue;

        const triggered = order.direction === 'LONG'
          ? currentPrice <= limitPrice
          : currentPrice >= limitPrice;

        if (triggered) {
          const newLiqPrice = order.direction === 'LONG' 
            ? currentPrice * (1 - (1 / order.leverage) * 0.9) 
            : currentPrice * (1 + (1 / order.leverage) * 0.9);

          await db.supabase.from('leveraged_positions')
            .update({ 
              is_limit_order: false, 
              entry_price: currentPrice,
              liquidation_price: newLiqPrice,
              opened_at: new Date().toISOString()
            })
            .eq('id', order.id);

          try {
            await bot.api.sendMessage(order.profiles.telegram_id,
              `🎯 <b>LIMIT-ORDER AUSGEFÜHRT!</b>\n\n` +
              `Deine Position für <b>${order.symbol}</b> wurde bei <b>${currentPrice.toFixed(2)}€</b> eröffnet.\n` +
              `Richtung: ${order.leverage}x ${order.direction}`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('❌ Fehler bei Limit-Order-Ausführung:', err);
    }
  },

  async checkPriceAlerts(bot) {
    try {
      const prices = await db.getAllPrices();
      const priceMap = {};
      prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

      const { data: alerts } = await db.supabase
        .from('price_alerts')
        .select('*, profiles(telegram_id)')
        .eq('triggered', false);

      if (!alerts || alerts.length === 0) return;

      for (const alert of alerts) {
        const current = priceMap[alert.symbol];
        if (!current) continue;

        const triggered = alert.direction === 'above'
          ? current >= Number(alert.target_price)
          : current <= Number(alert.target_price);

        if (triggered) {
          await db.supabase.from('price_alerts')
            .update({ triggered: true })
            .eq('id', alert.id);

          try {
            const dir = alert.direction === 'above' ? '📈 über' : '📉 unter';
            await bot.api.sendMessage(alert.profiles.telegram_id,
              `🔔 <b>PREIS-ALARM!</b>\n\n` +
              `${alert.symbol} ist ${dir} ${Number(alert.target_price).toFixed(2)}€!\n` +
              `Aktueller Kurs: ${current.toFixed(2)}€`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('❌ Fehler beim Preis-Alarm-Check:', err);
    }
  }
};

module.exports = { tradeService };
