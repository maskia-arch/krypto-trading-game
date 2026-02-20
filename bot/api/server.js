const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { VERSION } = require('../core/config');
const { db } = require('../core/database');

const tradingRoutes = require('./routes/trading');
const profileRoutes = require('./routes/profile');
const economyRoutes = require('./routes/economy');
const collectiblesRoutes = require('./routes/collectibles');
const leverageRoutes = require('./routes/leverage');

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

function parseTelegramUser(req) {
  const tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  return tgId ? Number(tgId) : null;
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

  app.get('/api/referrals', async (req, res) => {
    const tgId = parseTelegramUser(req);
    if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

    try {
      const { data, error } = await db.supabase
        .from('profiles')
        .select('username, first_name, avatar_url, created_at')
        .eq('referred_by', tgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ referrals: data || [] });
    } catch (err) {
      console.error('Referrals API Error:', err);
      res.status(500).json({ error: 'Server Fehler beim Laden der Referrals' });
    }
  });

  app.use('/api/trade', tradingRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/economy/collectibles', collectiblesRoutes);
  app.use('/api/economy', economyRoutes);
  app.use('/api/leverage', leverageRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Interner Server-Fehler' });
  });

  return app;
}

module.exports = { setupApi, parseTelegramUser };
