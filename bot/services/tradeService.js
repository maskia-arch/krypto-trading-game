// ============================================================
// SERVICE: TRADE LOGIC (services/tradeService.js)
// ============================================================

const { db } = require('../core/database');

const tradeService = {
  /**
   * Prüft alle offenen Hebel-Positionen gegen die aktuellen Kurse.
   * Führt Liquidationen aus, wenn der Liquidationspreis erreicht wurde.
   */
  async checkLiquidations(bot) {
    try {
      const prices = await db.getAllPrices();
      const priceMap = {};
      prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

      // Alle offenen Positionen inkl. Profil-Daten (für Telegram ID) laden
      const { data: positions } = await db.supabase
        .from('leverage_positions')
        .select('*, profiles(telegram_id, balance)')
        .eq('is_open', true);

      if (!positions || positions.length === 0) return;

      for (const pos of positions) {
        const currentPrice = priceMap[pos.symbol];
        if (!currentPrice) continue;

        // Liquidations-Bedingung prüfen
        const isLiquidated = pos.direction === 'long'
          ? currentPrice <= Number(pos.liquidation)
          : currentPrice >= Number(pos.liquidation);

        if (isLiquidated) {
          // 1. Position in DB schließen
          await db.supabase.from('leverage_positions')
            .update({
              is_open: false,
              exit_price: currentPrice,
              pnl: -Number(pos.amount_eur),
              closed_at: new Date().toISOString()
            })
            .eq('id', pos.id);

          // 2. Nutzer via Bot benachrichtigen
          try {
            await bot.api.sendMessage(pos.profiles.telegram_id,
              `💥 <b>LIQUIDIERT!</b>\n\n` +
              `Deine ${pos.leverage}x ${pos.direction.toUpperCase()} Position auf ${pos.symbol} wurde liquidiert!\n` +
              `Verlust: -${Number(pos.amount_eur).toFixed(2)}€`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {
            // User hat den Bot ggf. blockiert
          }
        }
      }
    } catch (err) {
      console.error('❌ Fehler beim Liquidation-Check:', err);
    }
  },

  /**
   * Prüft gesetzte Preis-Alarme (Pro-Feature)
   */
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
          // 1. Alarm als ausgelöst markieren
          await db.supabase.from('price_alerts')
            .update({ triggered: true })
            .eq('id', alert.id);

          // 2. Nachricht senden
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
