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
    
    let achievements = [];
    if (db.getUserAchievements) {
      achievements = await db.getUserAchievements(profile.id);
    }

    res.json({ 
      profile, 
      assets, 
      prices,
      achievements
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen des Profils' });
  }
});

router.get('/public/:id', async (req, res) => {
  try {
    const publicProfile = await db.getPublicProfile(req.params.id);
    if (!publicProfile) return res.status(404).json({ error: 'Profil nicht gefunden' });
    res.json({ profile: publicProfile });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen des öffentlichen Profils' });
  }
});

router.post('/avatar', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { avatar_url } = req.body;
  if (!avatar_url) return res.status(400).json({ error: 'Keine URL angegeben' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    await db.updateAvatar(profile.id, avatar_url);
    res.json({ success: true, avatar_url });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern des Avatars' });
  }
});

router.delete('/avatar', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    await db.updateAvatar(profile.id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen des Avatars' });
  }
});

router.post('/update-username', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  let { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Kein Name angegeben' });
  
  username = username.trim();
  if (username.length < 4 || username.length > 16) return res.status(400).json({ error: 'Name muss zwischen 4 und 16 Zeichen lang sein' });
  if (!/^[a-zA-Z0-9]+$/.test(username)) return res.status(400).json({ error: 'Nur Buchstaben und Zahlen erlaubt' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());

    await db.updateUsername(tgId, username, isPro);
    
    res.json({ success: true, username });
  } catch (err) {
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
