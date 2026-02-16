const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { esc } = require('../core/utils');

async function handleLeaderboard(ctx) {
  try {
    const leaders = await db.getLeaderboard(10);
    const pool = await db.getFeePool();
    const season = await db.getActiveSeason();

    let text = `🏆 <b>ValueTrade Rangliste</b>\n\n`;

    if (season) {
      const end = new Date(season.end_date);
      const days = Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
      text += `🗓 <b>Season Ende:</b> in ${days} Tagen\n`;
      text += `💰 <b>Season Pool:</b> ${Number(pool || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€\n\n`;
    }

    text += `━━ 💎 <b>Top 10 Gesamtvermögen</b> 💎 ━━\n\n`;
    leaders.forEach((l, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `<b>${i + 1}.</b>`;
      const name = esc(l.username || l.first_name || 'Trader');
      const nw = Number(l.net_worth || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      text += `${medal} ${name}\n └ 💶 ${nw}€\n`;
    });

    const { data: topProfit } = await db.supabase
      .from('transactions')
      .select('profiles(first_name, username)')
      .eq('type', 'sell')
      .order('total_eur', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topProfit && topProfit.profiles) {
      const topName = esc(topProfit.profiles.username || topProfit.profiles.first_name || 'Unbekannt');
      text += `\n🏅 <b>Top-Trade:</b> ${topName}`;
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (err) {
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
