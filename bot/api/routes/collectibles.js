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
  const tgId = parseTelegramUser(req);
  const { type_id } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    
    const { data: type, error: typeErr } = await db.supabase
      .from('collectibles')
      .select('*')
      .eq('id', type_id)
      .single();

    if (!type || typeErr) return res.status(404).json({ error: 'Besitztum nicht gefunden' });

    if (Number(profile.total_volume) < Number(type.min_volume)) {
      return res.status(400).json({ error: `Benötigt ${type.min_volume}€ Umsatz` });
    }

    if (Number(profile.balance) < Number(type.price)) {
      return res.status(400).json({ error: 'Guthaben unzureichend' });
    }

    const newBalance = Number(profile.balance) - Number(type.price);
    
    await db.updateBalance(profile.id, newBalance);
    
    await db.supabase.from('user_collectibles').insert({
      profile_id: profile.id,
      collectible_id: type.id,
      purchase_price: type.price
    });

    if (db.supabase.rpc) {
      await db.supabase.rpc('handle_luxury_tax', { 
        p_profile_id: profile.id, 
        p_amount: Number(type.price) 
      });
    }

    res.json({ success: true, balance: newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Kauf fehlgeschlagen' });
  }
});

router.post('/sell', async (req, res) => {
  const tgId = parseTelegramUser(req);
  const { user_collectible_id } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    
    const { data: item, error: itemErr } = await db.supabase
      .from('user_collectibles')
      .select('*')
      .eq('id', user_collectible_id)
      .eq('profile_id', profile.id)
      .single();

    if (!item || itemErr) return res.status(404).json({ error: 'Besitztum nicht in deinem Inventar' });

    const refundAmount = Number(item.purchase_price) * 0.95;
    const newBalance = Number(profile.balance) + refundAmount;

    await db.updateBalance(profile.id, newBalance);
    await db.supabase.from('user_collectibles').delete().eq('id', item.id);

    res.json({ success: true, balance: newBalance, received: refundAmount });
  } catch (err) {
    res.status(500).json({ error: 'Verkauf fehlgeschlagen' });
  }
});

module.exports = router;
