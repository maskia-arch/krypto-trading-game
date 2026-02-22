const { db } = require('../core/database');
const { priceService } = require('../services/priceService');
const handlePortfolio = require('../commands/portfolio');
const { handleLeaderboard, handlePro } = require('../commands/economy');
const { esc } = require('../core/utils');
const { InlineKeyboard } = require('grammy');
const { WEBAPP_URL, VERSION } = require('../core/config');
const { getVersion } = require('../commands/start');

module.exports = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const adminId = Number(process.env.ADMIN_ID);

  let version = VERSION || '0.3.2';
  try {
    if (typeof getVersion === 'function') version = getVersion();
  } catch (e) {}

  // --- BASIS NAVIGATION ---
  if (data === 'portfolio') {
    await ctx.answerCallbackQuery();
    return handlePortfolio(ctx);
  }

  if (data === 'leaderboard' || data === 'refresh_leaderboard') {
    return handleLeaderboard(ctx);
  }

  if (data === 'pro') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    
    if ((profile?.pro_strikes || 0) >= 3) {
      return ctx.reply("⚠️ Deine Pro-Bestellfunktion wurde aufgrund von Unregelmäßigkeiten (3 Strikes) deaktiviert.");
    }
    
    return handlePro(ctx);
  }

  // v0.3.2: Pro Info für Free User — zeigt alle Vorteile
  if (data === 'pro_info') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('💎 Pro Bestellen', 'buy_pro_menu')
      .row()
      .text('🔙 Zurück', 'back_to_start');

    return ctx.editMessageText(
      `⭐ <b>VALUE-PRO VORTEILE</b>\n\n` +
      `Schalte als Pro-Mitglied folgende Features frei:\n\n` +
      `🎰 <b>Zocker-Modus:</b> x20 & x50 Hebel — dauerhaft!\n` +
      `⚡ <b>Hebel-Boost:</b> Bis zu 3 Positionen gleichzeitig\n` +
      `🛡️ <b>Stop-Loss & Take-Profit:</b> Automatischer Schutz\n` +
      `📈 <b>Trailing-Stop:</b> Gewinne automatisch absichern\n` +
      `🎯 <b>Limit-Orders:</b> Kaufe automatisch im Dip\n` +
      `🎨 <b>Profilhintergrund:</b> Individuelles Design\n` +
      `✏️ <b>Namensänderung:</b> Alle 30 Tage möglich\n\n` +
      `<i>Free User können den Zocker-Modus nur am Hebel-Montag nutzen!</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  // --- ZURÜCK ZUM START ---
  if (data === 'back_to_start') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return;

    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
    
    const kb = new InlineKeyboard()
      .webApp('🎮 Trading starten', WEBAPP_URL)
      .row()
      .text('📊 Portfolio', 'portfolio')
      .text('🏆 Rangliste', 'leaderboard')
      .row()
      .text(isPro ? '⭐ Pro Menü' : '💎 Pro Upgrade', 'pro')
      .text('ℹ️ Info', 'show_info');

    return ctx.editMessageText(
      `Willkommen zurück, <b>${esc(profile.username || profile.first_name)}</b>! 💰\n\n` +
      `Dein Kontostand: <b>${Number(profile.balance).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  // --- SETTINGS CALLBACKS ---
  if (data === 'set_name_start') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return;

    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
    const changesLeft = isPro ? '∞' : Math.max(0, 3 - (profile.username_changes || 0));

    return ctx.reply(
      `✍️ <b>Name ändern</b>\n\n` +
      `Aktueller Name: <b>${esc(profile.username || profile.first_name)}</b>\n` +
      `Verbleibende Änderungen: <b>${changesLeft}</b>\n\n` +
      `Antworte auf diese Nachricht mit deinem neuen Namen.\n` +
      `<i>(Erlaubt: a-z, A-Z, 0-9 | 4-16 Zeichen)</i>`,
      { parse_mode: 'HTML', reply_markup: { force_reply: true, input_field_placeholder: 'Neuer Name...' } }
    );
  }

  if (data === 'set_delete_start') {
    await ctx.answerCallbackQuery();
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return;

    await db.supabase.from('deletion_requests').insert({
      profile_id: profile.id,
      status: 'pending'
    });

    return ctx.reply(
      `⚠️ <b>Account-Löschung</b>\n\n` +
      `Bist du sicher? Diese Aktion ist unwiderruflich.\n` +
      `Dein gesamtes Guthaben, alle Assets und Positionen werden gelöscht.\n\n` +
      `Zur Bestätigung sende folgende Nachricht:\n` +
      `<code>Delete (${ctx.from.id})</code>`,
      { parse_mode: 'HTML' }
    );
  }

  // --- ADMIN CALLBACKS ---
  
  if (data === 'admin_users') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    try {
      const { data: users } = await db.supabase
        .from('profiles')
        .select('telegram_id, username, first_name, balance, is_pro, is_admin, last_active')
        .order('balance', { ascending: false })
        .limit(20);

      let text = `👥 <b>Top 20 User (nach Balance)</b>\n\n`;
      (users || []).forEach((u, i) => {
        const badge = u.is_admin ? '👑' : u.is_pro ? '⭐' : '👤';
        text += `${i+1}. ${badge} ${esc(u.username || u.first_name)} — ${Number(u.balance).toLocaleString('de-DE')}€\n`;
      });

      const kb = new InlineKeyboard().text('🔙 Zurück', 'admin_back');
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      return ctx.editMessageText('❌ Fehler beim Laden der User-Liste.');
    }
  }

  if (data === 'admin_pool') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    try {
      const pool = await db.getFeePool();
      const kb = new InlineKeyboard().text('🔙 Zurück', 'admin_back');
      return ctx.editMessageText(
        `💰 <b>Fee Pool Details</b>\n\n` +
        `Aktueller Pool: <b>${pool.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</b>\n\n` +
        `Dieser Betrag wird am Season-Ende an die Top-Spieler verteilt.`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } catch (e) {
      return ctx.editMessageText('❌ Fehler beim Laden des Fee Pools.');
    }
  }

  if (data === 'admin_deletions') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    try {
      const { data: requests } = await db.supabase
        .from('deletion_requests')
        .select('*, profiles(telegram_id, username, first_name)')
        .eq('status', 'pending');

      if (!requests || requests.length === 0) {
        const kb = new InlineKeyboard().text('🔙 Zurück', 'admin_back');
        return ctx.editMessageText('✅ Keine offenen Löschanträge.', { reply_markup: kb });
      }

      let text = `⚠️ <b>Offene Löschanträge (${requests.length})</b>\n\n`;
      requests.forEach((r, i) => {
        const p = r.profiles;
        text += `${i+1}. ${esc(p?.username || p?.first_name || '?')} (ID: ${p?.telegram_id})\n`;
      });

      const kb = new InlineKeyboard().text('🔙 Zurück', 'admin_back');
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      return ctx.editMessageText('❌ Fehler beim Laden der Löschanträge.');
    }
  }

  if (data === 'admin_prices') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    try {
      const prices = await db.getAllPrices();
      let text = `📊 <b>Aktuelle Preise</b>\n\n`;
      prices.forEach(p => {
        text += `${p.symbol}: <b>${Number(p.price_eur).toLocaleString('de-DE')}€</b>\n`;
      });
      text += `\n🕐 ${new Date().toLocaleString('de-DE')}`;
      const kb = new InlineKeyboard().text('🔙 Zurück', 'admin_back');
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      return ctx.editMessageText('❌ Fehler beim Laden der Preise.');
    }
  }

  if (data === 'admin_fetch') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    try {
      await priceService.fetchAndStorePrices();
      await ctx.answerCallbackQuery('✅ Preise aktualisiert!');
    } catch (e) {
      await ctx.answerCallbackQuery('❌ Fetch fehlgeschlagen');
    }
    return;
  }

  if (data === 'admin_new_season') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('✅ Neue Season starten', 'admin_confirm_new_season')
      .row()
      .text('🔙 Abbrechen', 'admin_back');
    return ctx.editMessageText(
      `🏆 <b>Neue Season starten?</b>\n\nDies setzt die aktuelle Season zurück und startet eine neue.`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data === 'admin_end_season') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('🎁 Season auswerten', 'admin_confirm_end_season')
      .row()
      .text('🔙 Abbrechen', 'admin_back');
    return ctx.editMessageText(
      `🎁 <b>Season auswerten?</b>\n\nDies berechnet die Gewinner und verteilt den Fee Pool.`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data === 'admin_back') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    try {
      const stats = await db.getStats();
      const pool = await db.getFeePool();
      const { count: deleteRequests } = await db.supabase
        .from('deletion_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const kb = new InlineKeyboard()
        .text('👥 Alle User', 'admin_users')
        .text('💰 Fee Pool', 'admin_pool')
        .row()
        .text(`⚠️ Löschanträge (${deleteRequests || 0})`, 'admin_deletions')
        .row()
        .text('🏆 Season starten', 'admin_new_season')
        .text('🎁 Season auswerten', 'admin_end_season')
        .row()
        .text('📊 Preis-Check', 'admin_prices')
        .text('🔄 Preise fetchen', 'admin_fetch');

      return ctx.editMessageText(
        `🔧 <b>ADMIN DASHBOARD</b> (v${version})\n\n` +
        `👥 User: ${stats.userCount}\n` +
        `📝 Transaktionen: ${stats.txCount}\n` +
        `💰 Fee Pool: ${pool.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€\n\n` +
        `Letzte Aktualisierung: ${new Date().toLocaleString('de-DE')}`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } catch (e) {
      return ctx.editMessageText('❌ Fehler beim Laden des Dashboards.');
    }
  }

  // --- ADMIN: DELETION ---
  if (data.startsWith('confirm_delete:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':').pop();

    try {
      await db.supabase.from('deletion_requests').update({ status: 'completed' }).eq('profile_id', profileId);
      await db.supabase.from('assets').delete().eq('profile_id', profileId);
      await db.supabase.from('leveraged_positions').delete().eq('profile_id', profileId);
      await db.supabase.from('user_collectibles').delete().eq('profile_id', profileId);
      await db.supabase.from('real_estate').delete().eq('profile_id', profileId);
      await db.supabase.from('transactions').delete().eq('profile_id', profileId);
      await db.supabase.from('user_achievements').delete().eq('profile_id', profileId);
      await db.supabase.from('profiles').delete().eq('id', profileId);

      await ctx.editMessageText('✅ Account wurde vollständig gelöscht.');
    } catch (e) {
      await ctx.editMessageText(`❌ Fehler bei Löschung: ${e.message}`);
    }
    return ctx.answerCallbackQuery();
  }

  if (data.startsWith('reject_delete:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':').pop();
    await db.supabase.from('deletion_requests').update({ status: 'completed' }).eq('profile_id', profileId);
    await ctx.editMessageText('❌ Löschantrag abgelehnt.');
    return ctx.answerCallbackQuery();
  }

  // --- PRO BESTELLPROZESS ---
  if (data === 'buy_pro_menu') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('1 Monat - 5€', 'order_pro:1:5').row()
      .text('3 Monate - 12€', 'order_pro:3:12').row()
      .text('6 Monate - 20€', 'order_pro:6:20').row()
      .text('🔙 Zurück', 'pro');

    return ctx.editMessageText(
      `💎 <b>Wähle dein PRO-Paket</b>\n\n` +
      `Sichere dir den entscheidenden Vorteil für deine gewählte Laufzeit. ` +
      `Nach der Bestellung wird dich ein Admin kontaktieren.`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data.startsWith('order_pro:')) {
    await ctx.answerCallbackQuery();
    const [_, months, price] = data.split(':');
    
    const kb = new InlineKeyboard()
      .text('🛒 Kostenpflichtig Bestellen', `confirm_order_pro:${months}:${price}`).row()
      .text('🔙 Abbrechen', 'buy_pro_menu');

    return ctx.editMessageText(
      `⚠️ <b>Bestellübersicht</b>\n\n` +
      `• Paket: <b>${months} Monat(e) Pro</b>\n` +
      `• Preis: <b>${price},00€</b>\n\n` +
      `<i>Mit Klick auf den Button unten gibst du eine verbindliche Bestellung auf.</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data.startsWith('confirm_order_pro:')) {
    await ctx.answerCallbackQuery();
    const [_, months, price] = data.split(':');
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return;

    await db.createProRequest(profile.id, months, price);

    const adminKb = new InlineKeyboard()
      .text('✅ Freischalten', `approve_pro_order:${profile.id}:${months}`)
      .text('❌ Ablehnen (Strike)', `reject_pro_order:${profile.id}`);

    await ctx.api.sendMessage(adminId,
      `💳 <b>NEUE PRO-BESTELLUNG (v${version})</b>\n\n` +
      `👤 User: ${esc(profile.first_name)} (@${profile.username || '-'})\n` +
      `🆔 ID: <code>${profile.telegram_id}</code>\n` +
      `📦 Paket: <b>${months} Monat(e) für ${price}€</b>`,
      { parse_mode: 'HTML', reply_markup: adminKb }
    );

    return ctx.editMessageText(
      `✅ <b>Bestellung eingegangen!</b>\n\n` +
      `Ein System-Administrator wird sich in Kürze bei dir melden, um die Zahlung abzuwickeln. ` +
      `Deine Features werden nach Zahlungseingang sofort aktiviert.`,
      { parse_mode: 'HTML' }
    );
  }

  // --- ADMIN ACTIONS (Pro) ---
  if (data.startsWith('approve_pro_order:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const parts = data.split(':');
    const profileId = parts[1];
    const months = Number(parts[2]) || 1;
    
    try {
      const proUntil = await db.activateProForUser(profileId, months);
      const untilStr = proUntil.toLocaleDateString('de-DE');

      const { data: profile } = await db.supabase.from('profiles').select('telegram_id, first_name').eq('id', profileId).single();
      
      if (profile) {
        try {
          await ctx.api.sendMessage(profile.telegram_id, 
            `⭐ <b>VALUE-PRO AKTIVIERT!</b>\n\n` +
            `Vielen Dank für deine Bestellung. Deine Profi-Werkzeuge sind bis zum <b>${untilStr}</b> bereit:\n\n` +
            `🎰 <b>Zocker-Modus:</b> x20 & x50 Hebel — dauerhaft\n` +
            `⚡ <b>Hebel-Boost:</b> Bis zu 10x Hebel + 3 Positionen\n` +
            `🛡️ <b>Automation:</b> Stop-Loss & Take-Profit\n` +
            `📈 <b>Trailing-Stop:</b> Auto-Gewinnabsicherung\n` +
            `🎨 <b>Kosmetik:</b> Hintergründe & Name alle 30 Tage`,
            { parse_mode: 'HTML' });
        } catch (e) {}
      }

      await ctx.editMessageText(`✅ Pro für ${months} Monate aktiviert (bis ${untilStr}).`);
    } catch (e) {
      await ctx.editMessageText(`❌ Fehler: ${e.message}`);
    }
    return ctx.answerCallbackQuery();
  }

  if (data.startsWith('reject_pro_order:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':').pop();
    
    try {
      const newStrikes = await db.addProStrike(profileId);
      await ctx.editMessageText(`❌ Bestellung abgelehnt. User hat nun ${newStrikes}/3 Strikes.`);
    } catch (e) {
      await ctx.editMessageText(`❌ Fehler: ${e.message}`);
    }
    return ctx.answerCallbackQuery('Strike erteilt.');
  }

  // --- INFO ---
  if (data === 'show_info') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text('🔙 Zurück', 'back_to_start');
    return ctx.editMessageText(
      `ℹ️ <b>System-Informationen</b>\n\n` +
      `🎮 <b>Spiel-Channel:</b> @ValueTradeGame\n` +
      `👨‍💻 <b>System Architect:</b> @autoacts\n` +
      `⚙️ <b>Version:</b> v${version}\n\n` +
      `<i>Status: System stabil & v${version.split('.').slice(0, 2).join('.')} Engine aktiv</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (data === 'close') {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }

  await ctx.answerCallbackQuery();
};
