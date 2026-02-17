module.exports = (db) => ({
  async getProfile(telegramId) {
    const { data } = await db.supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    
    if (data) {
      await db.supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', data.id);
    }
    return data;
  },

  async isUsernameTaken(username) {
    if (!username) return false;
    const { data } = await db.supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    return !!data;
  },

  async createProfile(telegramId, username, firstName) {
    const safeUsername = username ? username : `trader_${telegramId}`;

    const profileData = {
      telegram_id: telegramId,
      username: safeUsername,
      first_name: firstName || 'Trader',
      balance: 10000.00,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await db.supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) {
      console.error('DB Insert Error:', error);
      throw new Error(error.message);
    }

    try {
       await db.supabase.from('profiles').update({
         season_start_worth: 10000.00,
         day_start_worth: 10000.00
       }).eq('id', data.id);
    } catch (e) {}

    return data;
  },

  async updateUsername(profileId, newUsername, isPro) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('username_changes, is_pro')
      .eq('id', profileId)
      .single();

    const canChange = isPro ? true : (profile.username_changes < 1);
    if (!canChange) throw new Error('Namensänderung bereits verbraucht.');

    const taken = await db.isUsernameTaken(newUsername);
    if (taken) throw new Error('Dieser Username ist bereits vergeben.');

    const { error } = await db.supabase
      .from('profiles')
      .update({ 
        username: newUsername, 
        username_changes: profile.username_changes + 1,
        last_name_change: new Date().toISOString()
      })
      .eq('id', profileId);
    
    if (error) throw error;
    return true;
  },

  async requestAccountDeletion(profileId) {
    await db.supabase.from('deletion_requests').insert({
      profile_id: profileId,
      status: 'pending',
      requested_at: new Date().toISOString()
    });
  },

  async deleteUserCompletely(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('telegram_id')
      .eq('id', profileId)
      .single();

    await db.supabase.from('assets').delete().eq('profile_id', profileId);
    await db.supabase.from('transactions').delete().eq('profile_id', profileId);
    await db.supabase.from('real_estate').delete().eq('profile_id', profileId);
    await db.supabase.from('collectibles').delete().eq('profile_id', profileId);
    await db.supabase.from('pro_requests').delete().eq('profile_id', profileId);
    await db.supabase.from('deletion_requests').delete().eq('profile_id', profileId);
    
    const { error } = await db.supabase.from('profiles').delete().eq('id', profileId);
    
    return { success: !error, telegramId: profile?.telegram_id };
  },

  async updateBalance(profileId, newBalance) {
    await db.supabase
      .from('profiles')
      .update({ balance: newBalance, last_active: new Date().toISOString() })
      .eq('id', profileId);
  },

  async addVolume(profileId, amount) {
    const { data: p } = await db.supabase
      .from('profiles')
      .select('total_volume')
      .eq('id', profileId)
      .single();
    await db.supabase
      .from('profiles')
      .update({ 
        total_volume: Number(p.total_volume || 0) + amount,
        last_active: new Date().toISOString()
      })
      .eq('id', profileId);
  },

  async getStats() {
    const { count: userCount } = await db.supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: txCount } = await db.supabase.from('transactions').select('*', { count: 'exact', head: true });
    return { userCount: userCount || 0, txCount: txCount || 0 };
  }
});
