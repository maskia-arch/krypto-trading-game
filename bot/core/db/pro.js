module.exports = (db) => ({
  async createProRequest(profileId) {
    await db.supabase.from('pro_requests').insert({ profile_id: profileId });
  },

  async approveProRequestForUser(profileId) {
    const proUntil = new Date();
    proUntil.setDate(proUntil.getDate() + 30);
    const { error } = await db.supabase
      .from('profiles')
      .update({ is_pro: true, pro_until: proUntil.toISOString() })
      .eq('id', profileId);
    
    if (!error) {
      await db.supabase.from('pro_requests').update({ status: 'approved' }).eq('profile_id', profileId);
      return true;
    }
    return false;
  }
});
