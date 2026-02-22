const cron = require('node-cron');
const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { ADMIN_ID, BONUS_CLAIM_URL } = require('../core/config');
const { priceService } = require('../services/priceService');
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

// v0.3.2: Auto-Close x20/x50 Positionen für Free User (Ende Hebel-Montag)
async function autoCloseZockerForFreeUsers(bot) {
  try {
    const openPositions = await db.getAllOpenLeveragedPositions();
    if (!openPositions || openPositions.length === 0) return;

    const currentPrices = await db.getAllPrices();
    const priceMap = {};
    currentPrices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    for (const pos of openPositions) {
      const lev = Number(pos.leverage);
      if (lev < 20) continue; // Nur x20 und x50

      // Prüfen ob User Pro ist
      const { data: profile } = await db.supabase
        .from('profiles')
        .select('telegram_id, is_pro, pro_until, is_admin')
        .eq('id', pos.profile_id)
        .single();

      if (!profile) continue;
      
      const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
      if (isPro) continue; // Pro User behalten ihre Positionen

      const currentPrice = priceMap[pos.symbol];
      if (!currentPrice) continue;

      try {
        const result = await db.closeLeveragedPosition(pos.id, currentPrice, false);
        
        if (profile.telegram_id) {
          const emoji = result.pnl >= 0 ? '💰' : '📉';
          await bot.api.sendMessage(
            profile.telegram_id,
            `${emoji} <b>ZOCKER-POSITION AUTO-GESCHLOSSEN</b>\n\n` +
            `Der Hebel-Montag ist vorbei! Deine <b>${lev}x ${pos.direction} ${pos.symbol}</b> Position wurde automatisch abgerechnet.\n\n` +
            `PnL: <b>${result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}€</b>\n` +
            `Auszahlung: <b>${result.payout.toFixed(2)}€</b>\n\n` +
            `<i>💎 Tipp: Mit Pro behältst du x20 & x50 dauerhaft!</i>`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (e) {
        console.error(`Auto-Close für Position ${pos.id} fehlgeschlagen:`, e.message);
      }
    }
  } catch (err) {
    console.error('Zocker Auto-Close Fehler:', err);
  }
}

// Helper: Broadcast an alle User (mit opt-out check)
async function broadcastToAll(bot, message) {
  try {
    const { data: users } = await db.supabase.from('profiles').select('telegram_id, notifications_enabled');
    if (!users) return 0;
    let sent = 0;
    for (const user of users) {
      if (user.notifications_enabled === false) continue;
      try {
        await bot.api.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        sent++;
      } catch (e) {}
    }
    return sent;
  } catch (e) {
    console.error('Broadcast Fehler:', e);
    return 0;
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

  // ===== HEBEL-MONTAG EVENT =====

  // Montag 08:00 — Start-Nachricht
  cron.schedule('0 8 * * 1', async () => {
    try {
      const msg = 
        `🎰🔥 <b>HEBEL-MONTAG — ZOCKER-MODUS AKTIV!</b> 🔥🎰\n\n` +
        `Nur heute für ALLE Spieler freigeschaltet:\n\n` +
        `⚡ <b>x20 Hebel</b> — Für mutige Trader\n` +
        `🚀 <b>x50 Hebel</b> — Für echte Zocker\n\n` +
        `High Risk, High Reward! Der Zocker-Modus ist bis Mitternacht verfügbar.\n\n` +
        `<i>⚠️ Achtung: Offene x20/x50 Positionen werden für Free User um Mitternacht automatisch abgerechnet!</i>\n\n` +
        `💎 <b>Pro-Tipp:</b> Pro-Mitglieder haben den Zocker-Modus dauerhaft.`;

      await broadcastToAll(bot, msg);
    } catch (err) {
      console.error('Montag Start Fehler:', err);
    }
  });

  // Montag 21:00 — Warnung (3h vor Ablauf)
  cron.schedule('0 21 * * 1', async () => {
    try {
      // Nur Free User mit offenen x20/x50 warnen
      const openPositions = await db.getAllOpenLeveragedPositions();
      if (!openPositions) return;

      const zockerPositions = openPositions.filter(p => Number(p.leverage) >= 20);
      
      for (const pos of zockerPositions) {
        const { data: profile } = await db.supabase
          .from('profiles')
          .select('telegram_id, is_pro, pro_until, is_admin, notifications_enabled')
          .eq('id', pos.profile_id)
          .single();

        if (!profile || profile.notifications_enabled === false) continue;
        
        const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
        if (isPro) continue; // Pro User nicht warnen

        try {
          await bot.api.sendMessage(
            profile.telegram_id,
            `⚠️ <b>ACHTUNG — ZOCKER-MODUS ENDET IN 3 STUNDEN!</b>\n\n` +
            `Du hast noch eine offene <b>${pos.leverage}x ${pos.direction} ${pos.symbol}</b> Position.\n\n` +
            `🕐 Um <b>Mitternacht</b> werden alle x20/x50 Positionen für Free User automatisch geschlossen.\n\n` +
            `💡 <b>Empfehlung:</b> Verkaufe zum bestmöglichen Preis, bevor die Position automatisch abgerechnet wird!\n\n` +
            `💎 <i>Mit Pro behältst du den Zocker-Modus dauerhaft.</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
    } catch (err) {
      console.error('Montag Warnung Fehler:', err);
    }
  });

  // Dienstag 00:01 — Auto-Close + Ende-Nachricht
  cron.schedule('1 0 * * 2', async () => {
    try {
      // 1. Auto-Close x20/x50 für Free User
      await autoCloseZockerForFreeUsers(bot);

      // 2. Tagesvolumen berechnen (Transaktionen vom Montag)
      const mondayStart = new Date();
      mondayStart.setDate(mondayStart.getDate() - 1);
      mondayStart.setHours(0, 0, 0, 0);
      const mondayEnd = new Date();
      mondayEnd.setHours(0, 0, 0, 0);

      const { data: txs } = await db.supabase
        .from('transactions')
        .select('total_eur')
        .gte('created_at', mondayStart.toISOString())
        .lt('created_at', mondayEnd.toISOString());

      const volume = (txs || []).reduce((sum, tx) => sum + Math.abs(Number(tx.total_eur || 0)), 0);
      const volumeStr = volume.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // 3. Ende-Nachricht
      const msg = 
        `🏁 <b>HEBEL-MONTAG BEENDET!</b>\n\n` +
        `Der Zocker-Modus ist nun für Free User deaktiviert.\n\n` +
        `📊 <b>Tagesvolumen:</b> ${volumeStr}€\n\n` +
        `Danke für deine Teilnahme! Wir sehen uns nächsten Montag wieder. 🎰\n\n` +
        `💎 <i>Pro-Mitglieder traden weiterhin mit x20 & x50!</i>`;

      await broadcastToAll(bot, msg);
    } catch (err) {
      console.error('Montag Ende Fehler:', err);
    }
  });

  // ===== REGELMÄSSIGE BENACHRICHTIGUNGEN =====

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

  // Inaktivitäts-Cleanup
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
