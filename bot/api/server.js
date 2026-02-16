// ============================================================
// API SERVER CONFIGURATION (api/server.js)
// ============================================================

const express = require('express');
const cors = require('cors');
const { VERSION } = require('../core/config');

// Import der Routen (Diese Dateien musst du noch in api/routes/ erstellen)
const tradingRoutes = require('./routes/trading');
const profileRoutes = require('./routes/profile');
const economyRoutes = require('./routes/economy');

/**
 * Initialisiert den Express Server
 * @param {Bot} bot - Die grammY Bot-Instanz
 */
function setupApi(bot) {
  const app = express();

  // 1. Global Middlewares
  app.use(cors());
  app.use(express.json());

  // Middleware: Telegram User Validierung & Bot-Instanz Injection
  app.use((req, res, next) => {
    // Wir hängen die Bot-Instanz an das Request-Objekt, 
    // damit Routen darauf zugreifen können (z.B. für Benachrichtigungen)
    req.bot = bot;
    next();
  });

  // 2. Health Check & Version
  app.get('/', (req, res) => {
    res.json({ 
      status: 'ok', 
      game: 'Krypto Trading Game', 
      version: VERSION 
    });
  });

  app.get('/api/version', (req, res) => res.json({ version: VERSION }));

  // 3. Routen-Module einbinden
  // Jedes Modul kümmert sich um seinen eigenen Präfix
  app.use('/api/trade', tradingRoutes);    // Alles rund um Buy/Sell/Prices
  app.use('/api/profile', profileRoutes);  // Profil-Daten & Transaktionen
  app.use('/api/economy', economyRoutes);  // Immobilien, Collectibles, Leverage

  // 4. Global Error Handler für die API
  app.use((err, req, res, next) => {
    console.error('❌ API Error:', err.stack);
    res.status(500).json({ error: 'Interner Server-Fehler' });
  });

  return app;
}

/**
 * Hilfsfunktion zur Validierung des Telegram-Users aus den Headern
 * Kann in den einzelnen Routen verwendet werden.
 */
function parseTelegramUser(req) {
  // In Production: Hier sollte initData validiert werden!
  const tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  return tgId ? Number(tgId) : null;
}

module.exports = { setupApi, parseTelegramUser };
