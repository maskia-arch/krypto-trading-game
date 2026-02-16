const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');
const { COINS } = require('../../core/config');

// ─── CHARTS ─────────────────────────────────────────────────

router.get('/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { range } = req.query; // z.B. 1m, 3h, 12h, 24h

  try {
    // Zeit-Mapping in Minuten
    const rangeMap = {
      '1m': 10,   // Zeige die letzten 10 Min für den Live-Ticker
      '3h': 180,
      '12h': 720,
      '24h': 1440
    };

    const minutes = rangeMap[range] || 180;
    
    /**
     * ZEITKORREKTUR: 
     * Da der Server 1h (60 Min) zurückliegt, berechnen wir den Startpunkt
     * basierend auf UTC, um Synchronisationsfehler mit deinem Standort zu vermeiden.
     */
    const now = new Date();
    const startTime = new Date(now.getTime() - (minutes * 60 * 1000)).toISOString();

    // Abfrage der historischen Preisdaten
    const { data, error } = await db.supabase
      .from('price_history')
      .select('price_eur, recorded_at')
      .eq('symbol', symbol.toUpperCase())
      .gte('recorded_at', startTime) // Filtert ab dem berechneten Zeitpunkt
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    // WebApp erwartet Daten im Feld "data"
    res.json({ 
      data: data || [],
      info: {
        symbol: symbol.toUpperCase(),
        range: range,
        count: data?.length || 0
      }
    });
  } catch (err) {
    console.error('Chart-Fehler:', err);
    res.status(500).json({ error: 'Chart-Daten konnten nicht geladen werden' });
  }
});

// ─── REAL ESTATE (IMMOBILIEN) ───────────────────────────────

router.get('/realestate/types', async (req, res) => {
  try {
    const types = await db.getRealEstateTypes();
    res.json({ types });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Immobilientypen' });
  }
});

router.get('/realestate/mine', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const props = await db.getUserRealEstate(profile.id);
    res.json({ properties: props });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden deiner Immobilien' });
  }
});

router.post('/realestate/buy', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { type_id } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const { data: reType } = await db.supabase
      .from('real_estate_types')
      .select('*')
      .eq('id', type_id)
      .single();

    if (!reType) return res.status(404).json({ error: 'Immobilientyp nicht gefunden' });
    
    if (Number(profile.total_volume) < Number(reType.min_volume)) {
      return res.status(400).json({ error: `Mindest-Umsatz von ${reType.min_volume}€ benötigt!` });
    }
    
    if (Number(profile.balance) < Number(reType.price_eur)) {
      return res.status(400).json({ error: 'Nicht genug Guthaben auf dem Konto.' });
    }

    await db.updateBalance(profile.id, Number(profile.balance) - Number(reType.price_eur));
    await db.supabase.from('real_estate').insert({ profile_id: profile.id, type_id });

    res.json({ success: true, property: reType.name, cost: reType.price_eur });
  } catch (err) {
    res.status(500).json({ error: 'Kauf fehlgeschlagen' });
  }
});

// ─── COLLECTIBLES (BESITZTÜMER) ─────────────────────────────

router.get('/collectibles/types', async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('collectible_types')
      .select('*')
      .order('price_eur', { ascending: true });
    
    if (error) throw error;
    res.json({ types: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Besitztümer' });
  }
});

router.get('/collectibles/mine', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    const { data } = await db.supabase
      .from('collectibles')
      .select('*, collectible_types(*)')
      .eq('profile_id', profile.id);
    res.json({ collectibles: data });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden deiner Sammlung' });
  }
});

// ─── LEVERAGE (HEBEL) ───────────────────────────────────────

router.get('/leverage/positions', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

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
      const pnl = Number(pos.amount_eur) * pnlPercent;
      return { ...pos, current_price: currentPrice, unrealized_pnl: pnl };
    });

    res.json({ positions });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Positionen' });
  }
});

router.post('/leverage/open', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { symbol, direction, leverage, amount_eur } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    if (!profile.is_pro) return res.status(403).json({ error: 'Pro-Version benötigt' });
    if (Number(amount_eur) > Number(profile.balance)) return res.status(400).json({ error: 'Guthaben unzureichend' });

    const price = await db.getCurrentPrice(symbol);
    const liqPrice = direction === 'long'
      ? price * (1 - 1 / leverage)
      : price * (1 + 1 / leverage);

    await db.updateBalance(profile.id, Number(profile.balance) - Number(amount_eur));

    const { data: pos } = await db.supabase.from('leverage_positions').insert({
      profile_id: profile.id,
      symbol, direction, leverage,
      entry_price: price,
      amount_eur: Number(amount_eur),
      liquidation: liqPrice
    }).select().single();

    await db.logTransaction(profile.id, 'leverage', symbol, null, price, 0, Number(amount_eur));

    res.json({ success: true, position: pos });
  } catch (err) {
    res.status(500).json({ error: 'Position konnte nicht geöffnet werden' });
  }
});

module.exports = router;
