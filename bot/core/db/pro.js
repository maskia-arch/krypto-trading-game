module.exports = (db) => ({
  async createProRequest(profileId, months = 1, price = 5) {
    const { data: existing } = await db.supabase
      .from('pro_requests')
      .select('id')
      .eq('profile_id', profileId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      await db.supabase
        .from('pro_requests')
        .update({ months: Number(months), price: Number(price) })
        .eq('id', existing.id);
      return existing;
    }

    const { data } = await db.supabase
      .from('pro_requests')
      .insert({ 
        profile_id: profileId, 
        months: Number(months), 
        price: Number(price),
        status: 'pending'
      })
      .select()
      .single();

    return data;
  },

  async activateProForUser(profileId, months = 1) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('is_pro, pro_until')
      .eq('id', profileId)
      .single();

    if (!profile) throw new Error('Profil nicht gefunden');

    let proUntil;
    if (profile.is_pro && profile.pro_until && new Date(profile.pro_until) > new Date()) {
      proUntil = new Date(profile.pro_until);
    } else {
      proUntil = new Date();
    }
    proUntil.setMonth(proUntil.getMonth() + months);

    const { error } = await db.supabase
      .from('profiles')
      .update({ 
        is_pro: true, 
        pro_until: proUntil.toISOString() 
      })
      .eq('id', profileId);

    if (error) throw error;

    await db.supabase
      .from('pro_requests')
      .update({ status: 'approved' })
      .eq('profile_id', profileId)
      .eq('status', 'pending');

    return proUntil;
  },

  async addProStrike(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('pro_strikes')
      .eq('id', profileId)
      .single();

    const newStrikes = (Number(profile?.pro_strikes) || 0) + 1;

    await db.supabase
      .from('profiles')
      .update({ pro_strikes: newStrikes })
      .eq('id', profileId);

    await db.supabase
      .from('pro_requests')
      .update({ status: 'rejected' })
      .eq('profile_id', profileId)
      .eq('status', 'pending');

    return newStrikes;
  },

  async approveProRequestForUser(profileId) {
    return this.activateProForUser(profileId, 1);
  },

  async checkUserPremiumStatus(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('is_pro, pro_until, is_admin')
      .eq('id', profileId)
      .single();

    if (!profile) return false;
    if (profile.is_admin) return true;
    return profile.is_pro && new Date(profile.pro_until) > new Date();
  }
});