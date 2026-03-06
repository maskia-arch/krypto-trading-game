const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');

function isPro(profile) {
  if (profile.is_admin) return true;
  if (!profile.is_pro || !profile.pro_until) return false;
  return new Date(profile.pro_until) > new Date();
}

// GET /api/spin/config — Glücksrad-Konfiguration laden
router.get('/config', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const tier = isPro(profile) ? 'pro' : 'free';
    const config = await db.getSpinConfig(tier);
    const canSpin = await db.canSpinToday(profile.id);

    // Auch Free Config laden für Pro-Teaser
    let freeConfig = null;
    if (tier === 'free') {
      const proConfig = await db.getSpinConfig('pro');
      freeConfig = proConfig.map(c => ({ label: c.label, color: c.color }));
    }

    res.json({ 
      config: config.map(c => ({
        id: c.id,
        label: c.label,
        color: c.color,
        sort_order: c.sort_order
      })),
      tier,
      can_spin: canSpin,
      pro_preview: freeConfig
    });
  } catch (err) {
    console.error('Spin Config Error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Rad-Konfiguration' });
  }
});

// POST /api/spin/spin — Am Glücksrad drehen
router.post('/spin', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const tier = isPro(profile) ? 'pro' : 'free';
    const result = await db.spinWheel(profile.id, tier);

    // Bot-Benachrichtigung
    if (req.bot) {
      let emoji = '🎰';
      if (result.winner.reward_type === 'cash') emoji = '💰';
      if (result.winner.reward_type === 'crypto') emoji = '🪙';
      if (result.winner.reward_type === 'feature') emoji = '⚡';

      req.bot.api.sendMessage(profile.telegram_id,
        `${emoji} <b>GLÜCKSRAD GEWINN!</b>\n\n` +
        `${result.description}\n\n` +
        `🕐 Nächster Spin: Morgen um 0:00 Uhr`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    res.json({ 
      success: true, 
      winner: result.winner,
      description: result.description,
      config: result.config
    });
  } catch (err) {
    console.error('Spin Error:', err);
    res.status(400).json({ error: err.message || 'Fehler beim Drehen' });
  }
});

// GET /api/spin/history — Letzte Spins
router.get('/history', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const { data } = await db.supabase
      .from('spin_history')
      .select('*')
      .eq('profile_id', profile.id)
      .order('spun_at', { ascending: false })
      .limit(20);

    res.json({ history: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Spin-History' });
  }
});

// GET /api/spin/temp-features — Aktive temporäre Features
router.get('/temp-features', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const features = await db.getActiveTempFeatures(profile.id);
    res.json({ features });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Features' });
  }
});

// ==================== ADMIN ROUTES ====================

// GET /api/spin/admin/config — Alle Spin-Configs laden (Admin)
router.get('/admin/config', async (req, res) => {
  try {
    if (!req.permissions?.isAdmin) return res.status(403).json({ error: 'Nur Admin' });

    const { data } = await db.supabase
      .from('spin_config')
      .select('*')
      .order('tier', { ascending: true })
      .order('sort_order', { ascending: true });

    res.json({ configs: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Configs' });
  }
});

// POST /api/spin/admin/config — Spin-Feld hinzufügen (Admin)
router.post('/admin/config', async (req, res) => {
  try {
    if (!req.permissions?.isAdmin) return res.status(403).json({ error: 'Nur Admin' });

    const config = await db.addSpinConfig(req.body);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/spin/admin/config/:id — Spin-Feld updaten (Admin)
router.put('/admin/config/:id', async (req, res) => {
  try {
    if (!req.permissions?.isAdmin) return res.status(403).json({ error: 'Nur Admin' });

    await db.updateSpinConfig(Number(req.params.id), req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/spin/admin/config/:id — Spin-Feld löschen (Admin)
router.delete('/admin/config/:id', async (req, res) => {
  try {
    if (!req.permissions?.isAdmin) return res.status(403).json({ error: 'Nur Admin' });

    await db.deleteSpinConfig(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
