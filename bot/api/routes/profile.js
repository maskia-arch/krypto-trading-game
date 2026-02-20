const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');

function isPro(profile) {
  if (profile.is_admin) return true;
  if (!profile.is_pro || !profile.pro_until) return false;
  return new Date(profile.pro_until) > new Date();
}

async function getProfileCollectibles(profileId) {
  try {
    const { data, error } = await db.supabase
      .from('user_collectibles')
      .select('*, collectibles(*)')
      .eq('profile_id', profileId);
    if (error) return [];
    return data || [];
  } catch (e) {
    return [];
  }
}

router.get('/', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    if (!isPro(profile) && profile.background_url) {
      if (!profile.background_disabled_at) {
        await db.supabase
          .from('profiles')
          .update({ background_disabled_at: new Date().toISOString() })
          .eq('id', profile.id);
      }
      profile.background_url = null;
    } else if (isPro(profile) && profile.background_disabled_at) {
      await db.supabase
        .from('profiles')
        .update({ background_disabled_at: null })
        .eq('id', profile.id);
    }

    const assets = await db.getAssets(profile.id);
    const prices = await db.getAllPrices();
    const collectibles = await getProfileCollectibles(profile.id);
    
    let achievements = [];
    if (db.getUserAchievements) {
      achievements = await db.getUserAchievements(profile.id);
    }

    res.json({ 
      profile, 
      assets, 
      prices,
      achievements,
      collectibles 
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen des Profils' });
  }
});

router.get('/public/:id', async (req, res) => {
  try {
    const publicProfile = await db.getPublicProfile(req.params.id);
    if (!publicProfile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const fullProfileForCheck = await db.getProfile(req.params.id);
    if (fullProfileForCheck && !isPro(fullProfileForCheck)) {
      publicProfile.background_url = null;
    }

    let collectibles = [];
    if (fullProfileForCheck && !fullProfileForCheck.hide_collectibles) {
      collectibles = await getProfileCollectibles(fullProfileForCheck.id);
    }

    res.json({ 
      profile: publicProfile,
      collectibles 
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen des öffentlichen Profils' });
  }
});

router.post('/background', async (req, res) => {
  const { background_url } = req.body;
  if (!background_url) return res.status(400).json({ error: 'Keine Bilddaten angegeben' });

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
    if (!isPro(profile)) return res.status(403).json({ error: 'Pro-Status erforderlich' });

    const matches = background_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return res.status(400).json({ error: 'Ungültiges Bildformat' });

    const contentType = matches[1];
    if (!contentType.startsWith('image/')) return res.status(400).json({ error: 'Nur Bilder erlaubt' });

    const buffer = Buffer.from(matches[2], 'base64');
    const extension = contentType.split('/')[1] || 'jpg';
    const fileName = `bg_${profile.id}_${Date.now()}.${extension}`;

    if (profile.background_url) {
      const oldFile = profile.background_url.split('/').pop();
      await db.supabase.storage.from('backgrounds').remove([oldFile]);
    }

    const { error: uploadError } = await db.supabase.storage
      .from('backgrounds')
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = db.supabase.storage
      .from('backgrounds')
      .getPublicUrl(fileName);

    await db.supabase
      .from('profiles')
      .update({ 
        background_url: publicUrl, 
        background_disabled_at: null 
      })
      .eq('id', profile.id);

    res.json({ success: true, background_url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Upload des Hintergrunds' });
  }
});

router.delete('/background', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    if (profile.background_url) {
      const fileName = profile.background_url.split('/').pop();
      await db.supabase.storage.from('backgrounds').remove([fileName]);
    }

    await db.supabase
      .from('profiles')
      .update({ background_url: null, background_disabled_at: null })
      .eq('id', profile.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

router.post('/avatar', async (req, res) => {
  const { avatar_url } = req.body;
  if (!avatar_url) return res.status(400).json({ error: 'Keine URL/Bilddaten angegeben' });

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const matches = avatar_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Ungültiges Bildformat' });
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = contentType.split('/')[1] || 'png';
    const fileName = `avatar_${profile.id}_${Date.now()}.${extension}`;

    const { error: uploadError } = await db.supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = db.supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    await db.updateAvatar(profile.id, publicUrl);
    res.json({ success: true, avatar_url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern des Avatars in Storage' });
  }
});

router.delete('/avatar', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    if (profile.avatar_url && profile.avatar_url.includes('/avatars/')) {
      const urlParts = profile.avatar_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      await db.supabase.storage.from('avatars').remove([fileName]);
    }

    await db.updateAvatar(profile.id, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen des Avatars' });
  }
});

router.post('/update-username', async (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Kein Name angegeben' });
  
  username = username.trim();
  if (username.length < 4 || username.length > 16) return res.status(400).json({ error: 'Name muss zwischen 4 und 16 Zeichen lang sein' });
  if (!/^[a-zA-Z0-9]+$/.test(username)) return res.status(400).json({ error: 'Nur Buchstaben und Zahlen erlaubt' });

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const proValid = isPro(profile);

    await db.updateUsername(req.tgId, username, proValid);
    
    res.json({ success: true, username });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/update-privacy', async (req, res) => {
  const { hide_collectibles } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const { error } = await db.supabase
      .from('profiles')
      .update({ hide_collectibles: !!hide_collectibles })
      .eq('id', profile.id);

    if (error) throw error;
    res.json({ success: true, hide_collectibles: !!hide_collectibles });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Privatsphäre' });
  }
});

router.post('/request-deletion', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
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
  try {
    const profile = await db.getProfile(req.tgId);
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
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const rentCollected = await db.collectRent(profile.id);
    const updatedProfile = await db.getProfile(req.tgId);

    res.json({ 
      success: true,
      rent_collected: Number(rentCollected || 0), 
      new_balance: Number(updatedProfile.balance) 
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Miete konnte nicht eingesammelt werden' });
  }
});

router.post('/claim-bonus', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    if (profile.inactivity_bonus_claimed === true || !profile.claimable_bonus || Number(profile.claimable_bonus) <= 0) {
      return res.status(400).json({ error: 'Bonus bereits abgeholt oder nicht verfügbar.' });
    }

    const bonusAmount = Number(profile.claimable_bonus);
    const newBalance = Number(profile.balance) + bonusAmount;
    const newBonusReceived = Number(profile.bonus_received || 0) + bonusAmount;

    const { error: updateError } = await db.supabase.from('profiles').update({
      balance: newBalance,
      bonus_received: newBonusReceived,
      claimable_bonus: 0,
      inactivity_bonus_claimed: true
    }).eq('id', profile.id);

    if (updateError) throw updateError;

    res.json({ success: true, claimed: bonusAmount, new_balance: newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abholen des Bonus' });
  }
});

module.exports = router;
