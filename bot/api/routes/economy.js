const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');

router.get('/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { range } = req.query;

  try {
    const rangeMap = {
      '10m': 10,
      '30m': 30,
      '1m': 60,
      '3h': 180,
      '12h': 720,
      '24h': 1440
    };

    const minutes = rangeMap[range] || 180;
    
    const startTime = new Date(Date.now() - (minutes * 60 * 1000)).toISOString();

    const { data, error } = await db.supabase
      .from('market_history')
      .select('price_eur, recorded_at')
      .eq('symbol', symbol.toUpperCase())
      .gte('recorded_at', startTime)
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error("Supabase Chart Error:", error);
      throw error;
    }

    res.json({ 
      data: data || [],
      info: {
        symbol: symbol.toUpperCase(),
        range: range,
        count: data?.length || 0
      }
    });
  } catch (err) {
    console.error("Chart Route Error:", err);
    res.status(500).json({ error: 'Chart-Daten Fehler', details: err.message });
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

    const safeSeason = result.season || {
      id: 1,
      name: "Season 1",
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    res.json({ 
      leaders: result.leaders || [],
      season: safeSeason,
      pool: realTimePool || 0
    });
  } catch (err) {
    console.error('API Leaderboard Error:', err);
    res.json({
      leaders: [],
      season: { end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      pool: 0
    });
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
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
    
    const props = await db.getUserRealEstate(profile.id);
    res.json({ properties: props });
  } catch (err) {
    res.status(500).json({ error: 'Immobilien Fehler' });
  }
});

router.post('/realestate/collect', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
    
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
  const { type_id } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const { data: reType } = await db.supabase
      .from('real_estate_types')
      .select('*')
      .eq('id', type_id)
      .single();

    if (!reType) return res.status(404).json({ error: 'Immobilientyp nicht gefunden' });

    if (Number(profile.total_volume) < Number(reType.min_volume)) {
      return res.status(400).json({ error: 'Handelsvolumen zu gering für dieses Objekt' });
    }
    
    if (Number(profile.balance) < Number(reType.price_eur)) {
      return res.status(400).json({ error: 'Guthaben unzureichend' });
    }

    await db.updateBalance(profile.id, Number(profile.balance) - Number(reType.price_eur));
    await db.supabase.from('real_estate').insert({ 
      profile_id: profile.id, 
      type_id, 
      last_collect: new Date().toISOString() 
    });

    await db.supabase.from('transactions').insert({
      profile_id: profile.id,
      type: 'buy_realestate',
      symbol: 'HOUSE',
      total_eur: -Number(reType.price_eur),
      price_eur: 0,
      amount: 1,
      fee_eur: 0
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Kauf fehlgeschlagen' });
  }
});

module.exports = router;
