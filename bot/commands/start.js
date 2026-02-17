const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { esc } = require('../core/utils');
const { WEBAPP_URL, VERSION } = require('../core/config');

const startCommand = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    let profile = await db.getProfile(tgId);

    if (profile) {
      const kb = new InlineKeyboard()
        .webApp('🎮 Trading starten', WEBAPP_URL)
        .row()
        .text('📊 Portfolio', 'portfolio')
        .text('🏆 Rangliste', 'leaderboard');

      return ctx.reply(
        `Willkommen zurück, <b>${esc(profile.username || profile.first_name)}</b>! 💰\n\n` +
        `Dein Kontostand: <b>${Number(profile.balance).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b>\n` +
        `🎮 v${VERSION}`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    }

    return ctx.reply(
      `Willkommen bei <b>ValueTrade</b>! 📈\n\n` +
      `Bevor Onkel Heinrich dir dein Startkapital überweist, benötigst du einen <b>InGame-Namen</b>.\n\n` +
      `👉 <b>Antworte einfach auf diese Nachricht</b> mit deinem gewünschten Namen.\n` +
      `<i>(Erlaubt: a-z, A-Z, 0-9 | Min. 4 bis max. 16 Zeichen)</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Dein InGame-Name...'
        }
      }
    );

  } catch (err) {
    console.error('Fehler im /start Befehl:', err);
    ctx.reply(`❌ Ups! Fehler: <b>${err.message || 'Unbekannt'}</b>\n\nBitte mache hiervon einen Screenshot!`, { parse_mode: 'HTML' });
  }
};

startCommand.sendWelcomeMessage = async (ctx, profile) => {
  const tgId = ctx.from.id;

  const welcomeMsg = await ctx.reply(
    `📨 <b>Ein Brief von Onkel Heinrich</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `<i>Mein lieber ${esc(profile.username)},</i>\n\n` +
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

  try {
    await ctx.api.pinChatMessage(ctx.chat.id, welcomeMsg.message_id);
  } catch (e) {}

  setTimeout(async () => {
    const kb = new InlineKeyboard()
      .webApp('🎮 Jetzt traden!', WEBAPP_URL)
      .row()
      .text('📊 Portfolio', 'portfolio')
      .text('ℹ️ Hilfe', 'help');
      
    await ctx.reply('Bereit für deine erste Million? 🚀', { reply_markup: kb });
  }, 2000);

  const adminId = Number(process.env.ADMIN_ID);
  if (adminId) {
    try {
      await ctx.api.sendMessage(adminId,
        `🆕 <b>Neuer Spieler!</b>\n` +
        `🎮 InGame Username: <b>${esc(profile.username)}</b>\n` +
        `📱 Telegram Name: ${esc(ctx.from.first_name)}\n` +
        `🆔 <code>${tgId}</code>`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }
};

module.exports = startCommand;
