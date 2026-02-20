const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');

router.get('/positions', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const positions = await db.getOpenLeveragedPositions(profile.id);
    
    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
    const isMonday = new Date().getDay() === 1;
    const maxLeverage = (isPro || isMonday) ? 10 : 5;
    const maxPositions = isPro ? 3 : 1;

    res.json({ 
      positions,
      policy: { maxLeverage, maxPositions, isPro, isMonday }
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Positionen' });
  }
});

router.post('/open', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { symbol, direction, collateral, leverage } = req.body;
  if (!symbol || !direction || !collateral || !leverage) {
    return res.status(400).json({ error: 'Fehlende Parameter' });
  }

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const prices = await db.getAllPrices();
    const currentPriceObj = prices.find(p => p.symbol === symbol);
    if (!currentPriceObj) return res.status(400).json({ error: 'Coin nicht gefunden' });

    const newPosition = await db.openLeveragedPosition(
      profile.id,
      symbol,
      direction,
      collateral,
      leverage,
      currentPriceObj.price_eur
    );

    res.json({ success: true, position: newPosition });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/close', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { position_id } = req.body;
  if (!position_id) return res.status(400).json({ error: 'Fehlende Position ID' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const { data: pos } = await db.supabase
      .from('leveraged_positions')
      .select('symbol, profile_id')
      .eq('id', position_id)
      .single();

    if (!pos) return res.status(404).json({ error: 'Position nicht gefunden' });
    if (pos.profile_id !== profile.id) return res.status(403).json({ error: 'Nicht deine Position' });

    const prices = await db.getAllPrices();
    const currentPriceObj = prices.find(p => p.symbol === pos.symbol);
    
    if (!currentPriceObj) return res.status(400).json({ error: 'Preis nicht verfügbar' });

    const result = await db.closeLeveragedPosition(position_id, currentPriceObj.price_eur, false);

    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
