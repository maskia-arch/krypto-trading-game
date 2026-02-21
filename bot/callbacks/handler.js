const { db } = require('../core/database');
const { priceService } = require('../services/priceService');
const handlePortfolio = require('../commands/portfolio');
const { handleLeaderboard, handlePro } = require('../commands/economy');
const { esc } = require('../core/utils');
const { InlineKeyboard } = require('grammy');
const { WEBAPP_URL } = require('../core/config');
const { getVersion } = require('../commands/start');

module.exports = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const adminId = Number(process.env.ADMIN_ID);
  const version = getVersion();

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
    
    // Ignoriert die Anfrage, wenn der User 3 Strikes hat
    if ((profile?.pro_strikes || 0) >= 3) {
      return ctx.reply("⚠️ Deine Pro-Bestellfunktion wurde aufgrund von Unregelmäßigkeiten (3 Strikes) deaktiviert.");
    }
    
    return handlePro(ctx);
  }

  // --- PRO BESTELLPROZESS (v0.3.1) ---

  // Schritt 1: Tarif-Auswahl Menü
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

  // Schritt 2: Kostenpflichtige Bestellung bestätigen
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

  // Schritt 3: Bestellung absenden & Admin informieren
  if (data.startsWith('confirm_order_pro:')) {
    await ctx.answerCallbackQuery();
    const [_, months, price] = data.split(':');
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return;

    // Speichert die Anfrage in der DB
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

  // Admin bestätigt: Pro für gewählten Zeitraum aktivieren
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
          `• 🎨 <b>Kosmetik:</b> Hintergründe & Name alle 30 Tage`);
      } catch (e) {}
    }

    await ctx.editMessageText(`✅ Pro für ${months} Monate aktiviert.`);
    return ctx.answerCallbackQuery();
  }

  // Admin lehnt ab: User erhält Strike
  if (data.startsWith('reject_pro_order:')) {
    if (ctx.from.id !== adminId) return ctx.answerCallbackQuery('❌');
    const profileId = data.split(':').pop();
    
    const newStrikes = await db.addProStrike(profileId);
    await ctx.editMessageText(`❌ Bestellung abgelehnt. User hat nun ${newStrikes}/3 Strikes.`);
    return ctx.answerCallbackQuery('Strike erteilt.');
  }

  // --- INFO & SYSTEM ---
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

  // ... (Restlicher Code für Portfolio-Zurück, Namensänderung, Deletion bleibt gleich)

  if (data === 'close') {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }
};
