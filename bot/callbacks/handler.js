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
    
    const engineVersion = VERSION.split('.').slice(0, 2).join('.');
    const kb = new InlineKeyboard().text('🔙 Zurück', 'back_to_start');
    
    return ctx.editMessageText(
      `ℹ️ <b>System-Informationen</b>\n\n` +
      `🎮 <b>Spiel-Channel:</b> @ValueTradeGame\n` +
      `👨‍💻 <b>System Architect:</b> @autoacts\n` +
      `⚙️ <b>Version:</b> v${VERSION}\n\n` +
      `<i>ValueTrade Engine v${engineVersion}</i>`,
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

  if (data === 'set_name_start') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
    
    if (!isPro && (profile.username_changes || 0) >= 1) {
      return ctx.reply("❌ Du hast deine Namensänderung bereits verbraucht. Pro-User können ihren Namen unbegrenzt oft ändern.");
    }
    return ctx.reply("✍️ Bitte antworte auf diese Nachricht mit deinem neuen gewünschten Usernamen (einfach Text senden, 4-16 Zeichen).");
  }

  if (data === 'set_delete_start') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('✅ Ja, Antrag stellen', 'confirm_deletion_request')
      .text('❌ Abbrechen', 'close');

    return ctx.editMessageText(
      "⚠️ <b>ACHTUNG: KONTOLÖSCHUNG</b>\n\n" +
      "Möchtest du wirklich einen Löschantrag stellen? " +
      "Alle Assets, Immobilien, Hebel-Positionen und dein Rang werden unwiderruflich gelöscht.",
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data === 'confirm_deletion_request') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    await db.supabase.from('deletion_requests').insert({ profile_id: profile.id, status: 'pending' });

    await ctx.api.sendMessage(adminId, 
      `⚠️ <b>NEUER LÖSCHANTRAG</b>\n\n` +
      `User: ${esc(profile.first_name)} (@${profile.username || '-'})\n` +
      `ID: <code>${profile.telegram_id}</code>\n\n` +
      `Wartet auf Bestätigungs-Code: <code>Delete (${ctx.from.id})</code>`,
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
    
    await db.supabase.from('pro_requests').insert({ profile_id: profile.id, status: 'pending' });
    
    const kb = new InlineKeyboard()
      .text('✅ Freischalten', `approve_pro:${profile.id}`)
      .text('❌ Ablehnen', `reject_pro:${profile.id}`);

    await ctx.api.sendMessage(adminId,
      `💳 <b>PRO-ANFRAGE</b>\n\n` +
      `👤 ${esc(profile.first_name)} (@${profile.username || '-'})\n` +
      `🆔 ${profile.telegram_id}\n\n` +
      `Freischalten? (Hebel-Limit & Hintergrundbild)`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
    return ctx.reply('✅ Anfrage gesendet! Der Admin wird dein Profil in Kürze für Pro-Features freischalten.');
  }

  if (data.startsWith('approve_pro:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌ Keine Admin-Rechte');
    const profileId = data.split(':')[1];
    
    const proUntil = new Date();
    proUntil.setDate(proUntil.getDate() + 30);

    const { data: profile, error } = await db.supabase
      .from('profiles')
      .update({ is_pro: true, pro_until: proUntil.toISOString() })
      .eq('id', profileId)
      .select('telegram_id, first_name')
      .single();

    if (!error && profile) {
      await db.supabase.from('pro_requests').update({ status: 'approved' }).eq('profile_id', profileId);
      try {
        await ctx.api.sendMessage(profile.telegram_id, `⭐ <b>PRO AKTIVIERT!</b>\n\nDeine Pro-Vorteile sind jetzt aktiv:\n• 10x Hebel (Hebel-Montag)\n• 3 Offene Hebel-Positionen\n• Eigenes Profil-Hintergrundbild\n• Unbegrenzte Namensänderungen`);
      } catch (e) {}
      await ctx.editMessageText(`✅ Pro für ${esc(profile.first_name)} aktiviert.`);
    }
    return ctx.answerCallbackQuery('✅ Erledigt');
  }

  if (data.startsWith('confirm_delete:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':')[1];
    
    const { data: p } = await db.supabase.from('profiles').select('telegram_id').eq('id', profileId).single();
    const { error } = await db.supabase.from('profiles').delete().eq('id', profileId);

    if (!error) {
      if (p?.telegram_id) {
        try {
          await ctx.api.sendMessage(p.telegram_id, `👋 <b>Account gelöscht</b>\n\nDeine Daten wurden vollständig entfernt.`);
        } catch (e) {}
      }
      await ctx.editMessageText(`✅ Account final aus der DB entfernt.`);
    }
    return ctx.answerCallbackQuery('🗑️ Gelöscht');
  }

  if (data.startsWith('reject_delete:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':')[1];
    await db.supabase.from('deletion_requests').delete().eq('profile_id', profileId);
    await ctx.editMessageText(`❌ Löschantrag abgelehnt.`);
    return ctx.answerCallbackQuery('Abgelehnt');
  }

  if (data === 'admin_fetch') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery('Fetching prices...');
    await priceService.fetchAndStorePrices();
    return ctx.reply('✅ ValueTrade Engine: Preise & Chart-Snapshots aktualisiert.');
  }

  if (data === 'admin_stats') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    
    const { count: users } = await db.supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: openLevers } = await db.supabase.from('leveraged_positions').select('*', { count: 'exact', head: true }).eq('status', 'OPEN');
    
    return ctx.reply(
      `📊 <b>System-Status</b>\n\n` +
      `User gesamt: <b>${users}</b>\n` +
      `Aktive Hebel-Trades: <b>${openLevers}</b>\n` +
      `Server-Zeit: <code>${new Date().toLocaleTimeString('de-DE')}</code>`,
      { parse_mode: 'HTML' }
    );
  }

  if (data === 'close') {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }
};
