const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');

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

router.post('/collect-rent', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const rentCollected = await db.collectRent(profile.id);
    const updatedProfile = await db.getProfile(tgId);

    res.json({ 
      success: true,
      rent_collected: rentCollected, 
      new_balance: Number(updatedProfile.balance) 
    });
  } catch (err) {
    console.error('Rent Collection Error:', err);
    res.status(500).json({ error: 'Miete konnte nicht eingesammelt werden' });
  }
});

module.exports = router;
