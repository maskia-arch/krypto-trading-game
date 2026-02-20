const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');

router.get('/positions', async (req, res) => {
  try {
    // Profil laden für Kontostand und Detailinfos
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const positions = await db.getOpenLeveragedPositions(profile.id);
    const history = await db.getLeverageHistory ? await db.getLeverageHistory(profile.id) : [];
    
    // Pro-Status direkt aus den Middleware-Permissions beziehen
    const isPro = req.permissions.isPro;
    const isMonday = new Date().getDay() === 1;
    const maxLeverage = (isPro || isMonday) ? 10 : 5;
    const maxPositions = isPro ? 3 : 1;

    res.json({ 
      positions,
      history,
      policy: { maxLeverage, maxPositions, isPro, isMonday }
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Positionen' });
  }
});

router.post('/open', async (req, res) => {
  const { symbol, direction, collateral, leverage, stop_loss, take_profit, limit_price, trailing_stop } = req.body;
  
  if (!symbol || !direction || !collateral || !leverage) {
    return res.status(400).json({ error: 'Fehlende Basis-Parameter' });
  }

  try {
    const profile = await db.getProfile(req.tgId);
    const isPro = req.permissions.isPro;
    
    // Validierung der Pro-Features basierend auf Middleware-Permissions
    if (!isPro && (stop_loss || take_profit || limit_price || trailing_stop)) {
      return res.status(403).json({ error: 'Diese Funktionen sind nur für Pro-Mitglieder verfügbar.' });
    }

    const prices = await db.getAllPrices();
    const currentPriceObj = prices.find(p => p.symbol === symbol.toUpperCase());
    if (!currentPriceObj) return res.status(400).json({ error: 'Coin nicht gefunden' });

    const options = {
      stop_loss: stop_loss ? Number(stop_loss) : null,
      take_profit: take_profit ? Number(take_profit) : null,
      limit_price: limit_price ? Number(limit_price) : null,
      trailing_stop: !!trailing_stop
    };

    const newPosition = await db.openLeveragedPosition(
      profile.id,
      symbol.toUpperCase(),
      direction,
      Number(collateral),
      Number(leverage),
      currentPriceObj.price_eur,
      options
    );

    res.json({ success: true, position: newPosition });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/partial-close', async (req, res) => {
  const { position_id, percentage } = req.body;
  
  try {
    const profile = await db.getProfile(req.tgId);
    const result = await db.partialCloseLeveragedPosition(position_id, profile.id, percentage || 0.5);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/close', async (req, res) => {
  const { position_id } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    const { data: pos } = await db.supabase
      .from('leveraged_positions')
      .select('symbol, profile_id')
      .eq('id', position_id)
      .single();

    if (!pos || pos.profile_id !== profile.id) {
      return res.status(403).json({ error: 'Position nicht gefunden oder Zugriff verweigert' });
    }

    const prices = await db.getAllPrices();
    const currentPriceObj = prices.find(p => p.symbol === pos.symbol);
    
    const result = await db.closeLeveragedPosition(position_id, currentPriceObj.price_eur, false);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
