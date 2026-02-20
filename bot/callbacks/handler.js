const { db } = require('../core/database');
const { priceService } = require('../services/priceService');
const handlePortfolio = require('../commands/portfolio');
const { handleLeaderboard } = require('../commands/economy');
const { esc } = require('../core/utils');
const { InlineKeyboard } = require('grammy');
const { WEBAPP_URL, VERSION } = require('../core/config');

module.exports = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const adminId = Number(process.env.ADMIN_ID);

  if (data === 'portfolio') {
    await ctx.answerCallbackQuery();
    return handlePortfolio(ctx);
  }

  if (data === 'leaderboard' || data === 'refresh_leaderboard') {
    return handleLeaderboard(ctx);
  }

  if (data === 'show_info') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text('🔙 Zurück', 'back_to_start');
    
    return ctx.editMessageText(
      `ℹ️ <b>System-Informationen</b>\n\n` +
      `🎮 <b>Spiel-Channel:</b> @ValueTradeGame\n` +
      `👨‍💻 <b>System Architect:</b> @autoacts\n` +
      `⚙️ <b>Version:</b> v${VERSION}`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data === 'back_to_start') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return;

    const kb = new InlineKeyboard()
      .webApp('🎮 Trading starten', WEBAPP_URL)
      .row()
      .text('📊 Portfolio', 'portfolio')
      .text('🏆 Rangliste', 'leaderboard')
      .row()
      .text('ℹ️ Info', 'show_info');

    return ctx.editMessageText(
      `Willkommen zurück, <b>${esc(profile.username || profile.first_name)}</b>! 💰\n\n` +
      `Dein Kontostand: <b>${Number(profile.balance).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
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
      `/settings - Einstellungen\n` +
      `/pro - Pro-Version\n\n` +
      `💡 Nutze die Web App zum Traden!`,
      { parse_mode: 'HTML' }
    );
  }

  if (data === 'set_name_start') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    const isPro = profile.is_pro && new Date(profile.pro_until) > new Date();
    
    if (!isPro && profile.username_changes >= 1) {
      return ctx.reply("❌ Du hast deine Namensänderung bereits verbraucht. Pro-User können ihren Namen alle 30 Tage ändern.");
    }
    return ctx.reply("✍️ Bitte antworte auf diese Nachricht mit deinem neuen gewünschten Usernamen (einfach Text senden).");
  }

  if (data === 'set_delete_start') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('✅ Ja, Antrag stellen', 'confirm_deletion_request')
      .text('❌ Abbrechen', 'close');

    return ctx.editMessageText(
      "⚠️ <b>ACHTUNG: KONTOLÖSCHUNG</b>\n\n" +
      "Möchtest du wirklich einen Löschantrag stellen? " +
      "Alle Assets, Immobilien und dein Rang werden unwiderruflich gelöscht.",
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data === 'confirm_deletion_request') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    await db.requestAccountDeletion(profile.id);

    await ctx.api.sendMessage(adminId, 
      `⚠️ <b>NEUER LÖSCHANTRAG</b>\n\n` +
      `User: ${esc(profile.first_name)} (@${profile.username || '-'})\n` +
      `ID: <code>${profile.telegram_id}</code>\n\n` +
      `Wartet auf Verifizierung durch den User.`,
      { parse_mode: 'HTML' }
    );
    
    return ctx.editMessageText(
      `⚠️ <b>Antrag gestellt</b>\n\n` +
      `Um die Löschung final zu verifizieren, tippe bitte folgendes in den Chat:\n\n` +
      `<code>Delete (${ctx.from.id})</code>`,
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

  if (data.startsWith('confirm_delete:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':')[1];
    const { success, telegramId } = await db.deleteUserCompletely(profileId);
    if (success && telegramId) {
      try {
        await ctx.api.sendMessage(telegramId, `👋 <b>Account gelöscht</b>\n\nDeine Daten wurden vollständig aus unserem System entfernt. Auf Wiedersehen!`);
        await ctx.api.deleteChatMessages(telegramId, [ctx.callbackQuery.message.message_id]); 
      } catch (e) {}
      await ctx.editMessageText(`✅ Account ID ${profileId} wurde final gelöscht.`);
    }
    return ctx.answerCallbackQuery('🗑️ Gelöscht');
  }

  if (data.startsWith('reject_delete:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':')[1];
    await db.supabase.from('deletion_requests').update({ status: 'rejected' }).eq('profile_id', profileId);
    await ctx.editMessageText(`❌ Löschantrag für ID ${profileId} abgelehnt.`);
    return ctx.answerCallbackQuery('Abgelehnt');
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
