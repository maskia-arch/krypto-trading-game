module.exports = (db) => ({
  // Prüfe ob User heute schon gedreht hat (Reset 0 Uhr Berlin)
  async canSpinToday(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('last_spin')
      .eq('id', profileId)
      .single();

    if (!profile || !profile.last_spin) return true;

    // Berliner Datum heute
    const now = new Date();
    const berlinToday = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Europe/Berlin', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(now);
    
    // Berliner Datum des letzten Spins
    const lastSpin = new Date(profile.last_spin);
    const lastSpinBerlin = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Europe/Berlin', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(lastSpin);

    return berlinToday !== lastSpinBerlin;
  },

  // Glücksrad-Konfiguration laden
  async getSpinConfig(tier = 'free') {
    const { data } = await db.supabase
      .from('spin_config')
      .select('*')
      .eq('tier', tier)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return data || [];
  },

  // Drehen (Server-seitig, manipulationssicher)
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

    const { data: profile } = await db.supabase
      .from('profiles')
      .select('id, balance, bonus_received')
      .eq('id', profileId)
      .single();

    if (!profile) throw new Error('Profil nicht gefunden');

    let rewardDescription = '';

    // ===== CASH =====
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

      rewardDescription = `${amount.toLocaleString('de-DE')}€ auf dein Konto gutgeschrieben!`;
    } 
    // ===== CRYPTO =====
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

      rewardDescription = `${amount} ${symbol} auf dein Spot-Konto gutgeschrieben!`;
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

    // last_spin updaten
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

  // Admin: Config updaten
  async updateSpinConfig(configId, updates) {
    const { error } = await db.supabase
      .from('spin_config')
      .update(updates)
      .eq('id', configId);
    if (error) throw error;
  },

  // Admin: Neues Feld
  async addSpinConfig(configData) {
    const { data, error } = await db.supabase
      .from('spin_config')
      .insert(configData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Admin: Feld löschen
  async deleteSpinConfig(configId) {
    const { error } = await db.supabase
      .from('spin_config')
      .delete()
      .eq('id', configId);
    if (error) throw error;
  }
});
