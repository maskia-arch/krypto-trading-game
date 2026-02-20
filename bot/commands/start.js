const fs = require('fs');
const path = require('path');
const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { esc } = require('../core/utils');
const { WEBAPP_URL } = require('../core/config');

// Dynamische Versionsabfrage
const getVersion = () => {
  try {
    // Sucht die version.txt zwei Ebenen höher (im Hauptverzeichnis)
    const versionPath = path.join(__dirname, '../../version.txt');
    if (fs.existsSync(versionPath)) {
      return fs.readFileSync(versionPath, 'utf8').trim();
    }
  } catch (e) {
    console.error("Fehler beim Lesen der version.txt:", e);
  }
  return '0.3.0'; // Fallback
};

const startCommand = async (ctx) => {
  const tgId = ctx.from.id;
  const payload = ctx.match;
  const version = getVersion(); // Version hier abrufen

  try {
    let profile = await db.getProfile(tgId);

    if (profile) {
      const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
      
      const kb = new InlineKeyboard()
        .webApp('🎮 Trading starten', WEBAPP_URL)
        .row()
        .text('📊 Portfolio', 'portfolio')
        .text('🏆 Rangliste', 'leaderboard')
        .row()
        .text(isPro ? '⭐ Pro Menü' : '💎 Pro Upgrade', 'pro')
        .text('ℹ️ Info', 'show_info');

      let welcomeBackText = `Willkommen zurück, <b>${esc(profile.username || profile.first_name)}</b>! 💰\n\n` +
        `Dein Kontostand: <b>${Number(profile.balance).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b>`;
      
      if (profile.is_admin) {
        // Hier wird nun die dynamische Variable 'version' genutzt
        welcomeBackText = `👑 <b>Admin-Zentrale</b>\n\nHallo Chef! Dein System läuft auf v${version}.\nDein Kontostand: <b>${Number(profile.balance).toLocaleString('de-DE')}€</b>`;
      }

      return ctx.reply(welcomeBackText, { parse_mode: 'HTML', reply_markup: kb });
    }

    // ... (Rest der Registrierungslogik bleibt gleich)
    let promptText = `Willkommen bei <b>ValueTrade</b>! 📈\n\n` +
      `Bevor Onkel Heinrich dir dein Startkapital überweist, benötigst du einen <b>InGame-Namen</b>.\n\n` +
      `👉 <b>Antworte einfach auf diese Nachricht</b> mit deinem gewünschten Namen.\n` +
      `<i>(Erlaubt: a-z, A-Z, 0-9 | Min. 4 bis max. 16 Zeichen)</i>`;

    if (payload && payload.startsWith('ref_')) {
      const refId = payload.split('_')[1];
      if (Number(refId) !== tgId) {
        promptText += `\n\n🎁 <i>Ticket: REF-${refId}</i>`;
      }
    }

    return ctx.reply(promptText, {
      parse_mode: 'HTML',
      reply_markup: {
        force_reply: true,
        input_field_placeholder: 'Dein InGame-Name...'
      }
    });

  } catch (err) {
    console.error('Fehler im /start Befehl:', err);
    ctx.reply(`❌ Ups! Fehler: <b>${err.message || 'Unbekannt'}</b>\n\nBitte mache hiervon einen Screenshot!`, { parse_mode: 'HTML' });
  }
};

// ... (Rest der Datei startCommand.sendWelcomeMessage bleibt unverändert)
startCommand.sendWelcomeMessage = async (ctx, profile) => {
  const tgId = ctx.from.id;

  if (profile.referred_by) {
    try {
      const { data: referrer } = await db.supabase.from('profiles').select('telegram_id, balance, bonus_received').eq('telegram_id', profile.referred_by).single();
      
      if (referrer) {
        await db.supabase.from('profiles').update({
          balance: Number(referrer.balance || 0) + 500,
          bonus_received: Number(referrer.bonus_received || 0) + 500
        }).eq('telegram_id', referrer.telegram_id);

        try {
          await ctx.api.sendMessage(referrer.telegram_id, `🎉 <b>Neuer Freund beigetreten!</b>\n\nDein Freund <b>${esc(profile.username)}</b> hat sich registriert. Dir wurden soeben <b>500,00€</b> Affiliate-Bonus gutgeschrieben! 💸`, { parse_mode: 'HTML' });
        } catch(e) {}
      }

      await db.supabase.from('profiles').update({
        balance: Number(profile.balance || 10000) + 500,
        bonus_received: Number(profile.bonus_received || 0) + 500
      }).eq('id', profile.id);

      profile.balance = Number(profile.balance || 10000) + 500;
    } catch (err) {
      console.error('Referral Bonus Error:', err);
    }
  }

  let introText = `<i>Ich habe dir 10.000€ auf dein Konto überwiesen. Mach was Kluges daraus – investiere in Krypto, kauf dir Immobilien, werde reich!</i>`;
  let startKapitalText = `💰 <b>Startkapital: 10.000,00€</b>`;

  if (profile.referred_by) {
    introText = `<i>Ich habe dir 10.000€ auf dein Konto überwiesen. Da du von einem Freund eingeladen wurdest, lege ich noch 500€ Willkommens-Bonus oben drauf!</i>`;
    startKapitalText = `💰 <b>Startkapital: 10.500,00€</b> (Inkl. 500€ Bonus)`;
  }

  const welcomeMsg = await ctx.reply(
    `📨 <b>Ein Brief von Onkel Heinrich</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `<i>Mein lieber ${esc(profile.username)},</i>\n\n` +
    `${introText}\n\n` +
    `<i>Aber sei vorsichtig... wenn du alles verlierst, kann ich dir nur noch begrenzt helfen.</i>\n\n` +
    `<i>Dein Onkel Heinrich</i> 👴\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `${startKapitalText}\n` +
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
      .text('💎 Pro Features', 'pro');
      
    await ctx.reply('Bereit für deine erste Million? 🚀\n<i>PS: Schau dir die neuen Pro-Features an!</i>', { reply_markup: kb });
  }, 2000);

  const adminId = Number(process.env.ADMIN_ID);
  if (adminId) {
    try {
      await ctx.api.sendMessage(adminId,
        `🆕 <b>Neuer Spieler!</b>\n` +
        `🎮 InGame Username: <b>${esc(profile.username)}</b>\n` +
        `📱 Telegram Name: ${esc(ctx.from.first_name)}\n` +
        `🆔 <code>${tgId}</code>\n` +
        (profile.referred_by ? `🤝 Geworben von: <code>${profile.referred_by}</code>` : ''),
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }
};

module.exports = startCommand;
