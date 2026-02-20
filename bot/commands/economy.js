const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { esc } = require('../core/utils');
const { WEBAPP_URL } = require('../core/config');

async function handleLeaderboard(ctx) {
  try {
    const filter = 'profit_season';
    const result = await db.getLeaderboard(filter, 10);
    const pool = result.pool;
    const season = result.season;
    const leaders = result.leaders;

    let text = `🏆 <b>ValueTrade Rangliste</b>\n\n`;

    if (season && season.end_date) {
      const end = new Date(season.end_date);
      const now = new Date();
      const diff = end - now;

      if (diff > 0) {
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        text += `⏳ <b>Season Ende:</b> <code>${days}d ${hours}h ${minutes}m</code>\n`;
      } else {
        text += `⏳ <b>Season Ende:</b> Beendet\n`;
      }
      text += `💰 <b>Season Pool:</b> ${Number(pool || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€\n\n`;
    }

    text += `━━ 🔥 <b>Top 10 Season Gewinner</b> ━━\n\n`;

    leaders.slice(0, 10).forEach((l, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `<b>${i + 1}.</b>`;
      const badge = l.is_admin ? '👑 ' : (l.is_pro ? '⭐ ' : '');
      const name = badge + esc(l.username || l.first_name || 'Trader');
      
      const perfEuro = Number(l.performance_euro || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const perfPercent = Number(l.performance_percent || 0).toFixed(2);
      
      text += `${medal} ${name}\n`;
      text += ` └ Profit: <b>${l.performance_euro >= 0 ? '+' : ''}${perfEuro}€</b> (${perfPercent}%)\n`;
    });

    const myProfile = await db.getProfile(ctx.from.id);
    if (myProfile) {
      const allLeadersRaw = await db.getLeaderboard(filter, 1000);
      const allLeaders = allLeadersRaw.leaders;
      const myRank = allLeaders.findIndex(p => String(p.telegram_id) === String(ctx.from.id)) + 1;
      
      if (myRank > 10) {
        const me = allLeaders[myRank - 1];
        const myPerfEuro = Number(me.performance_euro || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const myPerfPercent = Number(me.performance_percent || 0).toFixed(2);
        
        text += `\n━━ 👤 <b>Deine Platzierung</b> ━━\n\n`;
        text += `<b>${myRank}.</b> ${me.is_pro ? '⭐ ' : ''}${esc(me.username || me.first_name)} (Du)\n`;
        text += ` └ Profit: <b>${me.performance_euro >= 0 ? '+' : ''}${myPerfEuro}€</b> (${myPerfPercent}%)\n`;
      }
    }

    text += `\n🕒 Stand: ${new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}`;

    const kb = new InlineKeyboard()
      .webApp('🎮 Jetzt traden', WEBAPP_URL)
      .row()
      .text('🔄 Aktualisieren', 'refresh_leaderboard');

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
        await ctx.answerCallbackQuery('Rangliste aktualisiert! 🏆');
      } catch (e) {
        await ctx.answerCallbackQuery();
      }
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch (err) {
    console.error('Bot Leaderboard Error:', err);
    ctx.reply('❌ Rangliste konnte nicht geladen werden.');
  }
}

async function handleBailout(ctx) {
  try {
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Starte zuerst mit /start');
    const result = await db.processBailout(profile.id);
    return ctx.reply(result.msg);
  } catch (err) {
    ctx.reply('❌ Onkel Heinrich ist gerade beschäftigt. Versuch es später nochmal.');
  }
}

async function handlePro(ctx) {
  try {
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Starte zuerst mit /start');
    
    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
    
    if (profile.is_admin) {
      return ctx.reply(`👑 <b>Admin-Status aktiv!</b>\n\nDu hast unbegrenzten Zugriff auf alle v0.3.0 Features.\n\n` +
      `🛡️ Stop-Loss & Take-Profit\n` +
      `📈 Trailing-Stops (Auto-Profit)\n` +
      `🎯 Limit-Orders\n` +
      `⚡ Bis zu 3 parallele Trades`, { parse_mode: 'HTML' });
    }
    
    if (isPro) {
      const until = new Date(profile.pro_until).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
      return ctx.reply(`✅ <b>Pro-Mitgliedschaft aktiv!</b>\n\nDu genießt alle Vorteile bis zum <b>${until}</b>.\n\nDeine Features sind in der WebApp im Hebel-Panel freigeschaltet!`, { parse_mode: 'HTML' });
    }
    
    const kb = new InlineKeyboard()
      .text('💎 Pro jetzt freischalten (5€)', 'buy_pro')
      .row()
      .text('❌ Abbrechen', 'close');

    return ctx.reply(
      `⭐ <b>UPGRADE AUF VALUE-PRO (v0.3.0)</b>\n\n` +
      `Werde zum Profi-Trader und schalte exklusive Werkzeuge frei:\n\n` +
      `⚡ <b>Hebel-Boost:</b> Trade mit bis zu 10x Hebel!\n` +
      `🛡️ <b>Automatisierung:</b> Stop-Loss & Take-Profit nutzen.\n` +
      `📈 <b>Trailing-Stop:</b> Lass Gewinne automatisch absichern.\n` +
      `🎯 <b>Limit-Orders:</b> Kaufe den Dip auch wenn du schläfst.\n` +
      `📦 <b>Mehr Trades:</b> Bis zu 3 Positionen gleichzeitig offen.\n\n` +
      `<i>Sichere dir den entscheidenden Vorteil in der Season-Rangliste!</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  } catch (err) {
    ctx.reply('❌ Fehler beim Laden der Pro-Infos.');
  }
}

async function handleRent(ctx) {
  try {
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Starte zuerst mit /start');
    const rent = await db.collectRent(profile.id);
    if (rent > 0) {
      return ctx.reply(`🏠 Mieteinnahmen eingesammelt: +${rent.toFixed(2)}€`);
    }
    return ctx.reply('⏳ Noch keine Miete verfügbar. (24h-Intervall nach dem letzten Sammeln)');
  } catch (err) {
    ctx.reply('❌ Fehler beim Einsammeln der Miete.');
  }
}

module.exports = {
  handleLeaderboard,
  handleBailout,
  handlePro,
  handleRent
};
