const { Bot } = require('grammy');
const { botConfig, ADMIN_ID } = require('./core/config');
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

bot.command('start', startCommand);
bot.command('portfolio', portfolioCommand);
bot.command(['rank', 'leaderboard'], economyCommands.handleLeaderboard);
bot.command('bailout', economyCommands.handleBailout);
bot.command('pro', economyCommands.handlePro);
bot.command('rent', economyCommands.handleRent);

bot.command('admin', adminCommands.dashboard);
bot.command('user', adminCommands.userInfo);
bot.command('setbalance', adminCommands.setBalance);
bot.command('broadcast', adminCommands.broadcast);

bot.on('message:story', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('story_bonus_claimed, balance_eur')
      .eq('telegram_id', userId)
      .single();

    if (profile && !profile.story_bonus_claimed) {
      const newBalance = (profile.balance_eur || 0) + 1000;
      await db.supabase
        .from('profiles')
        .update({ balance_eur: newBalance, story_bonus_claimed: true })
        .eq('telegram_id', userId);

      await ctx.reply("🌟 **Bonus aktiviert!**\n\nDanke für deine Story-Erwähnung! Ich habe dir soeben **1.000€ extra Guthaben** gutgeschrieben. Viel Erfolg beim Trading!");
    }
  } catch (e) {
    console.error('Story Bonus Fehler:', e);
  }
});

bot.on('message:text', async (ctx) => {
  if (ctx.message.text === 'Portfolio') {
    return portfolioCommand(ctx);
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
  const ctx = err.ctx;
  const e = err.error;
  if (!e.description?.includes('query is too old')) {
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
    
    setInterval(checkFeedbackUsers, 10 * 60 * 1000);

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
