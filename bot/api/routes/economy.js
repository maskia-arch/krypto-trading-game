const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');

router.get('/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { range } = req.query;

  try {
    const rangeMap = {
      '30m': 30,
      '1m': 60,
      '3h': 180,
      '12h': 720,
      '24h': 1440
    };

    const minutes = rangeMap[range] || 180;
    const startTime = new Date(Date.now() - ((minutes + 120) * 60 * 1000)).toISOString();

    const { data, error } = await db.supabase
      .from('market_history')
      .select('price_eur, recorded_at')
      .eq('symbol', symbol.toUpperCase())
      .gte('recorded_at', startTime)
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    res.json({ 
      data: data || [],
      info: {
        symbol: symbol.toUpperCase(),
        range: range,
        count: data?.length || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Chart-Daten Fehler' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const { filter } = req.query;
    
    let dbFilter = 'profit_season';
    if (filter) {
      const f = String(filter).toLowerCase();
      if (f.includes('loss')) {
        dbFilter = f.includes('24') ? 'loss_24h' : 'loss_season';
      } else {
        dbFilter = f.includes('24') ? 'profit_24h' : 'profit_season';
      }
    }

    const result = await db.getLeaderboard(dbFilter);
    const realTimePool = await db.getFeePool();

    res.json({ 
      leaders: result.leaders || [],
      season: result.season,
      pool: realTimePool
    });
  } catch (err) {
    console.error('API Leaderboard Error:', err);
    res.status(500).json({ error: 'Leaderboard Fehler' });
  }
});

router.get('/realestate/types', async (req, res) => {
  try {
    const types = await db.getRealEstateTypes();
    res.json({ types });
  } catch (err) {
    res.status(500).json({ error: 'Immobilien-Typen Fehler' });
  }
});

router.get('/realestate/mine', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const profile = await db.getProfile(tgId);
    const props = await db.getUserRealEstate(profile.id);
    res.json({ properties: props });
  } catch (err) {
    res.status(500).json({ error: 'Immobilien Fehler' });
  }
});

router.post('/realestate/buy', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Unauthorized' });

  const { type_id } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    const { data: reType } = await db.supabase
      .from('real_estate_types')
      .select('*')
      .eq('id', type_id)
      .single();

    if (Number(profile.total_volume) < Number(reType.min_volume)) {
      return res.status(400).json({ error: 'Umsatz zu gering' });
    }
    
    if (Number(profile.balance) < Number(reType.price_eur)) {
      return res.status(400).json({ error: 'Guthaben zu gering' });
    }

    await db.updateBalance(profile.id, Number(profile.balance) - Number(reType.price_eur));
    await db.supabase.from('real_estate').insert({ 
      profile_id: profile.id, 
      type_id, 
      last_collect: new Date().toISOString() 
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Kauf Fehler' });
  }
});

router.get('/collectibles/types', async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('collectible_types')
      .select('*')
      .order('price_eur', { ascending: true });
    
    if (error) throw error;
    res.json({ types: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Collectibles Fehler' });
  }
});

router.get('/collectibles/mine', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const profile = await db.getProfile(tgId);
    const { data } = await db.supabase
      .from('collectibles')
      .select('*, collectible_types(*)')
      .eq('profile_id', profile.id);
    res.json({ collectibles: data });
  } catch (err) {
    res.status(500).json({ error: 'Sammlung Fehler' });
  }
});

module.exports = router;
