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
    res.status(500).json({ error: 'Fehler beim Abrufen des Profils' });
  }
});

router.post('/update-username', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  let { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Kein Name angegeben' });
  
  username = username.trim();
  if (username.length < 3) return res.status(400).json({ error: 'Name muss mindestens 3 Zeichen lang sein' });
  if (username.length > 20) return res.status(400).json({ error: 'Name zu lang (max. 20 Zeichen)' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const isPro = profile.is_pro && new Date(profile.pro_until) > new Date();

    // Der Check findet direkt in der Datenbank-Methode statt, 
    // wir fangen den Error hier sauber ab und geben ihn an die WebApp weiter.
    await db.updateUsername(profile.id, username, isPro);
    
    res.json({ success: true, username });
  } catch (err) {
    // Hier wird z.B. "Dieser Username ist bereits vergeben." zurückgegeben
    res.status(400).json({ error: err.message });
  }
});

router.post('/request-deletion', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    await db.requestAccountDeletion(profile.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Löschantrag fehlgeschlagen' });
  }
});

router.get('/prices', async (req, res) => {
  try {
    const prices = await db.getAllPrices();
    res.json({ prices });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Preise' });
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
      rent_collected: Number(rentCollected || 0), 
      new_balance: Number(updatedProfile.balance) 
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Miete konnte nicht eingesammelt werden' });
  }
});

module.exports = router;
