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
    const START_KAPITAL = 10000;

    const leaders = result.leaders.map(l => {
      const gesamt = Number(l.balance || 0) + Number(l.portfolio_value || 0);
      const netto = gesamt - Number(l.bonus_received || 0) - START_KAPITAL;
      const prozent = (netto / START_KAPITAL) * 100;
      return { ...l, fair_profit_eur: netto, fair_profit_percent: prozent };
    });

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
      const name = esc(l.username || l.first_name || 'Trader');
      const perfEuro = l.fair_profit_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const perfPercent = l.fair_profit_percent.toFixed(2);
      
      text += `${medal} ${name}\n`;
      text += ` └ Profit: <b>${l.fair_profit_eur >= 0 ? '+' : ''}${perfEuro}€</b> (${perfPercent}%)\n`;
    });

    const myProfile = await db.getProfile(ctx.from.id);
    if (myProfile) {
      const allLeadersRaw = await db.getLeaderboard(filter, 1000);
      const allLeaders = allLeadersRaw.leaders.map(l => {
        const gesamt = Number(l.balance || 0) + Number(l.portfolio_value || 0);
        const netto = gesamt - Number(l.bonus_received || 0) - START_KAPITAL;
        return { ...l, fair_profit_eur: netto };
      });

      const myRank = allLeaders.findIndex(p => String(p.telegram_id) === String(ctx.from.id)) + 1;
      
      if (myRank > 10) {
        const me = allLeaders[myRank - 1];
        const myPerfEuro = me.fair_profit_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const myPerfPercent = ((me.fair_profit_eur / START_KAPITAL) * 100).toFixed(2);
        
        text += `\n━━ 👤 <b>Deine Platzierung</b> ━━\n\n`;
        text += `<b>${myRank}.</b> ${esc(me.username || me.first_name)} (Du)\n`;
        text += ` └ Profit: <b>${me.fair_profit_eur >= 0 ? '+' : ''}${myPerfEuro}€</b> (${myPerfPercent}%)\n`;
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
    
    if (profile.is_admin) {
      return ctx.reply(`👑 <b>Admin-Status aktiv!</b>\n\nDu bist der Boss. Alle Pro-Features sind für dich dauerhaft kostenlos freigeschaltet.`, { parse_mode: 'HTML' });
    }
    
    if (profile.is_pro && new Date(profile.pro_until) > new Date()) {
      const until = new Date(profile.pro_until).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
      return ctx.reply(`✅ Du bist bereits Pro-Mitglied!\nAktiv bis: ${until}`);
    }
    
    const kb = new InlineKeyboard()
      .text('💳 Pro kaufen (5€/Monat)', 'buy_pro')
      .row()
      .text('❌ Abbrechen', 'close');
    return ctx.reply(
      `⭐ <b>PRO VERSION - 5€/Monat</b>\n\n` +
      `Features:\n` +
      `🔥 Hebelwetten (2x-10x)\n` +
      `🔔 Preis-Alarme bei Dips\n` +
      `🎨 Exklusive Themes\n` +
      `📊 Erweiterte Charts\n` +
      `⚡ Priority Support`,
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
