module.exports = (db) => ({
  // Prüfe ob User heute schon gedreht hat (Reset 0 Uhr Berlin)
  async canSpinToday(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('last_spin')
      .eq('id', profileId)
      .single();

    if (!profile || !profile.last_spin) return true;

    // Aktuelle Berlin-Zeit Mitternacht berechnen
    const now = new Date();
    // Berliner Datum-String holen (YYYY-MM-DD)
    const berlinDate = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Europe/Berlin', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(now);
    
    // Berliner Stunde/Minute holen
    const berlinHour = Number(new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin'
    }).format(now));
    
    // last_spin Datum in Berlin-Zeit
    const lastSpin = new Date(profile.last_spin);
    const lastSpinBerlinDate = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Europe/Berlin', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(lastSpin);

    // Kann drehen wenn das Berlin-Datum heute anders ist als beim letzten Spin
    return berlinDate !== lastSpinBerlinDate;
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

  // Gewinnermittlung (Server-seitig, manipulationssicher)
  async spinWheel(profileId, tier = 'free') {
    const config = await this.getSpinConfig(tier);
    if (!config || config.length === 0) throw new Error('Kein Glücksrad konfiguriert');

    const canSpin = await this.canSpinToday(profileId);
    if (!canSpin) throw new Error('Du hast heute bereits gedreht! Nächster Spin um 0:00 Uhr.');

    // Weighted Random Selection
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

    // Profil laden
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('id, balance, bonus_received')
      .eq('id', profileId)
      .single();

    if (!profile) throw new Error('Profil nicht gefunden');

    let rewardDescription = '';

    // ===== CASH GEWINN =====
    if (winner.reward_type === 'cash') {
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
    // ===== CRYPTO GEWINN =====
    else if (winner.reward_type === 'crypto') {
      const symbol = winner.reward_symbol;
      const amount = Number(winner.reward_value);
      
      const { data: priceData } = await db.supabase
        .from('current_prices')
        .select('price_eur')
        .eq('symbol', symbol)
        .single();

      const priceEur = priceData ? Number(priceData.price_eur) : 0;

      await db.upsertAsset(profileId, symbol, amount, priceEur);

      const eurValue = parseFloat((amount * priceEur).toFixed(2));
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
    // ===== FEATURE GEWINN =====
    else if (winner.reward_type === 'feature') {
      const featureKey = winner.reward_detail;
      if (!featureKey) {
        rewardDescription = 'Feature-Gewinn (nicht konfiguriert)';
      } else {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // v0.3.31: Robuster Upsert — abgelaufene UND aktive Rows berücksichtigen
        // Erst schauen ob es IRGENDEINEN Row für dieses Feature gibt (egal ob abgelaufen)
        const { data: existing } = await db.supabase
          .from('temp_features')
          .select('id, expires_at')
          .eq('profile_id', profileId)
          .eq('feature_key', featureKey)
          .maybeSingle();

        if (existing) {
          // Row existiert (aktiv oder abgelaufen) → Update mit neuem Ablaufdatum
          const { error: updateErr } = await db.supabase
            .from('temp_features')
            .update({ 
              expires_at: expiresAt.toISOString(), 
              granted_at: new Date().toISOString(),
              source: 'spin'
            })
            .eq('id', existing.id);
          
          if (updateErr) {
            console.error('Temp feature update error:', updateErr);
          }
        } else {
          // Kein Row vorhanden → Insert
          const { error: insertErr } = await db.supabase
            .from('temp_features')
            .insert({
              profile_id: profileId,
              feature_key: featureKey,
              expires_at: expiresAt.toISOString(),
              source: 'spin'
            });
          
          if (insertErr) {
            console.error('Temp feature insert error:', insertErr);
            // Fallback: Vielleicht Race Condition, versuche Update
            await db.supabase
              .from('temp_features')
              .update({ 
                expires_at: expiresAt.toISOString(), 
                granted_at: new Date().toISOString(),
                source: 'spin'
              })
              .eq('profile_id', profileId)
              .eq('feature_key', featureKey);
          }
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

  // Aktive Temp Features laden
  async getActiveTempFeatures(profileId) {
    const { data } = await db.supabase
      .from('temp_features')
      .select('*')
      .eq('profile_id', profileId)
      .gt('expires_at', new Date().toISOString());
    return data || [];
  },

  // Prüfe einzelnes Temp-Feature
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
      await db.supabase
        .from('temp_features')
        .delete()
        .in('id', expired.map(e => e.id));
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
  async addSpinConfig(configData) {
    const { data, error } = await db.supabase
      .from('spin_config')
      .insert(configData)
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
