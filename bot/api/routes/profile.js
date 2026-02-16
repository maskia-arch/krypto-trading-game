const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');

// Haupt-Profil-Route: Lädt Profil, Assets und aktuelle Preise
router.get('/', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const assets = await db.getAssets(profile.id);
    const prices = await db.getAllPrices();

    res.json({ 
      profile, 
      assets, 
      prices 
    });
  } catch (err) {
    console.error('Profile Fetch Error:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen des Profils' });
  }
});

// Separate Preis-Route für das schnelle Polling (Ticker/Chart-Updates)
router.get('/prices', async (req, res) => {
  try {
    const prices = await db.getAllPrices();
    res.json({ prices });
  } catch (err) {
    console.error('Price Fetch Error:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Preise' });
  }
});

// Transaktionsverlauf für die RankView (History-Tab)
router.get('/transactions', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const { data, error } = await db.supabase
      .from('transactions')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ transactions: data || [] });
  } catch (err) {
    console.error('Transaction Fetch Error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Transaktionen' });
  }
});

// Miete einsammeln für die AssetsView
router.post('/collect-rent', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    // Führt die Logik in der Datenbank aus (berechnet fällige Miete seit letztem Collect)
    const rentCollected = await db.collectRent(profile.id);
    const updatedProfile = await db.getProfile(tgId);

    res.json({ 
      success: true,
      rent_collected: Number(rentCollected || 0), 
      new_balance: Number(updatedProfile.balance) 
    });
  } catch (err) {
    console.error('Rent Collection Error:', err);
    res.status(500).json({ error: err.message || 'Miete konnte nicht eingesammelt werden' });
  }
});

module.exports = router;
