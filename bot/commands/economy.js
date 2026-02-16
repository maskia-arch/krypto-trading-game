// ============================================================
// COMMANDS: ECONOMY (commands/economy.js)
// ============================================================

const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { esc } = require('../core/utils');
const { WEBAPP_URL } = require('../core/config');

/**
 * /rank oder /leaderboard - Zeigt die reichsten Spieler und Season-Infos
 */
async function handleLeaderboard(ctx) {
  try {
    const leaders = await db.getLeaderboard(10);
    const pool = await db.getFeePool();
    const season = await db.getActiveSeason();

    let text = `🏆 <b>RANGLISTE</b>\n\n`;

    if (season) {
      const end = new Date(season.end_date);
      const days = Math.ceil((end - Date.now()) / 1000 / 60 / 60 / 24);
      text += `📅 Season endet in ${days} Tagen\n💰 Fee Pool: ${pool.toFixed(2)}€\n\n`;
    }

    text += `━━ 💎 Reichste Spieler ━━\n`;
    leaders.forEach((l, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      text += `${medal} ${esc(l.first_name)}: ${Number(l.net_worth).toFixed(0)}€\n`;
    });

    // Optional: Top Profit Logik (erfordert die entsprechende DB-Abfrage)
    const { data: topProfit } = await db.supabase
      .from('transactions')
      .select('profile_id, profiles(first_name)')
      .eq('type', 'sell')
      .order('total_eur', { ascending: false })
      .limit(1)
      .single();

    if (topProfit && topProfit.profiles) {
      text += `\n🏅 Meister-Trader: ${esc(topProfit.profiles.first_name)}`;
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Leaderboard Error:', err);
    ctx.reply('❌ Rangliste konnte nicht geladen werden.');
  }
}

/**
 * /bailout - Der Rettungsschirm von Onkel Heinrich
 */
async function handleBailout(ctx) {
  try {
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Starte zuerst mit /start');

    const result = await db.processBailout(profile.id);
    return ctx.reply(result.msg);
  } catch (err) {
    console.error('Bailout Error:', err);
    ctx.reply('❌ Onkel Heinrich ist gerade beschäftigt. Versuch es später nochmal.');
  }
}

/**
 * /pro - Informationen und Kaufoptionen für die Pro-Version
 */
async function handlePro(ctx) {
  try {
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Starte zuerst mit /start');

    if (profile.is_pro) {
      const until = new Date(profile.pro_until).toLocaleDateString('de-DE');
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

/**
 * /rent - Mieteinnahmen aus Immobilien einsammeln
 */
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
    console.error('Rent Command Error:', err);
    ctx.reply('❌ Fehler beim Einsammeln der Miete.');
  }
}

module.exports = {
  handleLeaderboard,
  handleBailout,
  handlePro,
  handleRent
};
