module.exports = (db) => ({
  async createProRequest(profileId) {
    // Verhindert doppelte Anfragen, wenn bereits ein Antrag offen ist
    const { data: existing } = await db.supabase
      .from('pro_requests')
      .select('id')
      .eq('profile_id', profileId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!existing) {
      await db.supabase.from('pro_requests').insert({ profile_id: profileId });
    }
  },

  async approveProRequestForUser(profileId) {
    const proUntil = new Date();
    proUntil.setDate(proUntil.getDate() + 30); // 30 Tage Pro-Status
    
    const { error } = await db.supabase
      .from('profiles')
      .update({ 
        is_pro: true, 
        pro_until: proUntil.toISOString() 
      })
      .eq('id', profileId);
    
    if (!error) {
      await db.supabase
        .from('pro_requests')
        .update({ status: 'approved' })
        .eq('profile_id', profileId)
        .eq('status', 'pending');
      return true;
    }
    return false;
  },

  // Neue Hilfsfunktion für das Backend-Check-System
  async checkUserPremiumStatus(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('is_pro, pro_until, is_admin')
      .eq('id', profileId)
      .single();

    if (!profile) return false;
    if (profile.is_admin) return true;
    
    const isProActive = profile.is_pro && new Date(profile.pro_until) > new Date();
    return isProActive;
  }
});
