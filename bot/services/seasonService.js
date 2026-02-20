const { db } = require('../core/database');
const { esc } = require('../core/utils');

const seasonService = {
  async checkAndHandleSeasonTransition(bot) {
    try {
      const activeSeason = await db.getActiveSeason();
      
      if (!activeSeason) {
        await this.startNewSeason();
        return;
      }

      const now = new Date();
      const endDate = new Date(activeSeason.end_date);

      if (now >= endDate) {
        await this.distributePrizes(bot, activeSeason);

        await db.supabase
          .from('seasons')
          .update({ is_active: false })
          .eq('id', activeSeason.id);

        await this.startNewSeason();

        await this.resetUserPerformanceSnapshots();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async distributePrizes(bot, season) {
    const pool = await db.getFeePool();
    if (pool <= 0) return;

    const { leaders } = await db.getLeaderboard('profit_season', 10);
    
    const distribution = [0.40, 0.25, 0.15, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04];

    for (let i = 0; i < leaders.length; i++) {
      const winner = leaders[i];
      const share = distribution[i] || 0;
      const prizeMoney = parseFloat((pool * share).toFixed(2));

      if (prizeMoney > 0) {
        const { data: profile } = await db.supabase.from('profiles').select('balance').eq('id', winner.id).single();
        const newBalance = parseFloat((Number(profile.balance) + prizeMoney).toFixed(2));
        await db.updateBalance(winner.id, newBalance);

        await db.supabase.from('transactions').insert({
          profile_id: winner.id,
          type: 'achievement_reward',
          symbol: 'PRIZE',
          total_eur: prizeMoney,
          details: `Season Prize: ${season.name}`
        });

        const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️'];
        const medal = medals[i] || '🎖️';
        
        try {
          await bot.api.sendMessage(winner.telegram_id, 
            `${medal} <b>HERZLICHEN GLÜCKWUNSCH!</b>\n\n` +
            `Du hast die <b>${esc(season.name)}</b> auf Platz <b>${i + 1}</b> abgeschlossen!\n` +
            `Dein Preisgeld von <b>${prizeMoney.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b> wurde deinem Konto gutgeschrieben.\n\nViel Erfolg in der nächsten Season von ValueTradeGame! 🚀`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          console.error(e);
        }
      }
    }

    await db.supabase.from('fee_pool').update({ total_eur: 0 }).eq('id', 1);
  },

  async startNewSeason() {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    const { count } = await db.supabase.from('seasons').select('*', { count: 'exact', head: true });
    const seasonNumber = (count || 0) + 1;

    await db.supabase.from('seasons').insert({
      name: `Season ${seasonNumber}`,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      is_active: true
    });
  },

  async resetUserPerformanceSnapshots() {
    const { data: users } = await db.supabase.from('profiles').select('id, balance');
    if (!users) return;

    const prices = await db.getAllPrices();
    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    const { data: allLevPositions } = await db.supabase
      .from('leveraged_positions')
      .select('*')
      .eq('status', 'OPEN');

    for (const user of users) {
      const assets = await db.getAssets(user.id);
      let cryptoValue = 0;
      assets.forEach(a => {
        cryptoValue += Number(a.amount) * (priceMap[a.symbol] || 0);
      });

      let leverageValue = 0;
      const userPositions = (allLevPositions || []).filter(pos => pos.profile_id === user.id);
      
      userPositions.forEach(pos => {
        const curPrice = priceMap[pos.symbol];
        if (curPrice) {
          const notional = Number(pos.collateral) * Number(pos.leverage);
          let pnl = 0;
          if (pos.direction === 'LONG') {
            pnl = ((curPrice - Number(pos.entry_price)) / Number(pos.entry_price)) * notional;
          } else {
            pnl = ((Number(pos.entry_price) - curPrice) / Number(pos.entry_price)) * notional;
          }
          leverageValue += Math.max(0, Number(pos.collateral) + pnl);
        } else {
          leverageValue += Number(pos.collateral);
        }
      });

      const currentNetWorth = parseFloat((Number(user.balance) + cryptoValue + leverageValue).toFixed(2));

      await db.supabase
        .from('profiles')
        .update({ 
          season_start_worth: currentNetWorth,
          day_start_worth: currentNetWorth 
        })
        .eq('id', user.id);
    }
  }
};

module.exports = { seasonService };
