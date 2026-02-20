const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { VERSION } = require('../core/config');
const { db } = require('../core/database');
const { parseTelegramUser, getUserPermissions } = require('../auth'); // Importiere die neue Logik

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

function setupApi(bot) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // Middleware 1: Bot verfügbar machen
  app.use((req, res, next) => {
    req.bot = bot;
    next();
  });

  // Middleware 2: Zentrale Authentifizierung (v0.3.0 Fix)
  // Diese Middleware stellt sicher, dass der proCache befüllt ist
  const authMiddleware = async (req, res, next) => {
    // Öffentliche Pfade überspringen
    if (req.path === '/' || req.path === '/api/version' || req.path === '/api/stats/global') {
      return next();
    }

    try {
      const tgId = await parseTelegramUser(req); // Hier wird auf die DB gewartet!
      if (!tgId) {
        return res.status(401).json({ error: 'Nicht autorisiert' });
      }

      // Daten an req hängen, damit Routen nicht neu abfragen müssen
      req.tgId = tgId;
      req.permissions = getUserPermissions(tgId);
      
      next();
    } catch (err) {
      console.error("Auth Middleware Error:", err);
      res.status(401).json({ error: 'Authentifizierungs-Fehler' });
    }
  };

  app.get('/', (req, res) => {
    res.json({ 
      status: 'ok', 
      game: 'ValueTradeGame', 
      version: getGameVersion() 
    });
  });

  app.get('/api/version', (req, res) => res.json({ version: getGameVersion() }));

  app.get('/api/stats/global', async (req, res) => {
    try {
      const stats = await db.getStats();
      const pool = await db.getFeePool();
      const { count: openPositions } = await db.supabase
        .from('leveraged_positions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'OPEN');

      res.json({
        totalUsers: stats.userCount,
        totalTransactions: stats.txCount,
        currentFeePool: pool,
        activeTrades: openPositions || 0,
        serverTime: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: 'Stats konnten nicht geladen werden' });
    }
  });

  // Ab hier greift die Auth-Middleware für alle folgenden API-Routen
  app.use('/api', authMiddleware);

  app.get('/api/referrals', async (req, res) => {
    try {
      // Nutzt die ID aus der Middleware
      const { data, error } = await db.supabase
        .from('profiles')
        .select('username, first_name, avatar_url, created_at')
        .eq('referred_by', req.tgId)
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

module.exports = { setupApi };
