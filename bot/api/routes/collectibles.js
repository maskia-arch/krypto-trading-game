const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');

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
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

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
  const { type_id } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
    
    const { data: type, error: typeErr } = await db.supabase
      .from('collectibles')
      .select('*')
      .eq('id', type_id)
      .single();

    if (!type || typeErr) return res.status(404).json({ error: 'Gegenstand nicht im Katalog gefunden' });

    if (Number(profile.total_volume) < Number(type.min_volume)) {
      return res.status(400).json({ 
        error: `Dieser Gegenstand erfordert ein Handelsvolumen von mindestens ${type.min_volume.toLocaleString('de-DE')}€` 
      });
    }

    if (Number(profile.balance) < Number(type.price)) {
      return res.status(400).json({ error: 'Dein Guthaben reicht dafür leider nicht aus' });
    }

    const newBalance = Number(profile.balance) - Number(type.price);
    await db.updateBalance(profile.id, newBalance);
    
    const { error: insErr } = await db.supabase.from('user_collectibles').insert({
      profile_id: profile.id,
      collectible_id: type.id,
      purchase_price: type.price
    });

    if (insErr) throw insErr;

    await db.supabase.from('transactions').insert({
      profile_id: profile.id,
      type: 'buy_collectible',
      symbol: 'LUX',
      total_eur: -Number(type.price),
      details: `Kauf: ${type.name}`
    });

    if (db.supabase.rpc) {
      try {
        await db.supabase.rpc('handle_luxury_tax', { 
          p_profile_id: profile.id, 
          p_amount: Number(type.price) 
        });
      } catch (rpcErr) { }
    }

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
    res.status(500).json({ error: 'Der Kauf konnte nicht abgeschlossen werden' });
  }
});

router.post('/sell', async (req, res) => {
  const { user_collectible_id } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
    
    const { data: item, error: itemErr } = await db.supabase
      .from('user_collectibles')
      .select('*')
      .eq('id', user_collectible_id)
      .eq('profile_id', profile.id)
      .single();

    if (!item || itemErr) return res.status(404).json({ error: 'Dieser Gegenstand gehört nicht dir' });

    const refundAmount = Number(item.purchase_price) * 0.95;
    const newBalance = Number(profile.balance) + refundAmount;

    await db.updateBalance(profile.id, newBalance);
    await db.supabase.from('user_collectibles').delete().eq('id', item.id);

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
