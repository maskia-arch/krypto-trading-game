const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');

router.get('/types', async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('collectibles')
      .select('*')
      .order('price', { ascending: true });

    if (error) throw error;
    res.json({ types: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Katalog konnte nicht geladen werden' });
  }
});

router.get('/mine', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    const { data, error } = await db.supabase
      .from('user_collectibles')
      .select('*, collectibles(*)')
      .eq('profile_id', profile.id);

    if (error) throw error;
    res.json({ collectibles: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Besitztümer konnten nicht geladen werden' });
  }
});

router.post('/buy', async (req, res) => {
  const tgId = await parseTelegramUser(req);
  const { type_id } = req.body;

  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    
    const { data: type, error: typeErr } = await db.supabase
      .from('collectibles')
      .select('*')
      .eq('id', type_id)
      .single();

    if (!type || typeErr) return res.status(404).json({ error: 'Gegenstand nicht im Katalog gefunden' });

    // Prüfung: Mindestvolumen (Prestige-Check)
    if (Number(profile.total_volume) < Number(type.min_volume)) {
      return res.status(400).json({ 
        error: `Dieser Gegenstand erfordert ein Handelsvolumen von mindestens ${type.min_volume.toLocaleString('de-DE')}€` 
      });
    }

    // Prüfung: Kontostand
    if (Number(profile.balance) < Number(type.price)) {
      return res.status(400).json({ error: 'Dein Guthaben reicht dafür leider nicht aus' });
    }

    const newBalance = Number(profile.balance) - Number(type.price);
    
    // Transaktion: Abzug vom Konto
    await db.updateBalance(profile.id, newBalance);
    
    // Item ins Inventar legen
    const { error: insErr } = await db.supabase.from('user_collectibles').insert({
      profile_id: profile.id,
      collectible_id: type.id,
      purchase_price: type.price
    });

    if (insErr) throw insErr;

    // Transaktion loggen
    await db.supabase.from('transactions').insert({
      profile_id: profile.id,
      type: 'buy_collectible',
      symbol: 'LUX',
      total_eur: -Number(type.price),
      details: `Kauf: ${type.name}`
    });

    // Optionale Steuerabführung (Fee Pool)
    if (db.supabase.rpc) {
      try {
        await db.supabase.rpc('handle_luxury_tax', { 
          p_profile_id: profile.id, 
          p_amount: Number(type.price) 
        });
      } catch (rpcErr) { /* Ignorieren wenn RPC nicht existiert */ }
    }

    // v0.3.0: Achievements nach Kauf prüfen
    let unlocked = [];
    if (db.checkAndGrantAchievements) {
      unlocked = await db.checkAndGrantAchievements(profile.id);
    }

    res.json({ 
      success: true, 
      balance: newBalance, 
      unlockedAchievements: unlocked 
    });
  } catch (err) {
    console.error('Collectibles Buy Error:', err);
    res.status(500).json({ error: 'Der Kauf konnte nicht abgeschlossen werden' });
  }
});

router.post('/sell', async (req, res) => {
  const tgId = await parseTelegramUser(req);
  const { user_collectible_id } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    
    const { data: item, error: itemErr } = await db.supabase
      .from('user_collectibles')
      .select('*')
      .eq('id', user_collectible_id)
      .eq('profile_id', profile.id)
      .single();

    if (!item || itemErr) return res.status(404).json({ error: 'Dieser Gegenstand gehört nicht dir' });

    // Wiederverkaufswert: 95% (5% Verlust/Gebühr)
    const refundAmount = Number(item.purchase_price) * 0.95;
    const newBalance = Number(profile.balance) + refundAmount;

    await db.updateBalance(profile.id, newBalance);
    await db.supabase.from('user_collectibles').delete().eq('id', item.id);

    // Transaktion loggen
    await db.supabase.from('transactions').insert({
      profile_id: profile.id,
      type: 'sell_collectible',
      symbol: 'LUX',
      total_eur: refundAmount,
      details: `Verkauf Luxusgut`
    });

    res.json({ success: true, balance: newBalance, received: refundAmount });
  } catch (err) {
    res.status(500).json({ error: 'Verkauf fehlgeschlagen' });
  }
});

module.exports = router;
