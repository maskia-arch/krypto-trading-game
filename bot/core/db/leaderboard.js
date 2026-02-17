module.exports = (db) => ({
  async getLeaderboard(filter = 'profit_season', limit = 20) {
    const [ profilesRes, assetsRes, pricesRes, season ] = await Promise.all([
      db.supabase.from('profiles').select('*'),
      db.supabase.from('assets').select('profile_id, symbol, amount'),
      db.supabase.from('current_prices').select('symbol, price_eur'),
      db.getActiveSeason()
    ]);

    const profiles = profilesRes.data || [];
    const assets = assetsRes.data || [];
    const prices = pricesRes.data || [];

    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    const userAssets = {};
    assets.forEach(a => {
      if (!userAssets[a.profile_id]) userAssets[a.profile_id] = [];
      userAssets[a.profile_id].push(a);
    });

    let leaders = profiles.map(p => {
      let cryptoValue = 0;
      if (userAssets[p.id]) {
        userAssets[p.id].forEach(asset => {
          const currentPrice = priceMap[asset.symbol] || 0;
          cryptoValue += Number(asset.amount) * currentPrice;
        });
      }
      
      const currentNetWorth = Number(p.balance) + cryptoValue;
      let diffEuro = 0;
      let startBasis = 10000;

      const seasonStart = Number(p.season_start_worth);
      const dayStart = Number(p.day_start_worth);

      if (filter && filter.includes('season')) {
        startBasis = (seasonStart && seasonStart > 0) ? seasonStart : 10000;
        diffEuro = currentNetWorth - startBasis;
      } else {
        startBasis = (dayStart && dayStart > 0) ? dayStart : currentNetWorth;
        diffEuro = currentNetWorth - startBasis;
      }

      const diffPercent = startBasis > 0 ? (diffEuro / startBasis) * 100 : 0;

      return {
        ...p,
        net_worth: currentNetWorth,
        performance_euro: parseFloat(diffEuro.toFixed(2)),
        performance_percent: parseFloat(diffPercent.toFixed(2))
      };
    });

    if (filter && filter.startsWith('profit')) {
      leaders.sort((a, b) => b.performance_euro - a.performance_euro);
    } else if (filter && filter.startsWith('loss')) {
      leaders.sort((a, b) => a.performance_euro - b.performance_euro);
    } else {
      leaders.sort((a, b) => b.net_worth - a.net_worth);
    }

    return {
      leaders: leaders.slice(0, limit),
      season: season,
      pool: await db.getFeePool()
    };
  },

  async updateDailySnapshots() {
    const { data: users } = await db.supabase.from('profiles').select('id, balance');
    const prices = await db.getAllPrices();
    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    for (const user of users) {
      const assets = await db.getAssets(user.id);
      let cryptoValue = 0;
      assets.forEach(a => {
        cryptoValue += Number(a.amount) * (priceMap[a.symbol] || 0);
      });
      const total = Number(user.balance) + cryptoValue;
      await db.supabase.from('profiles').update({ day_start_worth: total }).eq('id', user.id);
    }
  },

  async getActiveSeason() {
    const { data } = await db.supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    return data;
  }
});
