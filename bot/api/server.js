const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { VERSION } = require('../core/config');

const tradingRoutes = require('./routes/trading');
const profileRoutes = require('./routes/profile');
const economyRoutes = require('./routes/economy');

function getGameVersion() {
  try {
    const versionPath = path.join(__dirname, '../../version.txt');
    if (fs.existsSync(versionPath)) {
      return fs.readFileSync(versionPath, 'utf8').trim();
    }
    return VERSION;
  } catch (e) {
    return VERSION;
  }
}

function setupApi(bot) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.use((req, res, next) => {
    req.bot = bot;
    next();
  });

  app.get('/', (req, res) => {
    res.json({ 
      status: 'ok', 
      game: 'ValueTradeGame', 
      version: getGameVersion() 
    });
  });

  app.get('/api/version', (req, res) => res.json({ version: getGameVersion() }));

  app.use('/api/trade', tradingRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/economy', economyRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Interner Server-Fehler' });
  });

  return app;
}

function parseTelegramUser(req) {
  const tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  return tgId ? Number(tgId) : null;
}

module.exports = { setupApi, parseTelegramUser };
