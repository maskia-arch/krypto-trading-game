// ============================================================
// API ROUTE: TRADING (api/routes/trading.js)
// ============================================================

const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../server');
const { COINS, FEE_RATE } = require('../../core/config');

/**
 * GET /api/trade/prices
 * Liefert die aktuellsten Kurse aller unterstützten Coins
 */
router.get('/prices', async (req, res) => {
  try {
    const prices = await db.getAllPrices();
    res.json({ prices });
  } catch (err) {
    res.status(500).json({ error: 'Preise konnten nicht geladen werden' });
  }
});

/**
 * GET /api/trade/chart/:symbol
 * Liefert historische Daten für Charts (3h, 12h, 24h)
 */
router.get('/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const range = req.query.range || '3h';
  
  const hoursMap = { '3h': 3, '12h': 12, '24h': 24 };
  const hours = hoursMap[range] || 3;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await db.supabase
      .from('market_history')
      .select('price_eur, recorded_at')
      .eq('symbol', symbol.toUpperCase())
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) throw error;
    res.json({ symbol: symbol.toUpperCase(), range, data: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Chart-Daten nicht verfügbar' });
  }
});

/**
 * POST /api/trade/execute
 * Führt einen Kauf oder Verkauf aus
 */
router.post('/execute', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { action, symbol, amount_eur, amount_crypto } = req.body;

  if (!['buy', 'sell'].includes(action)) return res.status(400).json({ error: 'Ungültige Aktion' });
  if (!COINS[symbol]) return res.status(400).json({ error: 'Unbekannter Coin' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const price = await db.getCurrentPrice(symbol);
    if (!price) return res.status(500).json({ error: 'Kein Kurs verfügbar' });

    if (action === 'buy') {
      const euroAmount = Number(amount_eur);
      if (euroAmount <= 0) return res.status(400).json({ error: 'Betrag zu klein' });

      const fee = euroAmount * FEE_RATE;
      const netAmount = euroAmount - fee;
      const cryptoAmount = netAmount / price;

      if (euroAmount > Number(profile.balance)) {
        return res.status(400).json({ error: 'Nicht genug Guthaben' });
      }

      // Transaktion ausführen
      await db.updateBalance(profile.id, Number(profile.balance) - euroAmount);
      await db.upsertAsset(profile.id, symbol, cryptoAmount, price);
      await db.addToFeePool(fee);
      await db.addVolume(profile.id, euroAmount);
      await db.logTransaction(profile.id, 'buy', symbol, cryptoAmount, price, fee, euroAmount);

      res.json({ success: true, action: 'buy', crypto_amount: cryptoAmount, fee });

    } else {
      // SELL Logik
      const asset = await db.getAsset(profile.id, symbol);
      if (!asset || Number(asset.amount) <= 0) {
        return res.status(400).json({ error: 'Kein Bestand' });
      }

      const sellAmount = amount_crypto ? Math.min(Number(amount_crypto), Number(asset.amount)) : Number(asset.amount);
      const grossEuro = sellAmount * price;
      const fee = grossEuro * FEE_RATE;
      const netEuro = grossEuro - fee;

      await db.upsertAsset(profile.id, symbol, -sellAmount, 0);
      await db.updateBalance(profile.id, Number(profile.balance) + netEuro);
      await db.addToFeePool(fee);
      await db.addVolume(profile.id, grossEuro);
      await db.logTransaction(profile.id, 'sell', symbol, sellAmount, price, fee, netEuro);

      res.json({ success: true, action: 'sell', euro_received: netEuro, fee });
    }
  } catch (err) {
    console.error('Trade Error:', err);
    res.status(500).json({ error: 'Trade fehlgeschlagen' });
  }
});

module.exports = router;
