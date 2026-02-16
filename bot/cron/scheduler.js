const cron = require('node-cron');
const { db } = require('../core/database');
const { ADMIN_ID } = require('../core/config');
const { priceService } = require('../services/priceService');
const { tradeService } = require('../services/tradeService');

function setupCronJobs(bot) {
  const runFrequentTasks = async () => {
    try {
      await priceService.fetchAndStorePrices();
      await tradeService.checkLiquidations(bot);
      await tradeService.checkPriceAlerts(bot);
    } catch (err) {
      console.error(err);
    }
  };

  runFrequentTasks();
  
  setInterval(runFrequentTasks, 45000);

  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await db.supabase
        .from('market_history')
        .delete()
        .lt('recorded_at', cutoff);
      
      if (error) throw error;
    } catch (err) {
      console.error(err);
    }
  });

  cron.schedule('0 0 * * *', async () => {
    try {
      const season = await db.getActiveSeason();
      if (season && new Date(season.end_date) <= new Date()) {
        await bot.api.sendMessage(ADMIN_ID, 
          '🏆 <b>Season-Update</b>\n\nDie aktuelle Season ist zeitlich abgelaufen! Bitte verwende /admin zur Auswertung.',
          { parse_mode: 'HTML' }
        );
      }
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { setupCronJobs };
