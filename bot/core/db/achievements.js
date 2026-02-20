module.exports = (db) => ({
  async getAllAchievements() {
    const { data } = await db.supabase
      .from('achievements')
      .select('*')
      .order('id', { ascending: true });
    return data || [];
  },

  async getUserAchievements(profileId) {
    const { data } = await db.supabase
      .from('user_achievements')
      .select('*, achievements(*)')
      .eq('profile_id', profileId)
      .order('earned_at', { ascending: false });
    return data || [];
  },

  async checkAndGrantAchievements(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (!profile) return [];

    const allAchievements = await this.getAllAchievements();
    const earned = await this.getUserAchievements(profileId);
    const earnedIds = earned.map(e => e.achievement_id);

    const newlyUnlocked = [];
    let rewardTotal = 0;

    for (const ach of allAchievements) {
      if (earnedIds.includes(ach.id)) continue;

      let unlocked = false;
      const targetValue = Number(ach.condition_value);

      switch (ach.condition_type) {
        case 'volume':
          if (Number(profile.total_volume || 0) >= targetValue) unlocked = true;
          break;
        case 'balance':
          if (Number(profile.balance || 0) >= targetValue) unlocked = true;
          break;
        case 'leverage_count':
          const { count } = await db.supabase
            .from('leveraged_positions')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profileId)
            .eq('status', 'CLOSED');
          if (count >= targetValue) unlocked = true;
          break;
      }

      if (unlocked) {
        newlyUnlocked.push(ach);
        rewardTotal += Number(ach.reward_eur || 0);
        
        await db.supabase.from('user_achievements').insert({
          profile_id: profileId,
          achievement_id: ach.id,
          earned_at: new Date().toISOString()
        });
        
        await db.logTransaction(profileId, 'achievement_reward', 'REWARD', 0, 0, 0, ach.reward_eur, `Achievement: ${ach.name}`);
      }
    }

    if (rewardTotal > 0) {
      await db.updateBalance(profileId, Number(profile.balance) + rewardTotal);
    }

    return newlyUnlocked;
  }
});
