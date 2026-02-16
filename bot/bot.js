// ============================================================
// KRYPTO TRADING GAME - Main Entry Point (bot.js)
// ============================================================

const { Bot } = require('grammy');
const { botConfig, ADMIN_ID } = require('./core/config');
const { db } = require('./core/database');
const { setupApi } = require('./api/server');
const { setupCronJobs } = require('./cron/scheduler');

// Handler-Importe (Diese Dateien enthalten die Logik)
const startCommand = require('./commands/start');
const portfolioCommand = require('./commands/portfolio');
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

// 3. Interaktionen (Callbacks & Buttons)
bot.on('callback_query:data', callbackHandler);

// 4. Fehlerbehandlung
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

// 5. Start-Sequenz
async function startApp() {
  try {
    // Initialer Preis-Fetch beim Start
    await priceService.fetchAndStorePrices();
    console.log('✅ Initiale Marktdaten geladen');

    // Express API Server starten
    const app = setupApi(bot); // Wir übergeben die bot-Instanz für API-Meldungen
    app.listen(botConfig.port, () => {
      console.log(`🌐 API Server läuft auf Port ${botConfig.port}`);
    });

    // Cron Jobs aktivieren
    setupCronJobs(bot);
    console.log('⏰ Scheduler aktiv');

    // Bot starten
    bot.start({
      drop_pending_updates: true,
      onStart: (info) => console.log(`🤖 Bot gestartet: @${info.username}`)
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
