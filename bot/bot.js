// ============================================================
// VALUETRADEGAME - Main Entry Point (bot.js)
// ============================================================

const { Bot } = require('grammy');
const { botConfig, ADMIN_ID } = require('./core/config');
const { db } = require('./core/database');
const { setupApi } = require('./api/server');
const { setupCronJobs } = require('./cron/scheduler');

// Handler-Importe
const startCommand = require('./commands/start');
const portfolioCommand = require('./commands/portfolio'); // Hier liegt die Logik für sendPortfolio
const adminCommands = require('./commands/admin');
const economyCommands = require('./commands/economy');
const callbackHandler = require('./callbacks/handler');
const { priceService } = require('./services/priceService');

// 1. Bot Initialisierung
const bot = new Bot(botConfig.token);

// 2. Befehle registrieren (Commands)
bot.command('start', startCommand);
bot.command('portfolio', portfolioCommand);
bot.command(['rank', 'leaderboard'], economyCommands.handleLeaderboard);
bot.command('bailout', economyCommands.handleBailout);
bot.command('pro', economyCommands.handlePro);
bot.command('rent', economyCommands.handleRent);

// Admin-Befehle
bot.command('admin', adminCommands.dashboard);
bot.command('user', adminCommands.userInfo);
bot.command('setbalance', adminCommands.setBalance);
bot.command('broadcast', adminCommands.broadcast);

// 3. Text-Hörer (Für Menü-Buttons)
bot.on('message:text', async (ctx) => {
  // Reagiert auf den Text-Button "Portfolio" in der Tastatur
  if (ctx.message.text === 'Portfolio') {
    return portfolioCommand(ctx);
  }
});

// 4. Interaktionen (Callbacks & Buttons)
// Reagiert auf alle Inline-Buttons (inkl. refresh_portfolio)
bot.on('callback_query:data', callbackHandler);

// 5. Fehlerbehandlung
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`❌ Fehler bei Update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e.description?.includes('query is too old')) {
    console.log('  → Alte Callback-Query ignoriert.');
  } else {
    console.error('  →', e.message || e);
  }
});

// 6. Start-Sequenz
async function startApp() {
  try {
    // Initialer Preis-Fetch beim Start
    await priceService.fetchAndStorePrices();
    console.log('✅ Marktdaten für ValueTradeGame geladen');

    // Express API Server starten
    const app = setupApi(bot);
    app.listen(botConfig.port, () => {
      console.log(`🌐 API Server läuft auf Port ${botConfig.port}`);
    });

    // Cron Jobs aktivieren
    setupCronJobs(bot);
    console.log('⏰ Scheduler aktiv (1 Min Intervalle für Live-Charts)');

    // Bot starten
    bot.start({
      drop_pending_updates: true,
      onStart: (info) => console.log(`🤖 @${info.username} (ValueTradeGame) ist online!`)
    });

  } catch (err) {
    console.error('💀 Kritischer Fehler beim Start:', err);
    process.exit(1);
  }
}

startApp();

// Graceful Shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
