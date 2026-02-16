const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');

router.get('/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { range } = req.query;

  try {
    const rangeMap = {
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
    const { data, error } = await db.supabase
      .from('profiles')
      .select('username, first_name, balance, total_volume, telegram_id')
      .order('balance', { ascending: false })
      .limit(20);

    if (error) throw error;

    const pool = await db.getFeePool();
    const activeSeason = await db.getActiveSeason();

    res.json({ 
      leaders: data || [],
      season: activeSeason ? activeSeason.name : "Season 1",
      pool: pool
    });
  } catch (err) {
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

router.get('/leverage/positions', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const profile = await db.getProfile(tgId);
    const { data } = await db.supabase
      .from('leverage_positions')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('is_open', true);

    const prices = await db.getAllPrices();
    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    const positions = (data || []).map(pos => {
      const currentPrice = priceMap[pos.symbol] || Number(pos.entry_price);
      const priceDiff = currentPrice - Number(pos.entry_price);
      const pnlMultiplier = pos.direction === 'long' ? 1 : -1;
      const pnlPercent = (priceDiff / Number(pos.entry_price)) * pos.leverage * pnlMultiplier;
      return { ...pos, current_price: currentPrice, unrealized_pnl: Number(pos.amount_eur) * pnlPercent };
    });

    res.json({ positions });
  } catch (err) {
    res.status(500).json({ error: 'Hebel Fehler' });
  }
});

router.post('/leverage/open', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Unauthorized' });

  const { symbol, direction, leverage, amount_eur } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    if (!profile.is_pro) return res.status(403).json({ error: 'Pro benötigt' });
    if (Number(amount_eur) > Number(profile.balance)) return res.status(400).json({ error: 'Guthaben unzureichend' });

    const price = await db.getCurrentPrice(symbol);
    const liqPrice = direction === 'long' ? price * (1 - 1 / leverage) : price * (1 + 1 / leverage);

    await db.updateBalance(profile.id, Number(profile.balance) - Number(amount_eur));

    await db.supabase.from('leverage_positions').insert({
      profile_id: profile.id,
      symbol, direction, leverage,
      entry_price: price,
      amount_eur: Number(amount_eur),
      liquidation: liqPrice,
      is_open: true
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Hebel Fehler' });
  }
});

module.exports = router;
