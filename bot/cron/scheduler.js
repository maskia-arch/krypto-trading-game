// ============================================================
// CRON SCHEDULER (cron/scheduler.js)
// ============================================================

const cron = require('node-cron');
const { db } = require('../core/database');
const { ADMIN_ID } = require('../core/config');
const { priceService } = require('../services/priceService');
const { tradeService } = require('../services/tradeService');

/**
 * Initialisiert alle zeitgesteuerten Aufgaben
 * @param {Bot} bot - Die grammY Bot-Instanz für Benachrichtigungen
 */
function setupCronJobs(bot) {
  
  // 1. Preise alle 60 Sekunden aktualisieren & Alarme/Hebel prüfen
  cron.schedule('* * * * *', async () => {
    try {
      // Neue Kurse von CoinGecko holen
      await priceService.fetchAndStorePrices();
      
      // Prüfen, ob Hebel-Positionen liquidiert werden müssen
      await tradeService.checkLiquidations(bot);
      
      // Preis-Alarme der Pro-User prüfen
      await tradeService.checkPriceAlerts(bot);
      
    } catch (err) {
      console.error('❌ Fehler im minütlichen Cron-Job:', err);
    }
  });

  // 2. Täglich um 03:00 Uhr: Alte Markthistorie aufräumen (> 7 Tage)
  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await db.supabase
        .from('market_history')
        .delete()
        .lt('recorded_at', cutoff);
      
      if (error) throw error;
      console.log('🧹 Alte Markt-Daten bereinigt');
    } catch (err) {
      console.error('❌ Fehler beim Bereinigen der History:', err);
    }
  });

  // 3. Täglich um 00:00 Uhr: Season-Check (Enddatum erreicht?)
  cron.schedule('0 0 * * *', async () => {
    try {
      const season = await db.getActiveSeason();
      if (season && new Date(season.end_date) <= new Date()) {
        console.log('🏆 Season abgelaufen - Benachrichtigung an Admin');
        await bot.api.sendMessage(ADMIN_ID, 
          '🏆 <b>Season-Update</b>\n\nDie aktuelle Season ist zeitlich abgelaufen! Bitte verwende /admin zur Auswertung.',
          { parse_mode: 'HTML' }
        );
      }
    } catch (err) {
      console.error('❌ Fehler beim Season-Check:', err);
    }
  });

  console.log('⏰ Alle Cron-Jobs wurden erfolgreich registriert.');
}

module.exports = { setupCronJobs };
