const cron = require('node-cron');
const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { ADMIN_ID, BONUS_CLAIM_URL } = require('../core/config');
const { priceService } = require('../services/priceService');

// v0.3.24: Alle Event-relevanten Crons in Berliner Zeit
const BERLIN = { timezone: 'Europe/Berlin' };
const { tradeService } = require('../services/tradeService');
const { seasonService } = require('../services/seasonService');

async function checkLeverageAutoExits(bot) {
  try {
    const openPositions = await db.getAllOpenLeveragedPositions();
    if (!openPositions || openPositions.length === 0) return;

    const currentPrices = await db.getAllPrices();
    const priceMap = {};
    currentPrices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    for (const pos of openPositions) {
      if (pos.is_limit_order) continue;

      const currentPrice = priceMap[pos.symbol];
      if (!currentPrice) continue;

      const sl = pos.stop_loss ? Number(pos.stop_loss) : null;
      const tp = pos.take_profit ? Number(pos.take_profit) : null;
      const isLong = pos.direction === 'LONG';
      
      let triggerType = null;

      if (sl) {
        if ((isLong && currentPrice <= sl) || (!isLong && currentPrice >= sl)) {
          triggerType = 'SL';
        }
      }

      if (!triggerType && tp) {
        if ((isLong && currentPrice >= tp) || (!isLong && currentPrice <= tp)) {
          triggerType = 'TP';
        }
      }

      if (triggerType) {
        await db.closeLeveragedPosition(pos.id, currentPrice, false);
        
        try {
          const { data: profile } = await db.supabase
            .from('profiles')
            .select('telegram_id')
            .eq('id', pos.profile_id)
            .single();
            
          if (profile && profile.telegram_id) {
            const emoji = triggerType === 'TP' ? '✅' : '🛑';
            const title = triggerType === 'TP' ? 'TAKE PROFIT' : 'STOP LOSS';
            
            await bot.api.sendMessage(
              profile.telegram_id, 
              `${emoji} <b>${title} AUSGELÖST!</b>\n\nDeine <b>${pos.leverage}x ${pos.direction}</b> Position für <b>${pos.symbol}</b> wurde automatisch geschlossen.\n\n` +
              `Trigger-Preis: ${currentPrice.toLocaleString('de-DE', {minimumFractionDigits: 2})}€`, 
              { parse_mode: 'HTML' }
            );
          }
        } catch(e) {}
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function checkLeverageLiquidations(bot) {
  try {
    const openPositions = await db.getAllOpenLeveragedPositions();
    if (!openPositions || openPositions.length === 0) return;

    const currentPrices = await db.getAllPrices();
    const priceMap = {};
    currentPrices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    for (const pos of openPositions) {
      if (pos.is_limit_order) continue;

      const currentPrice = priceMap[pos.symbol];
      if (!currentPrice) continue;

      const notional = Number(pos.collateral) * Number(pos.leverage);
      let pnl = 0;
      
      if (pos.direction === 'LONG') {
        pnl = ((currentPrice - Number(pos.entry_price)) / Number(pos.entry_price)) * notional;
      } else {
        pnl = ((Number(pos.entry_price) - currentPrice) / Number(pos.entry_price)) * notional;
      }
      
      const equity = Number(pos.collateral) + pnl;

      if (equity <= 0) {
        await db.closeLeveragedPosition(pos.id, currentPrice, true);
        
        try {
          const { data: profile } = await db.supabase
            .from('profiles')
            .select('telegram_id')
            .eq('id', pos.profile_id)
            .single();
            
          if (profile && profile.telegram_id) {
            await bot.api.sendMessage(
              profile.telegram_id, 
              `🚨 <b>LIQUIDIERUNG!</b>\n\nDeine <b>${pos.leverage}x ${pos.direction}</b> Position für <b>${pos.symbol}</b> wurde zwangsgeschlossen, da deine Sicherheitsmarge (Equity) aufgebraucht ist.\n\n` +
              `Einstieg: ${Number(pos.entry_price).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}€\n` +
              `Exit: ${currentPrice.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}€\n` +
              `Verlust: -${Number(pos.collateral).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}€`, 
              { parse_mode: 'HTML' }
            );
          }
        } catch(e) {}
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function setupCronJobs(bot) {
  const runFrequentTasks = async () => {
    try {
      await priceService.fetchAndStorePrices();
      
      if (tradeService && tradeService.executeLimitOrders) {
        await tradeService.executeLimitOrders(bot);
      }

      if (tradeService && tradeService.checkLiquidations) {
        await tradeService.checkLiquidations(bot);
      }

      if (tradeService && tradeService.checkPriceAlerts) {
        await tradeService.checkPriceAlerts(bot);
      }
      
      await checkLeverageAutoExits(bot);
      await checkLeverageLiquidations(bot);
      
    } catch (err) {
      console.error(err);
    }
  };

  runFrequentTasks();
  setInterval(runFrequentTasks, 30000);

  cron.schedule('*/15 * * * *', async () => {
    try {
      await seasonService.checkAndHandleSeasonTransition(bot);
    } catch (err) {
      console.error(err);
    }
  });

  // v0.3.24: ZOCKER-MONTAG — 08:00 Berlin-Zeit Broadcast
  cron.schedule('0 8 * * 1', async () => {
    try {
      const { data: users, error } = await db.supabase.from('profiles').select('telegram_id, notifications_enabled');
      if (error || !users) return;

      const messages = [
        "🎰 <b>ZOCKER-MONTAG!</b>\n\nNur heute: <b>x20 & x50 Hebel</b> für ALLE freigeschaltet! Nutze die Chance auf maximale Profite (oder Totalverlust). Viel Erfolg!",
        "🚀 <b>Zocker-Modus AKTIV!</b>\n\nDas Limit wurde für 24 Stunden aufgehoben. Du kannst ab sofort mit <b>x20 & x50 Hebel</b> traden. Zeig dem Markt, wer der Boss ist!",
        "⚠️ <b>High Risk, High Reward!</b>\n\nDer Zocker-Montag ist aktiv. <b>x20 & x50 Hebel</b> für alle freigeschaltet bis Mitternacht. Trade clever!"
      ];

      const randomMsg = messages[Math.floor(Math.random() * messages.length)];

      for (const user of users) {
        if (user.notifications_enabled === false) continue;
        try {
          await bot.api.sendMessage(user.telegram_id, randomMsg, { parse_mode: 'HTML' });
        } catch (e) {}
      }
    } catch (err) {
      console.error('Monday broadcast error:', err);
    }
  }, BERLIN);

  // v0.3.24: ZOCKER-MONTAG — 21:00 Berlin-Zeit Warnung an Free-User mit offenen x20/x50
  cron.schedule('0 21 * * 1', async () => {
    try {
      const positions = await db.getAllOpenLeveragedPositions();
      const zockerPositions = positions.filter(p => Number(p.leverage) >= 20);
      if (zockerPositions.length === 0) return;

      const profileIds = [...new Set(zockerPositions.map(p => p.profile_id))];
      for (const pid of profileIds) {
        try {
          const { data: profile } = await db.supabase
            .from('profiles')
            .select('telegram_id, is_pro, pro_until, is_admin, notifications_enabled')
            .eq('id', pid)
            .single();
          if (!profile || profile.notifications_enabled === false) continue;

          const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
          if (isPro) continue; // Pro behält Zocker-Positionen

          await bot.api.sendMessage(profile.telegram_id,
            `⚠️ <b>ZOCKER-MONTAG ENDET IN 3 STUNDEN!</b>\n\n` +
            `Deine x20/x50 Positionen werden um Mitternacht automatisch geschlossen.\n` +
            `Schließe sie vorher manuell um den Zeitpunkt selbst zu bestimmen!`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
    } catch (err) {
      console.error('Monday warning error:', err);
    }
  }, BERLIN);

  // v0.3.24: DIENSTAG 00:01 Berlin-Zeit — Auto-Close aller Free-User x20/x50 Positionen
  cron.schedule('1 0 * * 2', async () => {
    try {
      const positions = await db.getAllOpenLeveragedPositions();
      const zockerPositions = positions.filter(p => Number(p.leverage) >= 20);
      if (zockerPositions.length === 0) return;

      let closedCount = 0;
      for (const pos of zockerPositions) {
        try {
          const { data: profile } = await db.supabase
            .from('profiles')
            .select('telegram_id, is_pro, pro_until, is_admin')
            .eq('id', pos.profile_id)
            .single();
          if (!profile) continue;

          const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
          if (isPro) continue; // Pro behält Zocker-Positionen

          const currentPrice = await db.getCurrentPrice(pos.symbol);
          const result = await db.closeLeveragedPosition(pos.id, currentPrice, false);
          closedCount++;

          try {
            const emoji = result.pnl >= 0 ? '💰' : '📉';
            await bot.api.sendMessage(profile.telegram_id,
              `${emoji} <b>ZOCKER-POSITION AUTO-GESCHLOSSEN</b>\n\n` +
              `Hebel-Montag ist vorbei! Deine <b>${pos.leverage}x ${pos.direction}</b> Position für <b>${pos.symbol}</b> wurde abgerechnet.\n\n` +
              `PnL: <b>${result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}€</b>\n` +
              `Auszahlung: <b>${result.payout.toFixed(2)}€</b>`,
              { parse_mode: 'HTML' }
            );
          } catch (e) {}
        } catch (e) {
          console.error(`Auto-close error for position ${pos.id}:`, e.message);
        }
      }

      if (closedCount > 0) {
        try {
          const adminTgId = Number(process.env.ADMIN_ID);
          if (adminTgId) {
            await bot.api.sendMessage(adminTgId,
              `🎰 <b>Zocker-Montag beendet</b>\n\n${closedCount} Free-User Position(en) automatisch geschlossen.`,
              { parse_mode: 'HTML' }
            );
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error('Tuesday auto-close error:', err);
    }
  }, BERLIN);

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

  // v0.3.24: Tages-Snapshot um Mitternacht Berlin-Zeit
  cron.schedule('0 0 * * *', async () => {
    try {
      if (db.updateDailySnapshots) {
        await db.updateDailySnapshots();
      }
    } catch (err) {
      console.error(err);
    }
  }, { timezone: 'Europe/Berlin' });

  // v0.3.31: Temp Features häufiger aufräumen (alle 30 Minuten statt nur 1x/Tag)
  // Damit abgelaufene Features zuverlässig gesperrt werden
  setInterval(async () => {
    try {
      if (db.cleanupExpiredTempFeatures) {
        const cleaned = await db.cleanupExpiredTempFeatures();
        if (cleaned > 0) console.log(`🧹 ${cleaned} abgelaufene Temp-Features entfernt`);
      }
    } catch (err) {
      console.error('Temp Feature Cleanup Error:', err);
    }
  }, 30 * 60 * 1000);

  // Initiales Cleanup beim Start
  setTimeout(async () => {
    try {
      if (db.cleanupExpiredTempFeatures) await db.cleanupExpiredTempFeatures();
    } catch(e) {}
  }, 5000);

  // v0.3.31: Daily Login Bonus Benachrichtigung um 0:05 Berlin-Zeit
  // Explizites Timezone-Object für node-cron Kompatibilität
  cron.schedule('5 0 * * *', async () => {
    try {
      console.log('🎰 Sende Daily Spin Benachrichtigungen...');
      const { data: users, error } = await db.supabase
        .from('profiles')
        .select('telegram_id, username, first_name, notifications_enabled');
      
      if (error || !users) {
        console.error('Daily Spin Notification: DB Error', error);
        return;
      }

      let sent = 0;
      for (const user of users) {
        if (user.notifications_enabled === false) continue;
        try {
          const name = user.username || user.first_name || 'Trader';
          await bot.api.sendMessage(user.telegram_id,
            `🎰 <b>Dein Daily Bonus ist bereit!</b>\n\n` +
            `Hey ${name}, drehe jetzt am Glücksrad und sichere dir deinen täglichen Gewinn!\n\n` +
            `Öffne die App und tippe oben auf das 🎰 Symbol.`,
            { parse_mode: 'HTML' }
          );
          sent++;
          // Kleine Pause um Rate-Limits zu vermeiden
          if (sent % 20 === 0) await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          // User hat Bot blockiert oder Chat gelöscht — kein Fehler
        }
      }
      console.log(`🎰 Daily Spin: ${sent}/${users.length} Benachrichtigungen gesendet`);
    } catch (err) {
      console.error('Daily Spin Notification Error:', err);
    }
  }, { timezone: 'Europe/Berlin' });

  // v0.3.30: Copy Trading — Abgelaufene Abos expiren (alle 5 Minuten)
  setInterval(async () => {
    try {
      if (db.expireCopySubscriptions) {
        const count = await db.expireCopySubscriptions();
        if (count > 0) console.log(`📋 ${count} Copy-Abos abgelaufen`);
      }
    } catch (err) {
      console.error('Copy Expiry Error:', err);
    }
  }, 5 * 60 * 1000);
}

module.exports = { setupCronJobs };
