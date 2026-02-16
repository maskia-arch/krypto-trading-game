const { db } = require('../core/database');
const { priceService } = require('../services/priceService');
const handlePortfolio = require('../commands/portfolio');
const { handleLeaderboard } = require('../commands/economy');
const { esc } = require('../core/utils');
const { InlineKeyboard } = require('grammy');

module.exports = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const adminId = Number(process.env.ADMIN_ID);

  if (data === 'portfolio') {
    await ctx.answerCallbackQuery();
    return handlePortfolio(ctx);
  }

  if (data === 'leaderboard') {
    await ctx.answerCallbackQuery();
    return handleLeaderboard(ctx);
  }

  if (data === 'help') {
    await ctx.answerCallbackQuery();
    return ctx.reply(
      `📖 <b>Hilfe & Befehle</b>\n\n` +
      `/start - Spiel starten\n` +
      `/portfolio - Dein Portfolio\n` +
      `/rank - Rangliste\n` +
      `/bailout - Rettungsschirm\n` +
      `/rent - Miete einsammeln\n` +
      `/pro - Pro-Version\n\n` +
      `💡 Nutze die Web App zum Traden!`,
      { parse_mode: 'HTML' }
    );
  }

  if (data === 'buy_pro') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return;

    await db.createProRequest(profile.id);

    const kb = new InlineKeyboard()
      .text('✅ Freischalten', `approve_pro:${profile.id}`)
      .text('❌ Ablehnen', `reject_pro:${profile.id}`);

    await ctx.api.sendMessage(adminId,
      `💳 <b>PRO-ANFRAGE</b>\n\n` +
      `👤 ${esc(profile.first_name)} (@${profile.username || '-'})\n` +
      `🆔 ${profile.telegram_id}\n\n` +
      `Freischalten?`,
      { parse_mode: 'HTML', reply_markup: kb }
    );

    return ctx.reply('✅ Anfrage gesendet! Du wirst benachrichtigt, sobald dein Pro-Zugang aktiviert wird.');
  }

  if (data.startsWith('approve_pro:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌ Keine Admin-Rechte');
    const profileId = data.split(':')[1];
    
    const success = await db.approveProRequestForUser(profileId); 
    
    if (success) {
      const p = await db.supabase.from('profiles').select('telegram_id, first_name').eq('id', profileId).single();
      try {
        await ctx.api.sendMessage(p.data.telegram_id, `⭐ <b>PRO AKTIVIERT!</b>\n\nHerzlichen Glückwunsch! Deine Pro-Version ist jetzt 30 Tage aktiv.`);
      } catch (e) {}
      await ctx.editMessageText(`✅ Pro für ${esc(p.data.first_name)} aktiviert.`);
    }
    return ctx.answerCallbackQuery('✅ Erledigt');
  }

  if (data === 'admin_fetch') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery('Fetching prices...');
    await priceService.fetchAndStorePrices();
    return ctx.reply('✅ Preise manuell aktualisiert.');
  }

  if (data === 'admin_users') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const { data: users } = await db.supabase
      .from('profiles')
      .select('first_name, balance')
      .order('balance', { ascending: false })
      .limit(10);

    const list = users.map((u, i) => `${i + 1}. ${esc(u.first_name)}: ${Number(u.balance).toFixed(0)}€`).join('\n');
    return ctx.reply(`👥 <b>Top 10 User</b>\n\n${list}`, { parse_mode: 'HTML' });
  }

  if (data === 'close') {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }
};
