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
    // v0.3.0: Puffer erhöht auf 150 Min für stabilere Chart-Anzeige
    const startTime = new Date(Date.now() - ((minutes + 150) * 60 * 1000)).toISOString();

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

// NEU: Miete direkt über die WebApp einsammeln
router.post('/realestate/collect', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const profile = await db.getProfile(tgId);
    const collected = await db.collectRent(profile.id);
    
    res.json({ 
      success: true, 
      amount: collected, 
      message: collected > 0 ? `${collected.toFixed(2)}€ Miete erhalten!` : 'Noch keine Miete fällig.' 
    });
  } catch (err) {
    res.status(500).json({ error: 'Miet-Sammeln fehlgeschlagen' });
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
      return res.status(400).json({ error: 'Umsatz zu gering für dieses Objekt' });
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

    // Transaktion loggen
    await db.supabase.from('transactions').insert({
      profile_id: profile.id,
      type: 'buy_realestate',
      symbol: 'HOUSE',
      total_eur: -Number(reType.price_eur),
      details: `Kauf: ${reType.name}`
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Kauf Fehler' });
  }
});

module.exports = router;
