const { db } = require('../core/database');
const { priceService } = require('../services/priceService');
const handlePortfolio = require('../commands/portfolio');
const { handleLeaderboard, handlePro } = require('../commands/economy');
const { esc } = require('../core/utils');
const { InlineKeyboard } = require('grammy');
const { WEBAPP_URL } = require('../core/config');
// v0.3.21: Safe import mit Fallback
let getVersion;
try {
  getVersion = require('../commands/start').getVersion;
} catch(e) {}
if (typeof getVersion !== 'function') {
  const fs = require('fs');
  const path = require('path');
  getVersion = () => {
    try {
      const vp = path.join(__dirname, '../../version.txt');
      if (fs.existsSync(vp)) return fs.readFileSync(vp, 'utf8').trim();
    } catch(e) {}
    return '0.3.21';
  };
}

module.exports = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const adminId = Number(process.env.ADMIN_ID);

  let version = '0.3.21';
  try {
    version = getVersion();
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
  if (data === 'buy_pro_menu' || data === 'buy_pro') {
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
    const [_, profileId, months] = data.split(':');
    
    const proUntil = await db.activateProForUser(profileId, Number(months));
    const untilStr = proUntil.toLocaleDateString('de-DE');

    const { data: profile } = await db.supabase.from('profiles').select('telegram_id, first_name').eq('id', profileId).single();
    
    if (profile) {
      try {
        await ctx.api.sendMessage(profile.telegram_id, 
          `⭐ <b>VALUE-PRO AKTIVIERT!</b>\n\n` +
          `Vielen Dank für deine Bestellung. Deine Profi-Werkzeuge sind bis zum <b>${untilStr}</b> bereit:\n` +
          `• ⚡ <b>Hebel-Boost:</b> Bis zu 10x Hebel\n` +
          `• 🛡️ <b>Automation:</b> Stop-Loss & Take-Profit\n` +
          `• 📈 <b>Trailing-Stop:</b> Auto-Gewinnabsicherung\n` +
          `• 📦 <b>Kapazität:</b> 3 Positionen gleichzeitig\n` +
          `• 🎨 <b>Kosmetik:</b> Hintergründe & Name alle 30 Tage`,
          { parse_mode: 'HTML' });
      } catch (e) {}
    }

    await ctx.editMessageText(`✅ Pro für ${months} Monate aktiviert.`);
    return ctx.answerCallbackQuery();
  }

  if (data.startsWith('reject_pro_order:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':').pop();
    
    const newStrikes = await db.addProStrike(profileId);
    await ctx.editMessageText(`❌ Bestellung abgelehnt. User hat nun ${newStrikes}/3 Strikes.`);
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

  // --- ADMIN PANEL CALLBACKS ---
  if (data === 'admin_users') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const { data: users } = await db.supabase.from('profiles').select('username, first_name, balance, telegram_id, is_pro, is_admin').order('balance', { ascending: false }).limit(20);
    let text = `👥 <b>Top 20 User (Balance)</b>\n\n`;
    (users || []).forEach((u, i) => {
      const badge = u.is_admin ? '👑' : u.is_pro ? '⭐' : '👤';
      text += `${i+1}. ${badge} ${esc(u.username || u.first_name)} — ${Number(u.balance).toLocaleString('de-DE')}€\n`;
    });
    const kb = new InlineKeyboard().text('🔙 Dashboard', 'admin_back');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  }

  if (data === 'admin_pool') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const pool = await db.getFeePool();
    const kb = new InlineKeyboard().text('🔙 Dashboard', 'admin_back');
    return ctx.editMessageText(`💰 <b>Fee Pool:</b> ${pool.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€`, { parse_mode: 'HTML', reply_markup: kb });
  }

  if (data === 'admin_deletions') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const { data: reqs } = await db.supabase.from('deletion_requests').select('*, profiles(username, first_name, telegram_id)').eq('status', 'pending');
    if (!reqs || reqs.length === 0) {
      const kb = new InlineKeyboard().text('🔙 Dashboard', 'admin_back');
      return ctx.editMessageText('✅ Keine offenen Löschanträge.', { reply_markup: kb });
    }
    let kb = new InlineKeyboard();
    for (const r of reqs) {
      const name = r.profiles?.username || r.profiles?.first_name || 'Unknown';
      kb.text(`✅ ${name}`, `confirm_delete:${r.profile_id}`).text(`❌ ${name}`, `reject_delete:${r.profile_id}`).row();
    }
    kb.text('🔙 Dashboard', 'admin_back');
    return ctx.editMessageText(`⚠️ <b>${reqs.length} Löschanträge</b>`, { parse_mode: 'HTML', reply_markup: kb });
  }

  if (data === 'admin_prices') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const prices = await db.getAllPrices();
    let text = `📊 <b>Aktuelle Preise</b>\n\n`;
    prices.forEach(p => {
      text += `${p.symbol}: ${Number(p.price_eur).toLocaleString('de-DE', { minimumFractionDigits: 2 })}€\n`;
    });
    text += `\n🕒 ${new Date().toLocaleString('de-DE')}`;
    const kb = new InlineKeyboard().text('🔄 Fetchen', 'admin_fetch').row().text('🔙 Dashboard', 'admin_back');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  }

  if (data === 'admin_fetch') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    try {
      await priceService.fetchAndStorePrices();
      await ctx.answerCallbackQuery('✅ Preise aktualisiert!');
    } catch(e) {
      await ctx.answerCallbackQuery('❌ Fetch fehlgeschlagen');
    }
    return;
  }

  if (data === 'admin_new_season') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    try {
      const seasonNum = Math.floor(Date.now() / 1000);
      const end = new Date(); end.setDate(end.getDate() + 30);
      await db.supabase.from('seasons').update({ is_active: false }).eq('is_active', true);
      await db.supabase.from('seasons').insert({ name: `Season ${seasonNum}`, start_date: new Date().toISOString(), end_date: end.toISOString(), is_active: true });
      const { data: users } = await db.supabase.from('profiles').select('id, balance');
      for (const u of (users || [])) {
        await db.supabase.from('profiles').update({ season_start_worth: Number(u.balance) }).eq('id', u.id);
      }
      return ctx.editMessageText(`✅ Neue Season gestartet! Endet am ${end.toLocaleDateString('de-DE')}`);
    } catch(e) {
      return ctx.editMessageText(`❌ Fehler: ${e.message}`);
    }
  }

  if (data === 'admin_end_season') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    try {
      const result = await db.getLeaderboard('profit_season', 3);
      let text = `🎁 <b>Season-Ergebnis</b>\n\n`;
      (result.leaders || []).forEach((l, i) => {
        text += `${['🥇','🥈','🥉'][i]} ${esc(l.username || l.first_name)} — ${Number(l.performance_euro).toLocaleString('de-DE')}€\n`;
      });
      text += `\n💰 Pool: ${Number(result.pool || 0).toLocaleString('de-DE')}€`;
      const kb = new InlineKeyboard().text('🔙 Dashboard', 'admin_back');
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch(e) {
      return ctx.editMessageText(`❌ Fehler: ${e.message}`);
    }
  }

  if (data === 'admin_back') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    const stats = await db.getStats();
    const pool = await db.getFeePool();
    const { count: deleteRequests } = await db.supabase.from('deletion_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const kb = new InlineKeyboard()
      .text('👥 Alle User', 'admin_users').text('💰 Fee Pool', 'admin_pool').row()
      .text(`⚠️ Löschanträge (${deleteRequests || 0})`, 'admin_deletions').row()
      .text('🏆 Season starten', 'admin_new_season').text('🎁 Season auswerten', 'admin_end_season').row()
      .text('📊 Preis-Check', 'admin_prices').text('🔄 Preise fetchen', 'admin_fetch').row()
      .text('🎰 Glücksrad Config', 'admin_spin_config');
    return ctx.editMessageText(
      `🔧 <b>ADMIN DASHBOARD</b> (v${version})\n\n` +
      `👥 User: ${stats.userCount}\n📝 Transaktionen: ${stats.txCount}\n💰 Fee Pool: ${pool.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  // v0.3.30: Glücksrad Admin Config
  if (data === 'admin_spin_config') {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    await ctx.answerCallbackQuery();
    
    try {
      const freeConfig = await db.getSpinConfig('free');
      const proConfig = await db.getSpinConfig('pro');
      
      let text = `🎰 <b>GLÜCKSRAD KONFIGURATION</b>\n\n`;
      text += `<b>FREE Rad (${freeConfig.length} Felder):</b>\n`;
      freeConfig.forEach(c => {
        text += `  ${c.label} — ${(Number(c.probability) * 100).toFixed(1)}% [${c.reward_type}]\n`;
      });
      text += `\n<b>PRO Rad (${proConfig.length} Felder):</b>\n`;
      proConfig.forEach(c => {
        text += `  ${c.label} — ${(Number(c.probability) * 100).toFixed(1)}% [${c.reward_type}]\n`;
      });
      text += `\n<i>Konfiguration über API oder Supabase-Dashboard ändern.</i>`;
      
      const kb = new InlineKeyboard().text('🔙 Dashboard', 'admin_back');
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      return ctx.editMessageText(`❌ Fehler: ${e.message}`);
    }
  }

  // --- PRO INFO MODAL (für LeveragePanel) ---
  if (data === 'pro_info') {
    await ctx.answerCallbackQuery();
    return ctx.reply(
      `⭐ <b>VALUE-PRO Vorteile</b>\n\n` +
      `🎰 Zocker-Modus: x20 & x50 Hebel — dauerhaft!\n` +
      `⚡ 3 Positionen gleichzeitig offen halten\n` +
      `🛡️ Stop-Loss & Take-Profit: Automatischer Verlust-Schutz\n` +
      `📈 Trailing-Stop: Gewinne automatisch absichern\n` +
      `🎯 Limit-Orders: Automatisch im Dip kaufen\n` +
      `🎨 Profilhintergrund: Individuelles Design\n` +
      `✏️ Namensänderung: Alle 30 Tage möglich`,
      { parse_mode: 'HTML' }
    );
  }

  if (data === 'close') {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }

  await ctx.answerCallbackQuery();
};