module.exports = (db) => ({
  async getProfile(telegramId) {
    const { data } = await db.supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    
    if (data) {
      const adminId = Number(process.env.ADMIN_ID);
      const isSystemAdmin = Number(telegramId) === adminId;

      if (isSystemAdmin) {
        data.is_admin = true;
        data.is_pro = true;
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 100);
        data.pro_until = futureDate.toISOString();
        
        if (!data.background_url) {
          data.background_url = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop';
        }
      }

      await db.supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', data.id);
    }
    return data;
  },

  async getPublicProfile(telegramId) {
    const { data } = await db.supabase
      .from('profiles')
      .select('id, telegram_id, username, created_at, is_pro, pro_until, avatar_url, is_admin')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (!data) return null;

    let status = 'Trader';
    const adminId = Number(process.env.ADMIN_ID);
    const isProActive = data.is_pro && new Date(data.pro_until) > new Date();

    if (Number(telegramId) === adminId || data.is_admin) {
      status = 'Admin';
    } else if (isProActive) {
      status = 'Pro';
    }

    const { data: achievements } = await db.supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('profile_id', data.id);

    return {
      id: data.id,
      telegram_id: data.telegram_id,
      username: data.username,
      avatar_url: data.avatar_url,
      created_at: data.created_at,
      status: status,
      is_pro: isProActive || data.is_admin,
      achievements: achievements || []
    };
  },

  async isUsernameTaken(username) {
    if (!username) return false;
    const { data } = await db.supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();
    return !!data;
  },

  async createProfile(telegramId, username, firstName, referredBy = null) {
    const safeUsername = username ? username : `trader_${telegramId}`;
    const adminId = Number(process.env.ADMIN_ID);
    const isAdmin = Number(telegramId) === adminId;

    const profileData = {
      telegram_id: telegramId,
      username: safeUsername,
      first_name: firstName || 'Trader',
      balance: 10000.00,
      referred_by: referredBy,
      is_admin: isAdmin,
      is_pro: isAdmin,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await db.supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    try {
       await db.supabase.from('profiles').update({
         season_start_worth: 10000.00,
         day_start_worth: 10000.00
       }).eq('id', data.id);
    } catch (e) {}

    return data;
  },

  async updateUsername(telegramId, newUsername, isPro) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('id, username_changes')
      .eq('telegram_id', telegramId)
      .single();

    if (!profile) throw new Error('Profil nicht gefunden.');

    const changes = profile.username_changes || 0;
    if (!isPro && changes >= 1) throw new Error('Namensänderung bereits verbraucht.');

    const taken = await db.isUsernameTaken(newUsername);
    if (taken) throw new Error('Username vergeben.');

    const { error } = await db.supabase
      .from('profiles')
      .update({ 
        username: newUsername, 
        username_changes: changes + 1,
        last_name_change: new Date().toISOString()
      })
      .eq('id', profile.id);
    
    if (error) throw error;
    return true;
  },

  async updateAvatar(profileId, avatarUrl) {
    await db.supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', profileId);
  },

  async requestAccountDeletion(profileId) {
    await db.supabase.from('deletion_requests').insert({
      profile_id: profileId,
      status: 'pending',
      created_at: new Date().toISOString()
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
    await db.supabase.from('user_collectibles').delete().eq('profile_id', profileId);
    await db.supabase.from('leveraged_positions').delete().eq('profile_id', profileId);
    
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
