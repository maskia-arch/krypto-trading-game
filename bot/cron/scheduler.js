const cron = require('node-cron');
const { db } = require('../core/database');
const { ADMIN_ID } = require('../core/config');
const { priceService } = require('../services/priceService');
const { tradeService } = require('../services/tradeService');
const { seasonService } = require('../services/seasonService');

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

  cron.schedule('*/15 * * * *', async () => {
    try {
      await seasonService.checkAndHandleSeasonTransition(bot);
    } catch (err) {
      console.error('Season Transition Check Error:', err);
    }
  });

  cron.schedule('0 0,12 * * *', async () => {
    try {
      const { data: users } = await db.supabase
        .from('profiles')
        .select('*')
        .eq('notifications_enabled', true);

      // Falls die Spalte notifications_enabled noch nicht existiert, fange das ab
      if (!users) return;

      const prices = await db.getAllPrices();
      const priceMap = {};
      prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

      for (const user of users) {
        const isPro = user.is_pro && new Date(user.pro_until) > new Date();
        const lastActive = new Date(user.last_active || user.created_at);
        const hoursInactive = (Date.now() - lastActive) / (1000 * 60 * 60);

        if (hoursInactive < 12 && !isPro) continue;

        const assets = await db.getAssets(user.id);
        let totalPnl = 0;
        let portfolioValue = 0;

        assets.forEach(a => {
          const curPrice = priceMap[a.symbol] || 0;
          const val = Number(a.amount) * curPrice;
          portfolioValue += val;
          totalPnl += (val - (Number(a.amount) * Number(a.avg_buy)));
        });

        let msg = totalPnl >= 0 
          ? `📈 <b>Dein Portfolio glänzt!</b>\n\nDu bist aktuell <b>+${totalPnl.toFixed(2)}€</b> im Plus. Dein Gesamtvermögen liegt bei ${(Number(user.balance) + portfolioValue).toFixed(2)}€.`
          : `📉 <b>Markt-Update</b>\n\nDein Portfolio ist aktuell <b>${totalPnl.toFixed(2)}€</b> im Minus. Vielleicht Zeit für einen günstigen Nachkauf?`;

        try {
          await bot.api.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
        } catch (e) {
          console.error(`Portfolio Notify failed for ${user.telegram_id}`);
        }
      }
    } catch (err) {
      console.error('Portfolio Cron Error:', err);
    }
  });

  cron.schedule('0 2 * * *', async () => {
    try {
      const { data: users } = await db.supabase.from('profiles').select('*');
      if (!users) return;
      
      for (const user of users) {
        const isPro = user.is_pro && new Date(user.pro_until) > new Date();
        if (isPro) continue;

        const lastActive = new Date(user.last_active || user.created_at);
        const daysInactive = (Date.now() - lastActive) / (1000 * 60 * 60 * 24);

        // Alles in einem Try-Catch Block, damit blockierende User die Schleife nicht crashen
        try {
          if (daysInactive >= 22) {
            await bot.api.sendMessage(user.telegram_id, "💀 <b>Account gelöscht.</b>\n\nDein Account wurde aufgrund von 22 Tagen Inaktivität unwiderruflich entfernt. Danke fürs Mitspielen!", { parse_mode: 'HTML' });
            await db.deleteUserCompletely(user.id); 
            continue;
          }

          if (daysInactive >= 20) {
            await bot.api.sendMessage(user.telegram_id, "⚠️ <b>LETZTE WARNUNG!</b>\n\nDein Account wird in <b>48 Stunden</b> aufgrund von Inaktivität gelöscht. Öffne die App, um das zu verhindern!", { parse_mode: 'HTML' });
          } else if (daysInactive >= 7) {
            await bot.api.sendMessage(user.telegram_id, "☁️ <b>Server-Ressourcen sparen</b>\n\nUm Kosten zu sparen, werden inaktive Accounts regelmäßig bereinigt. Dein Account steht nun auf der Liste für eine baldige Löschung.", { parse_mode: 'HTML' });
          } else if (daysInactive >= 3 && !user.inactivity_bonus_claimed) {
            await bot.api.sendMessage(user.telegram_id, "🎁 <b>Willkommen zurück Bonus!</b>\n\nWir vermissen dich! Hier sind <b>500,00€ Bonus</b> für deinen Wiedereinstieg. Viel Erfolg!", { parse_mode: 'HTML' });
            await db.supabase.rpc('add_balance', { user_id: user.id, amount: 500 });
            await db.supabase.from('profiles').update({ inactivity_bonus_claimed: true }).eq('id', user.id);
          }
        } catch (msgErr) {
          console.error(`Inaktivitäts-Nachricht an ${user.telegram_id} fehlgeschlagen. User hat Bot evtl. blockiert.`);
          // WICHTIG: Wenn der User 22 Tage inaktiv ist, löschen wir ihn trotzdem, auch wenn die Nachricht nicht ankam!
          if (daysInactive >= 22) {
            await db.deleteUserCompletely(user.id); 
          }
        }
      }
    } catch (err) {
      console.error('Inactivity Cron Error:', err);
    }
  });

  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.supabase.from('market_history').delete().lt('recorded_at', cutoff);
    } catch (err) {
      console.error('History Cleanup Error:', err);
    }
  });

  cron.schedule('0 0 * * *', async () => {
    try {
      await db.updateDailySnapshots();
      console.log('Daily NetWorth snapshots updated.');
    } catch (err) {
      console.error('Daily Snapshot Error:', err);
    }
  });
}

module.exports = { setupCronJobs };
