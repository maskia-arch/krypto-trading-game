const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');
const { COINS, FEE_RATE } = require('../../core/config');

// Ticker-Preise (falls useGameData diese Route nutzt)
router.get('/prices', async (req, res) => {
  try {
    const prices = await db.getAllPrices();
    res.json({ prices });
  } catch (err) {
    res.status(500).json({ error: 'Preise konnten nicht geladen werden' });
  }
});

// Chart-Daten (redundant zu economy.js, aber sicherheitshalber hier stabilisiert)
router.get('/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const range = req.query.range || '3h';
  
  const hoursMap = { '3h': 3, '12h': 12, '24h': 24 };
  const hours = hoursMap[range] || 3;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await db.supabase
      .from('market_history') // Prüfe ob Tabelle 'market_history' oder 'price_history' heißt
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

// Haupt-Route für Trades (Kauf & Verkauf)
// Route geändert von /execute auf / (da die WebApp /api/trade aufruft)
router.post('/', async (req, res) => {
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
      if (!euroAmount || euroAmount <= 0) return res.status(400).json({ error: 'Ungültiger Euro-Betrag' });

      const fee = euroAmount * (FEE_RATE || 0.005);
      const netAmount = euroAmount - fee;
      const cryptoAmount = netAmount / price;

      if (euroAmount > Number(profile.balance)) {
        return res.status(400).json({ error: 'Guthaben unzureichend' });
      }

      // Datenbank-Updates
      await db.updateBalance(profile.id, Number(profile.balance) - euroAmount);
      await db.upsertAsset(profile.id, symbol, cryptoAmount, price);
      if (db.addToFeePool) await db.addToFeePool(fee);
      await db.addVolume(profile.id, euroAmount);
      await db.logTransaction(profile.id, 'buy', symbol, cryptoAmount, price, fee, euroAmount);

      res.json({ 
        success: true, 
        action: 'buy', 
        crypto_amount: cryptoAmount, 
        fee: fee,
        balance: Number(profile.balance) - euroAmount 
      });

    } else if (action === 'sell') {
      const asset = await db.getAsset(profile.id, symbol);
      if (!asset || Number(asset.amount) <= 0) {
        return res.status(400).json({ error: 'Kein Bestand zum Verkaufen vorhanden' });
      }

      // Wenn amount_crypto nicht gesendet wird, verkaufe alles
      const sellAmount = amount_crypto ? Math.min(Number(amount_crypto), Number(asset.amount)) : Number(asset.amount);
      if (sellAmount <= 0) return res.status(400).json({ error: 'Ungültige Menge' });

      const grossEuro = sellAmount * price;
      const fee = grossEuro * (FEE_RATE || 0.005);
      const netEuro = grossEuro - fee;

      // Datenbank-Updates
      await db.upsertAsset(profile.id, symbol, -sellAmount, 0);
      await db.updateBalance(profile.id, Number(profile.balance) + netEuro);
      if (db.addToFeePool) await db.addToFeePool(fee);
      await db.addVolume(profile.id, grossEuro);
      await db.logTransaction(profile.id, 'sell', symbol, sellAmount, price, fee, netEuro);

      res.json({ 
        success: true, 
        action: 'sell', 
        euro_received: netEuro, 
        fee: fee,
        balance: Number(profile.balance) + netEuro 
      });
    }
  } catch (err) {
    console.error('Trade Error:', err);
    res.status(500).json({ error: 'Transaktion fehlgeschlagen' });
  }
});

module.exports = router;
