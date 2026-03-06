module.exports = (db) => ({
  // Prüfe ob User heute schon gedreht hat (Reset 0 Uhr Berlin)
  async canSpinToday(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('last_spin')
      .eq('id', profileId)
      .single();

    if (!profile || !profile.last_spin) return true;

    // Berechne Mitternacht Berlin-Zeit von heute
    const now = new Date();
    const berlinNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const berlinMidnight = new Date(berlinNow);
    berlinMidnight.setHours(0, 0, 0, 0);

    // Konvertiere Berlin-Mitternacht zurück in UTC für Vergleich
    const berlinOffset = berlinNow.getTime() - now.getTime();
    const utcMidnight = new Date(berlinMidnight.getTime() - berlinOffset);

    const lastSpin = new Date(profile.last_spin);
    return lastSpin < utcMidnight;
  },

  // Glücksrad-Konfiguration laden (für ein Tier)
  async getSpinConfig(tier = 'free') {
    const { data } = await db.supabase
      .from('spin_config')
      .select('*')
      .eq('tier', tier)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return data || [];
  },

  // Gewinnermittlung basierend auf Wahrscheinlichkeiten (Server-seitig, manipulationssicher)
  async spinWheel(profileId, tier = 'free') {
    const config = await this.getSpinConfig(tier);
    if (!config || config.length === 0) throw new Error('Kein Glücksrad konfiguriert');

    // Prüfe ob heute schon gedreht wurde
    const canSpin = await this.canSpinToday(profileId);
    if (!canSpin) throw new Error('Du hast heute bereits gedreht! Nächster Spin um 0:00 Uhr.');

    // Weighted Random Selection (Server-seitig!)
    const totalProb = config.reduce((s, c) => s + Number(c.probability), 0);
    let random = Math.random() * totalProb;
    let winner = config[0];

    for (const item of config) {
      random -= Number(item.probability);
      if (random <= 0) {
        winner = item;
        break;
      }
    }

    // Gewinn anwenden
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('id, balance, bonus_received')
      .eq('id', profileId)
      .single();

    if (!profile) throw new Error('Profil nicht gefunden');

    let rewardDescription = '';

    if (winner.reward_type === 'cash') {
      // Geld auf Kontostand
      const amount = Number(winner.reward_value);
      await db.supabase
        .from('profiles')
        .update({ 
          balance: parseFloat((Number(profile.balance) + amount).toFixed(2)),
          bonus_received: parseFloat((Number(profile.bonus_received || 0) + amount).toFixed(2))
        })
        .eq('id', profileId);

      await db.supabase.from('transactions').insert({
        profile_id: profileId,
        type: 'spin_reward',
        total_eur: amount,
        details: `Glücksrad Gewinn: ${amount}€`
      });

      rewardDescription = `${amount.toLocaleString('de-DE')}€ auf dein Konto`;
    } 
    else if (winner.reward_type === 'crypto') {
      // Krypto auf Spot
      const symbol = winner.reward_symbol;
      const amount = Number(winner.reward_value);
      
      // Aktuellen Preis holen
      const { data: priceData } = await db.supabase
        .from('current_prices')
        .select('price_eur')
        .eq('symbol', symbol)
        .single();

      const priceEur = priceData ? Number(priceData.price_eur) : 0;

      await db.upsertAsset(profileId, symbol, amount, priceEur);

      // Bonus-Wert in EUR berechnen
      const eurValue = amount * priceEur;
      await db.supabase
        .from('profiles')
        .update({ 
          bonus_received: parseFloat((Number(profile.bonus_received || 0) + eurValue).toFixed(2))
        })
        .eq('id', profileId);

      await db.supabase.from('transactions').insert({
        profile_id: profileId,
        type: 'spin_reward',
        symbol,
        amount,
        price_eur: priceEur,
        total_eur: eurValue,
        details: `Glücksrad Gewinn: ${amount} ${symbol}`
      });

      rewardDescription = `${amount} ${symbol} auf dein Spot-Konto`;
    } 
    else if (winner.reward_type === 'feature') {
      // Feature für 24h freischalten
      const featureKey = winner.reward_detail;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Upsert: Wenn Feature schon existiert, verlängern
      const { data: existing } = await db.supabase
        .from('temp_features')
        .select('id, expires_at')
        .eq('profile_id', profileId)
        .eq('feature_key', featureKey)
        .maybeSingle();

      if (existing) {
        // Verlängere um 24h ab jetzt
        await db.supabase
          .from('temp_features')
          .update({ expires_at: expiresAt.toISOString(), granted_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await db.supabase.from('temp_features').insert({
          profile_id: profileId,
          feature_key: featureKey,
          expires_at: expiresAt.toISOString(),
          source: 'spin'
        });
      }

      const featureNames = {
        'zocker_mode': 'Zocker-Modus (x20 & x50 Hebel)',
        'trailing_stop': 'Trailing-Stop',
        'limit_orders': 'Limit-Orders',
        'multi_positions': '3 Positionen gleichzeitig',
        'stop_loss': 'Stop-Loss / Take-Profit'
      };

      rewardDescription = `24h ${featureNames[featureKey] || featureKey} freigeschaltet!`;
    }

    // Spin protokollieren
    await db.supabase.from('spin_history').insert({
      profile_id: profileId,
      tier,
      config_id: winner.id,
      reward_type: winner.reward_type,
      reward_value: winner.reward_value,
      reward_symbol: winner.reward_symbol,
      reward_detail: winner.reward_detail
    });

    // last_spin aktualisieren
    await db.supabase
      .from('profiles')
      .update({ last_spin: new Date().toISOString() })
      .eq('id', profileId);

    return {
      winner: {
        id: winner.id,
        label: winner.label,
        reward_type: winner.reward_type,
        reward_value: winner.reward_value,
        reward_symbol: winner.reward_symbol,
        reward_detail: winner.reward_detail,
        color: winner.color
      },
      description: rewardDescription,
      config: config.map(c => ({
        id: c.id,
        label: c.label,
        color: c.color,
        sort_order: c.sort_order
      }))
    };
  },

  // Temp Features eines Users laden (aktive)
  async getActiveTempFeatures(profileId) {
    const { data } = await db.supabase
      .from('temp_features')
      .select('*')
      .eq('profile_id', profileId)
      .gt('expires_at', new Date().toISOString());
    return data || [];
  },

  // Prüfe ob User ein bestimmtes Temp-Feature hat
  async hasTempFeature(profileId, featureKey) {
    const { data } = await db.supabase
      .from('temp_features')
      .select('id')
      .eq('profile_id', profileId)
      .eq('feature_key', featureKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    return !!data;
  },

  // Abgelaufene Temp Features aufräumen
  async cleanupExpiredTempFeatures() {
    const { data: expired } = await db.supabase
      .from('temp_features')
      .select('id')
      .lte('expires_at', new Date().toISOString());

    if (expired && expired.length > 0) {
      const ids = expired.map(e => e.id);
      await db.supabase
        .from('temp_features')
        .delete()
        .in('id', ids);
    }
    return (expired || []).length;
  },

  // Admin: Spin Config updaten
  async updateSpinConfig(configId, updates) {
    const { error } = await db.supabase
      .from('spin_config')
      .update(updates)
      .eq('id', configId);
    if (error) throw error;
  },

  // Admin: Neues Spin-Feld hinzufügen
  async addSpinConfig(config) {
    const { data, error } = await db.supabase
      .from('spin_config')
      .insert(config)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Admin: Spin-Feld löschen
  async deleteSpinConfig(configId) {
    const { error } = await db.supabase
      .from('spin_config')
      .delete()
      .eq('id', configId);
    if (error) throw error;
  }
});
