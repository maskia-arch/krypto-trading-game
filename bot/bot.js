const { Bot, InlineKeyboard } = require('grammy');
const { botConfig, ADMIN_ID, BONUS_CLAIM_URL } = require('./core/config');
const { db } = require('./core/database');
const { setupApi } = require('./api/server');
const { setupCronJobs } = require('./cron/scheduler');

const startCommand = require('./commands/start');
const portfolioCommand = require('./commands/portfolio');
const adminCommands = require('./commands/admin');
const economyCommands = require('./commands/economy');
const callbackHandler = require('./callbacks/handler');
const { priceService } = require('./services/priceService');

const bot = new Bot(botConfig.token);

bot.command('start', async (ctx) => {
  if (ctx.match === 'claim_bonus') {
    const profile = await db.getProfile(ctx.from.id);
    if (profile && profile.claimable_bonus > 0 && !profile.inactivity_bonus_claimed) {
      const kb = new InlineKeyboard().url('💰 Jetzt 500€ Bonus einlösen', BONUS_CLAIM_URL);
      return ctx.reply(
        "🎁 <b>Dein Inaktivitäts-Bonus ist bereit!</b>\n\nKlicke auf den Button unten, um die App zu öffnen und deine 500,00€ automatisch gutgeschrieben zu bekommen.",
        { parse_mode: 'HTML', reply_markup: kb }
      );
    }
  }
  return startCommand(ctx);
});

bot.command('portfolio', portfolioCommand);
bot.command(['rank', 'leaderboard'], economyCommands.handleLeaderboard);
bot.command('bailout', economyCommands.handleBailout);
bot.command('pro', economyCommands.handlePro);
bot.command('rent', economyCommands.handleRent);

bot.command('settings', async (ctx) => {
  const profile = await db.getProfile(ctx.from.id);
  if (!profile) return;

  let statusText = 'Standard';
  if (profile.is_admin) {
    statusText = 'Admin (Pro-Features aktiv)';
  } else if (profile.is_pro && new Date(profile.pro_until) > new Date()) {
    statusText = 'Pro-Mitglied';
  }

  const kb = new InlineKeyboard()
    .text('✏️ Name ändern', 'set_name_start')
    .row()
    .text('🗑️ Account löschen', 'set_delete_start')
    .row()
    .text('❌ Schließen', 'close');

  return ctx.reply(
    `⚙️ <b>Einstellungen</b>\n\n` +
    `👤 Name: <b>${profile.username || profile.first_name}</b>\n` +
    `⭐ Status: ${statusText}\n` +
    `📝 Namensänderungen: ${profile.username_changes || 0}\n\n` +
    `Wähle eine Option:`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
});

bot.command('admin', adminCommands.dashboard);
bot.command('user', adminCommands.userInfo);
bot.command('setbalance', adminCommands.setBalance);
bot.command('broadcast', adminCommands.broadcast);
bot.command('setpro', adminCommands.setPro);

bot.on('message:story', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('id, story_bonus_claimed, balance, bonus_received')
      .eq('telegram_id', userId)
      .single();

    if (!profile) return;
    if (profile.story_bonus_claimed) {
      return ctx.reply("ℹ️ Du hast den Story-Bonus bereits erhalten.", { parse_mode: 'HTML' });
    }

    // v0.3.22: Atomares Update — nur erfolgreich wenn story_bonus_claimed NOCH false ist
    const bonusAmount = 1000.00;
    const { data: updated, error } = await db.supabase
      .from('profiles')
      .update({ 
        balance: Number(profile.balance) + bonusAmount, 
        story_bonus_claimed: true,
        bonus_received: Number(profile.bonus_received || 0) + bonusAmount
      })
      .eq('id', profile.id)
      .eq('story_bonus_claimed', false)
      .select('id');

    // Wenn kein Row aktualisiert wurde → bereits geclaimed (Race Condition abgefangen)
    if (error || !updated || updated.length === 0) {
      return ctx.reply("ℹ️ Du hast den Story-Bonus bereits erhalten.", { parse_mode: 'HTML' });
    }

    await db.supabase.from('transactions').insert({
      profile_id: profile.id,
      type: 'achievement_reward',
      symbol: 'STORY',
      total_eur: bonusAmount,
      details: 'Story Bonus Belohnung'
    });

    await ctx.reply("🌟 <b>Bonus aktiviert!</b>\n\nDanke für deine Story-Erwähnung! Ich habe dir soeben <b>1.000€ extra Guthaben</b> gutgeschrieben. Viel Erfolg beim Trading!", { parse_mode: 'HTML' });
  } catch (e) {
    console.error('Story Bonus Fehler:', e);
  }
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;

  if (text.includes('Portfolio')) {
    return portfolioCommand(ctx);
  }

  if (ctx.message.reply_to_message && ctx.message.reply_to_message.text.includes('InGame-Namen')) {
    if (text.length < 4 || text.length > 16) {
      return ctx.reply("❌ Der Name muss zwischen 4 und 16 Zeichen lang sein. Bitte antworte erneut auf meine vorherige Nachricht.", { reply_markup: { force_reply: true } });
    }
    
    if (!/^[a-zA-Z0-9]+$/.test(text)) {
      return ctx.reply("❌ Nur Buchstaben (a-z, A-Z) und Zahlen (0-9) sind erlaubt. Bitte antworte erneut auf meine vorherige Nachricht.", { reply_markup: { force_reply: true } });
    }

    let referredBy = null;
    const refMatch = ctx.message.reply_to_message.text.match(/Ticket: REF-(\d+)/);
    if (refMatch) {
      referredBy = Number(refMatch[1]);
    }

    try {
      const taken = await db.isUsernameTaken(text);
      if (taken) {
        return ctx.reply("❌ Dieser Name ist bereits vergeben. Bitte wähle einen anderen und antworte erneut auf meine Nachricht.", { reply_markup: { force_reply: true } });
      }

      const profile = await db.createProfile(userId, text, ctx.from.first_name, referredBy);
      return startCommand.sendWelcomeMessage(ctx, profile);
    } catch (e) {
      return ctx.reply(`❌ Fehler bei der Registrierung: ${e.message}`);
    }
  }

  if (ctx.message.reply_to_message && ctx.message.reply_to_message.text.includes('✍️')) {
    if (text.length < 4 || text.length > 16) {
      return ctx.reply("❌ Der Name muss zwischen 4 und 16 Zeichen lang sein.");
    }
    if (!/^[a-zA-Z0-9]+$/.test(text)) {
      return ctx.reply("❌ Nur Buchstaben und Zahlen sind erlaubt. Keine Leer- oder Sonderzeichen.");
    }

    try {
      const profile = await db.getProfile(userId);
      const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
      
      await db.updateUsername(userId, text, isPro);
      return ctx.reply(`✅ Dein Name wurde erfolgreich in <b>${text}</b> geändert!`, { parse_mode: 'HTML' });
    } catch (e) {
      return ctx.reply(`❌ Fehler: ${e.message}`);
    }
  }

  const deleteMatch = text.match(/^Delete \((\d+)\)$/i);
  if (deleteMatch) {
    const tgId = Number(deleteMatch[1]);
    if (tgId !== ctx.from.id) return ctx.reply("❌ Die ID stimmt nicht mit deinem Account überein.");

    try {
      const profile = await db.getProfile(tgId);
      if (!profile) return;

      const { data: request } = await db.supabase
        .from('deletion_requests')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!request) {
        return ctx.reply("❌ Bitte stelle zuerst den Löschantrag in den Einstellungen.");
      }

      const kb = new InlineKeyboard()
        .text('🗑️ Unwiderruflich Löschen', `confirm_delete:${profile.id}`)
        .text('❌ Ablehnen', `reject_delete:${profile.id}`);

      await bot.api.sendMessage(ADMIN_ID, 
        `⚠️ <b>LÖSCHANTRAG BESTÄTIGT</b>\n\n` +
        `User: ${profile.first_name} (@${profile.username || '-'})\n` +
        `ID: <code>${tgId}</code>\n\n` +
        `Der User hat die Löschung manuell verifiziert. Jetzt final löschen?`,
        { parse_mode: 'HTML', reply_markup: kb }
      );

      return ctx.reply("⏳ Deine Identität wurde bestätigt. Der Administrator wurde benachrichtigt und wird die Löschung final bearbeiten.");
    } catch (e) {
      console.error('Delete Verification Error:', e);
    }
  }
});

bot.on('callback_query:data', callbackHandler);

const checkFeedbackUsers = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: users } = await db.supabase
      .from('profiles')
      .select('telegram_id, username')
      .lt('created_at', oneHourAgo)
      .eq('feedback_sent', false);

    if (users && users.length > 0) {
      for (const user of users) {
        try {
          await bot.api.sendMessage(user.telegram_id, 
            `Hey ${user.username || 'Trader'}! 👋\n\nDu bist jetzt seit einer Stunde dabei. Wie gefällt dir das Game bisher?\n\n💡 **Tipp:** Wenn du uns in deiner **Telegram Story** erwähnst, schenke ich dir einmalig **1.000€ Startguthaben**! Probier es direkt aus.`
          );
          await db.supabase.from('profiles').update({ feedback_sent: true }).eq('telegram_id', user.telegram_id);
        } catch (msgErr) {
          console.error(`Konnte Feedback an ${user.telegram_id} nicht senden.`);
        }
      }
    }
  } catch (e) {
    console.error('Feedback Trigger Fehler:', e);
  }
};

bot.catch((err) => {
  const e = err.error;
  if (!e.description?.includes('query is too old') && !e.description?.includes('message is not modified')) {
    console.error(`❌ Fehler:`, e.message || e);
  }
});

async function startApp() {
  try {
    await priceService.fetchAndStorePrices();
    
    const app = setupApi(bot);
    app.listen(botConfig.port, () => {
      console.log(`🌐 API Server läuft auf Port ${botConfig.port}`);
    });

    setupCronJobs(bot);

    if (db.cleanupExpiredBackgrounds) {
      await db.cleanupExpiredBackgrounds();
    }
    
    setInterval(checkFeedbackUsers, 10 * 60 * 1000);
    setInterval(async () => {
      if (db.cleanupExpiredBackgrounds) await db.cleanupExpiredBackgrounds();
    }, 24 * 60 * 60 * 1000);

    bot.start({
      drop_pending_updates: true,
      onStart: (info) => console.log(`🤖 @${info.username} ist online!`)
    });

  } catch (err) {
    console.error('💀 Startfehler:', err);
    process.exit(1);
  }
}

startApp();

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());