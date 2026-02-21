const { createClient } = require('@supabase/supabase-js');
const { supabaseConfig } = require('./config');

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

const db = { supabase };

// --- Alle DB-Module laden ---
Object.assign(db, require('./db/profiles')(db));
Object.assign(db, require('./db/assets')(db));
Object.assign(db, require('./db/transactions')(db));
Object.assign(db, require('./db/leaderboard')(db));
Object.assign(db, require('./db/realEstate')(db));
Object.assign(db, require('./db/pro')(db));
Object.assign(db, require('./db/achievements')(db));
Object.assign(db, require('./db/leverage')(db));

// --- HELPER FUNKTIONEN ---

db.getCurrentPrice = async function(symbol) {
  const { data } = await this.supabase
    .from('current_prices')
    .select('price_eur')
    .eq('symbol', symbol)
    .single();
  if (!data) throw new Error(`Kein Preis für ${symbol}`);
  return Number(data.price_eur);
};

db.getAllPrices = async function() {
  const { data } = await this.supabase
    .from('current_prices')
    .select('*');
  return data || [];
};

// --- ACHIEVEMENTS ---

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

// --- BACKGROUND CLEANUP ---

db.cleanupExpiredBackgrounds = async function() {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const { data: expired } = await this.supabase
    .from('profiles')
    .select('id, background_url')
    .lte('background_disabled_at', fourWeeksAgo.toISOString());

  if (expired && expired.length > 0) {
    for (const profile of expired) {
      if (profile.background_url) {
        const fileName = profile.background_url.split('/').pop();
        await this.supabase.storage.from('backgrounds').remove([fileName]);
      }
      await this.supabase
        .from('profiles')
        .update({ background_url: null, background_disabled_at: null })
        .eq('id', profile.id);
    }
  }
};

module.exports = { db };