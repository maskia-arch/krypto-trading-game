let leaderboardCache = {};

module.exports = (db) => ({
  async getLeaderboard(filter = 'profit_season', limit = 20) {
    const CACHE_DURATION = 0;
    const now = Date.now();

    if (CACHE_DURATION > 0 && leaderboardCache[filter] && (now - leaderboardCache[filter].lastUpdate) < CACHE_DURATION) {
      return {
        ...leaderboardCache[filter].data,
        leaders: leaderboardCache[filter].data.leaders.slice(0, limit),
        fromCache: true
      };
    }

    const [profilesRes, assetsRes, pricesRes, levRes, season, pool] = await Promise.all([
      db.supabase.from('profiles').select('id, telegram_id, username, first_name, balance, avatar_url, is_pro, pro_until, total_volume, season_start_worth, day_start_worth, bonus_received, is_admin'),
      db.supabase.from('assets').select('profile_id, symbol, amount'),
      db.supabase.from('current_prices').select('symbol, price_eur'),
      db.supabase.from('leveraged_positions').select('profile_id, symbol, direction, collateral, leverage, entry_price').eq('status', 'OPEN'),
      this.getActiveSeason(),
      db.getFeePool()
    ]);

    const profiles = profilesRes.data || [];
    const assets = assetsRes.data || [];
    const prices = pricesRes.data || [];
    const levPositions = levRes.data || [];

    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    const userAssets = {};
    assets.forEach(a => {
      if (!userAssets[a.profile_id]) userAssets[a.profile_id] = [];
      userAssets[a.profile_id].push(a);
    });

    const userLev = {};
    levPositions.forEach(p => {
      if (!userLev[p.profile_id]) userLev[p.profile_id] = [];
      userLev[p.profile_id].push(p);
    });

    let leaders = profiles.map(p => {
      let cryptoValue = 0;
      if (userAssets[p.id]) {
        userAssets[p.id].forEach(asset => {
          const currentPrice = priceMap[asset.symbol] || 0;
          cryptoValue += Number(asset.amount) * currentPrice;
        });
      }

      let leverageValue = 0;
      if (userLev[p.id]) {
        userLev[p.id].forEach(pos => {
          const currentPrice = priceMap[pos.symbol];
          if (currentPrice) {
            const notional = Number(pos.collateral) * Number(pos.leverage);
            let pnl = 0;
            if (pos.direction === 'LONG') {
               pnl = ((currentPrice - Number(pos.entry_price)) / Number(pos.entry_price)) * notional;
            } else {
               pnl = ((Number(pos.entry_price) - currentPrice) / Number(pos.entry_price)) * notional;
            }
            let equity = Number(pos.collateral) + pnl;
            leverageValue += Math.max(0, equity);
          } else {
            leverageValue += Number(pos.collateral);
          }
        });
      }
      
      const currentNetWorth = Number(p.balance || 0) + cryptoValue + leverageValue;
      const geschenkt = Number(p.bonus_received || 0);
      const START_KAPITAL = 10000;
      
      let diffEuro = 0;
      let startBasis = START_KAPITAL;

      if (filter.includes('season')) {
        const seasonStart = Number(p.season_start_worth);
        startBasis = (seasonStart && seasonStart > 0) ? seasonStart : START_KAPITAL;
        diffEuro = currentNetWorth - geschenkt - startBasis;
      } else {
        const dayStart = Number(p.day_start_worth);
        startBasis = (dayStart && dayStart > 0) ? dayStart : currentNetWorth;
        diffEuro = currentNetWorth - dayStart; 
      }

      const diffPercent = startBasis > 0 ? (diffEuro / startBasis) * 100 : 0;

      return {
        id: p.id,
        telegram_id: p.telegram_id,
        username: p.username,
        first_name: p.first_name,
        avatar_url: p.avatar_url,
        is_pro: p.is_pro || p.is_admin,
        pro_until: p.pro_until,
        total_volume: p.total_volume,
        bonus_received: geschenkt,
        net_worth: parseFloat(currentNetWorth.toFixed(2)),
        performance_euro: parseFloat(diffEuro.toFixed(2)),
        performance_percent: parseFloat(diffPercent.toFixed(2))
      };
    });

    if (filter.startsWith('loss')) {
      leaders.sort((a, b) => a.performance_euro - b.performance_euro);
    } else {
      leaders.sort((a, b) => b.performance_euro - a.performance_euro);
    }

    const result = {
      leaders: leaders,
      season: season,
      pool: pool
    };

    leaderboardCache[filter] = {
      data: result,
      lastUpdate: now
    };

    return {
      ...result,
      leaders: leaders.slice(0, limit),
      fromCache: false
    };
  },

  async updateDailySnapshots() {
    const { data: users } = await db.supabase.from('profiles').select('id, balance');
    const prices = await db.getAllPrices();
    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    const { data: levPositions } = await db.supabase.from('leveraged_positions').select('*').eq('status', 'OPEN');
    const userLev = {};
    if (levPositions) {
      levPositions.forEach(p => {
        if (!userLev[p.profile_id]) userLev[p.profile_id] = [];
        userLev[p.profile_id].push(p);
      });
    }

    for (const user of users) {
      const assets = await db.getAssets(user.id);
      let cryptoValue = 0;
      assets.forEach(a => {
        cryptoValue += Number(a.amount) * (priceMap[a.symbol] || 0);
      });

      let leverageValue = 0;
      if (userLev[user.id]) {
        userLev[user.id].forEach(pos => {
          const currentPrice = priceMap[pos.symbol];
          if (currentPrice) {
            const notional = Number(pos.collateral) * Number(pos.leverage);
            let pnl = 0;
            if (pos.direction === 'LONG') {
               pnl = ((currentPrice - Number(pos.entry_price)) / Number(pos.entry_price)) * notional;
            } else {
               pnl = ((Number(pos.entry_price) - currentPrice) / Number(pos.entry_price)) * notional;
            }
            leverageValue += Math.max(0, Number(pos.collateral) + pnl);
          } else {
            leverageValue += Number(pos.collateral);
          }
        });
      }

      const total = Number(user.balance) + cryptoValue + leverageValue;
      await db.supabase.from('profiles').update({ day_start_worth: total }).eq('id', user.id);
    }
  },

  async getActiveSeason() {
    const { data } = await db.supabase
      .from('seasons')
      .select('id, name, start_date, end_date, is_active')
      .eq('is_active', true)
      .maybeSingle();
    return data;
  }
});
