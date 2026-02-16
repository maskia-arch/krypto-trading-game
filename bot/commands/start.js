// ============================================================
// COMMAND: START (commands/start.js)
// ============================================================

const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { esc } = require('../core/utils');
const { WEBAPP_URL, VERSION } = require('../core/config');

/**
 * /start - Onboarding & Registrierung
 */
module.exports = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    // 1. Prüfen, ob der User bereits existiert
    let profile = await db.getProfile(tgId);

    if (profile) {
      // Bekannter User: Willkommensnachricht & Status
      const kb = new InlineKeyboard()
        .webApp('🎮 Trading starten', WEBAPP_URL)
        .row()
        .text('📊 Portfolio', 'portfolio')
        .text('🏆 Rangliste', 'leaderboard');

      return ctx.reply(
        `Willkommen zurück, <b>${esc(profile.first_name)}</b>! 💰\n\n` +
        `Dein Kontostand: <b>${Number(profile.balance).toFixed(2)}€</b>\n` +
        `🎮 v${VERSION}`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    }

    // 2. Neuer User: Profil in Datenbank anlegen
    profile = await db.createProfile(tgId, ctx.from.username, ctx.from.first_name);

    // 3. "Brief vom Onkel" (Atmosphärisches Onboarding)
    const welcomeMsg = await ctx.reply(
      `📨 <b>Ein Brief von Onkel Heinrich</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `<i>Mein lieber ${esc(profile.first_name)},</i>\n\n` +
      `<i>Ich habe dir 10.000€ auf dein Konto überwiesen. Mach was Kluges daraus – ` +
      `investiere in Krypto, kauf dir Immobilien, werde reich!</i>\n\n` +
      `<i>Aber sei vorsichtig... wenn du alles verlierst, kann ich dir nur noch begrenzt helfen.</i>\n\n` +
      `<i>Dein Onkel Heinrich</i> 👴\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Startkapital: 10.000,00€</b>\n` +
      `📈 Verfügbare Coins: BTC, ETH, LTC\n` +
      `💸 Trading-Fee: 0,5%\n\n` +
      `Tippe den Button um loszulegen! 👇`,
      { parse_mode: 'HTML' }
    );

    // 4. Nachricht anpinnen (für schnellen Zugriff auf Infos)
    try {
      await ctx.api.pinChatMessage(ctx.chat.id, welcomeMsg.message_id);
    } catch (e) {
      // Kann in privaten Chats fehlschlagen, wenn Berechtigungen fehlen
    }

    // 5. Interaktive Buttons nach kurzer Verzögerung
    setTimeout(async () => {
      const kb = new InlineKeyboard()
        .webApp('🎮 Jetzt traden!', WEBAPP_URL)
        .row()
        .text('📊 Portfolio', 'portfolio')
        .text('ℹ️ Hilfe', 'help');
        
      await ctx.reply('Bereit für deine erste Million? 🚀', { reply_markup: kb });
    }, 2000);

    // 6. Admin-Benachrichtigung über neuen Spieler
    const adminId = Number(process.env.ADMIN_ID);
    if (adminId) {
      try {
        await ctx.api.sendMessage(adminId,
          `🆕 <b>Neuer Spieler!</b>\n` +
          `👤 ${esc(profile.first_name)} (@${profile.username || 'kein Username'})\n` +
          `🆔 <code>${tgId}</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        // Admin nicht erreichbar
      }
    }

  } catch (err) {
    console.error('Start Command Error:', err);
    ctx.reply('❌ Ups! Da ist beim Erstellen deines Kontos etwas schiefgelaufen. Bitte versuch es gleich nochmal.');
  }
};
