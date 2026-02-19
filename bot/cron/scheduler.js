const cron = require('node-cron');
const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { ADMIN_ID, BONUS_CLAIM_URL } = require('../core/config');
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
      console.error(err);
    }
  });

  cron.schedule('0 0,12 * * *', async () => {
    try {
      const { data: users, error } = await db.supabase.from('profiles').select('*');
      if (error || !users) return;

      const prices = await db.getAllPrices();
      const priceMap = {};
      prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

      for (const user of users) {
        try {
          if (user.notifications_enabled === false) continue;

          const isPro = user.is_pro && new Date(user.pro_until).getTime() > Date.now();
          const lastActive = new Date(user.last_active || user.created_at).getTime();
          const hoursInactive = (Date.now() - lastActive) / (1000 * 60 * 60);

          if (hoursInactive < 12 && !isPro) continue;

          const assets = await db.getAssets(user.id);
          if (!assets || assets.length === 0) continue;

          let totalPnl = 0;
          let portfolioValue = 0;

          assets.forEach(a => {
            const curPrice = priceMap[a.symbol] || 0;
            const val = Number(a.amount) * curPrice;
            portfolioValue += val;
            totalPnl += (val - (Number(a.amount) * Number(a.avg_buy || 0)));
          });

          let msg = totalPnl >= 0 
            ? `📈 <b>Dein Portfolio glänzt!</b>\n\nDu bist aktuell <b>+${totalPnl.toFixed(2)}€</b> im Plus. Dein Gesamtvermögen liegt bei ${(Number(user.balance) + portfolioValue).toFixed(2)}€.`
            : `📉 <b>Markt-Update</b>\n\nDein Portfolio ist aktuell <b>${totalPnl.toFixed(2)}€</b> im Minus. Vielleicht Zeit für einen günstigen Nachkauf?`;

          await bot.api.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
        } catch (e) {
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  cron.schedule('0 2 * * *', async () => {
    try {
      const { data: users } = await db.supabase.from('profiles').select('*');
      if (!users) return;
      
      for (const user of users) {
        try {
          const isPro = user.is_pro && new Date(user.pro_until).getTime() > Date.now();
          if (isPro) continue;

          const lastActive = new Date(user.last_active || user.created_at).getTime();
          const daysInactive = (Date.now() - lastActive) / (1000 * 60 * 60 * 24);

          if (daysInactive >= 22) {
            try {
              await bot.api.sendMessage(user.telegram_id, "💀 <b>Account gelöscht.</b>\n\nDein Account wurde aufgrund von 22 Tagen Inaktivität unwiderruflich entfernt. Danke fürs Mitspielen!", { parse_mode: 'HTML' });
            } catch (e) {}
            
            if (db.deleteUserCompletely) {
              await db.deleteUserCompletely(user.id); 
            }
            continue;
          }

          if (daysInactive >= 20) {
            await bot.api.sendMessage(user.telegram_id, "⚠️ <b>LETZTE WARNUNG!</b>\n\nDein Account wird in <b>48 Stunden</b> aufgrund von Inaktivität gelöscht. Öffne die App, um das zu verhindern!", { parse_mode: 'HTML' });
          } else if (daysInactive >= 7 && daysInactive < 8) {
            await bot.api.sendMessage(user.telegram_id, "☁️ <b>Server-Ressourcen sparen</b>\n\nUm Kosten zu sparen, werden inaktive Accounts regelmäßig bereinigt. Dein Account steht nun auf der Liste für eine baldige Löschung.", { parse_mode: 'HTML' });
          } else if (daysInactive >= 3 && daysInactive < 4 && !user.inactivity_bonus_claimed) {
            await db.supabase.from('profiles').update({ claimable_bonus: 500 }).eq('id', user.id);
            
            const kb = new InlineKeyboard().url('💰 500€ Bonus einlösen', BONUS_CLAIM_URL);
            
            await bot.api.sendMessage(
              user.telegram_id, 
              "🎁 <b>Willkommen zurück!</b>\n\nWir vermissen dich! Klicke auf den Button unten, um dir deinen <b>500,00€ Bonus</b> direkt in der App abzuholen!", 
              { parse_mode: 'HTML', reply_markup: kb }
            );
          }
        } catch (msgErr) {
          console.error(msgErr.message);
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.supabase.from('market_history').delete().lt('recorded_at', cutoff);
    } catch (err) {
      console.error(err);
    }
  });

  cron.schedule('0 0 * * *', async () => {
    try {
      if (db.updateDailySnapshots) {
        await db.updateDailySnapshots();
      }
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { setupCronJobs };
