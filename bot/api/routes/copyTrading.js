const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');

function isPro(profile) {
  if (profile.is_admin) return true;
  if (!profile.is_pro || !profile.pro_until) return false;
  return new Date(profile.pro_until) > new Date();
}

// GET /api/copy/my-subs — Meine aktiven Kopier-Abos
router.get('/my-subs', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const subs = await db.getMyCopySubscriptions(profile.id);
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Kopier-Abos' });
  }
});

// GET /api/copy/followers — Wer kopiert mich
router.get('/followers', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const followers = await db.getActiveCopySubscriptions(profile.id);
    res.json({ followers });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Follower' });
  }
});

// POST /api/copy/subscribe — Trader kopieren
router.post('/subscribe', async (req, res) => {
  const { target_telegram_id, budget, duration_hours } = req.body;

  if (!target_telegram_id || !budget || budget <= 0) {
    return res.status(400).json({ error: 'Ungültige Parameter' });
  }

  try {
    const copierProfile = await db.getProfile(req.tgId);
    if (!copierProfile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    // Sich selbst kopieren verhindern
    if (Number(copierProfile.telegram_id) === Number(target_telegram_id)) {
      return res.status(400).json({ error: 'Du kannst dich nicht selbst kopieren' });
    }

    // Target laden
    const targetProfile = await db.getProfile(target_telegram_id);
    if (!targetProfile) return res.status(404).json({ error: 'Ziel-Trader nicht gefunden' });

    // Pro-Check: Free User dürfen nur 24h, einmal in 30 Tagen
    const copierIsPro = isPro(copierProfile);
    
    if (!copierIsPro) {
      // Free User: max 24h
      if (duration_hours > 24) {
        return res.status(403).json({ 
          error: 'Free User: Max. 24 Stunden. Upgrade auf Pro für unbegrenztes Copy Trading!',
          pro_required: true 
        });
      }

      // Free User: 30 Tage Cooldown
      const canCopy = await db.canFreeCopy(copierProfile.id);
      if (!canCopy) {
        return res.status(403).json({ 
          error: 'Du kannst als Free User nur einmal alle 30 Tage Copy Trading nutzen. Upgrade auf Pro!',
          pro_required: true
        });
      }
    }

    // Budget-Check (inkl. 1% Gebühr)
    if (Number(copierProfile.balance) < budget) {
      return res.status(400).json({ error: 'Nicht genügend Guthaben' });
    }

    // Mindestens 100€
    if (budget < 100) {
      return res.status(400).json({ error: 'Mindestbudget: 100€' });
    }

    const durationH = copierIsPro ? (duration_hours || 24) : 24;

    const sub = await db.createCopySubscription(
      copierProfile.id, 
      targetProfile.id, 
      Number(budget), 
      durationH
    );

    // Free User: Cooldown markieren
    if (!copierIsPro) {
      await db.markFreeCopyUsed(copierProfile.id);
    }

    // Bot-Benachrichtigung an beide
    if (req.bot) {
      const fee = (budget * 0.01).toFixed(2);
      
      req.bot.api.sendMessage(copierProfile.telegram_id,
        `📋 <b>COPY TRADING GESTARTET</b>\n\n` +
        `Du kopierst jetzt <b>${targetProfile.username || 'Trader'}</b>.\n` +
        `Budget: <b>${Number(budget).toFixed(2)}€</b> (Gebühr: ${fee}€)\n` +
        `Dauer: <b>${durationH}h</b>\n\n` +
        `Alle Trades werden automatisch proportional kopiert.`,
        { parse_mode: 'HTML' }
      ).catch(() => {});

      req.bot.api.sendMessage(targetProfile.telegram_id,
        `🔔 <b>NEUER KOPIERER!</b>\n\n` +
        `<b>${copierProfile.username || 'Ein Trader'}</b> kopiert jetzt deine Trades für ${durationH}h.\n` +
        `Du hast <b>${fee}€</b> Kopier-Gebühr erhalten!`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    res.json({ success: true, subscription: sub });
  } catch (err) {
    console.error('Copy Subscribe Error:', err);
    res.status(500).json({ error: err.message || 'Fehler beim Kopier-Abo' });
  }
});

// POST /api/copy/cancel — Kopier-Abo abbrechen
router.post('/cancel', async (req, res) => {
  const { subscription_id } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const result = await db.cancelCopySubscription(subscription_id, profile.id);

    if (req.bot && result.refunded > 0) {
      req.bot.api.sendMessage(profile.telegram_id,
        `❌ <b>COPY TRADING BEENDET</b>\n\n` +
        `Restbudget zurückerstattet: <b>${result.refunded.toFixed(2)}€</b>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    res.json({ success: true, refunded: result.refunded });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Fehler beim Abbrechen' });
  }
});

// GET /api/copy/can-copy — Prüfe ob Free User kopieren darf
router.get('/can-copy', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const proStatus = isPro(profile);
    
    if (proStatus) {
      return res.json({ can_copy: true, is_pro: true });
    }

    const canCopy = await db.canFreeCopy(profile.id);
    res.json({ can_copy: canCopy, is_pro: false, cooldown_days: 30 });
  } catch (err) {
    res.status(500).json({ error: 'Fehler bei der Prüfung' });
  }
});

module.exports = router;
