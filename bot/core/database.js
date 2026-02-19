const { createClient } = require('@supabase/supabase-js');
const { supabaseConfig } = require('./config');

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

const db = { supabase };

Object.assign(db, require('./db/profiles')(db));
Object.assign(db, require('./db/assets')(db));
Object.assign(db, require('./db/transactions')(db));
Object.assign(db, require('./db/leaderboard')(db));
Object.assign(db, require('./db/realEstate')(db));
Object.assign(db, require('./db/pro')(db));
Object.assign(db, require('./db/achievements')(db));

db.checkAndGrantAchievements = async function(profileId) {
  try {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('balance, total_volume')
      .eq('id', profileId)
      .single();

    if (!profile) return [];

    const balance = Number(profile.balance || 0);
    const volume = Number(profile.total_volume || 0);

    const { data: earned } = await this.supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('profile_id', profileId);

    const earnedIds = (earned || []).map(a => a.achievement_id);

    const achievements = [
      { id: 1, condition: balance >= 15000, reward: 500, name: 'Jung-Investor' },
      { id: 2, condition: volume >= 50000, reward: 1000, name: 'Daytrader' },
      { id: 3, condition: balance >= 100000, reward: 5000, name: 'Krypto-Wal' },
      { id: 4, condition: volume >= 1000000, reward: 10000, name: 'Marktmacher' }
    ];

    const newlyUnlocked = [];
    let totalReward = 0;

    for (const ach of achievements) {
      if (ach.condition && !earnedIds.includes(ach.id)) {
        await this.supabase.from('user_achievements').insert({
          profile_id: profileId,
          achievement_id: ach.id
        });
        newlyUnlocked.push(ach);
        totalReward += ach.reward;
      }
    }

    if (newlyUnlocked.length > 0 && totalReward > 0) {
      const newBalance = balance + totalReward;
      await this.updateBalance(profileId, newBalance);

      await this.supabase.from('transactions').insert({
        profile_id: profileId,
        type: 'achievement_reward',
        symbol: 'REWARD',
        total_eur: totalReward,
        price_eur: 0,
        amount: 0,
        fee_eur: 0,
        created_at: new Date().toISOString()
      });
    }

    return newlyUnlocked;
  } catch (err) {
    return [];
  }
};

module.exports = { db };
