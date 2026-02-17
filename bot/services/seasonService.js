const { db } = require('../core/database');
const { esc } = require('../core/utils');

const seasonService = {
  /**
   * Prüft, ob die aktuelle Season abgelaufen ist und leitet den 
   * Übergang zur nächsten Season ein.
   */
  async checkAndHandleSeasonTransition(bot) {
    try {
      const activeSeason = await db.getActiveSeason();
      
      // Falls keine Season existiert, sofort eine neue starten
      if (!activeSeason) {
        console.log("Keine aktive Season gefunden. Initialer Start...");
        await this.startNewSeason();
        return;
      }

      const now = new Date();
      const endDate = new Date(activeSeason.end_date);

      if (now >= endDate) {
        console.log(`Season ${activeSeason.name} ist beendet. Verteilung der Preise startet...`);
        
        // 1. Preise verteilen
        await this.distributePrizes(bot, activeSeason);

        // 2. Aktuelle Season deaktivieren
        await db.supabase
          .from('seasons')
          .update({ is_active: false })
          .eq('id', activeSeason.id);

        // 3. Neue Season starten
        await this.startNewSeason();

        // 4. Statistiken für alle User resetten (Performance Basis)
        await this.resetUserPerformanceSnapshots();
      }
    } catch (err) {
      console.error('Fehler im SeasonService:', err);
    }
  },

  /**
   * Verteilt den Season Pool an die Top 10 Profit-Gewinner
   */
  async distributePrizes(bot, season) {
    const pool = await db.getFeePool();
    if (pool <= 0) return;

    // Wir holen das Leaderboard basierend auf Profit Season
    const { leaders } = await db.getLeaderboard('profit_season', 10);
    
    // Preisverteilung: 🥇 40%, 🥈 25%, 🥉 15%, 🎖️ (4.-10.) 20% / 7
    const distribution = [0.40, 0.25, 0.15, 0.0285, 0.0285, 0.0285, 0.0285, 0.0285, 0.0285, 0.0285];

    for (let i = 0; i < leaders.length; i++) {
      const winner = leaders[i];
      const share = distribution[i] || 0;
      const prizeMoney = pool * share;

      if (prizeMoney > 0) {
        // Gutschrift auf das Konto
        const newBalance = Number(winner.balance) + prizeMoney;
        await db.updateBalance(winner.id, newBalance);

        // Transaktion loggen
        await db.logTransaction(winner.id, 'prize', null, null, null, 0, prizeMoney);

        // Nachricht an den Gewinner
        const medals = ['🥇', '🥈', '🥉', '🎖️'];
        const medal = medals[i] || '🎖️';
        try {
          await bot.api.sendMessage(winner.telegram_id, 
            `${medal} <b>CONGRATULATIONS!</b>\n\n` +
            `Du hast die <b>${season.name}</b> auf Platz <b>${i + 1}</b> abgeschlossen!\n` +
            `Dein Preisgeld von <b>${prizeMoney.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</b> wurde deinem Konto gutgeschrieben.\n\nViel Erfolg in der nächsten Season! 🚀`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          console.error(`Konnte Siegesnachricht an ${winner.telegram_id} nicht senden.`);
        }
      }
    }

    // Pool zurücksetzen
    await db.supabase.from('fee_pool').update({ total_eur: 0 }).eq('id', 1);
  },

  /**
   * Startet eine neue 30-Tage Season
   */
  async startNewSeason() {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30); // Exakt 30 Tage

    const { data: seasons } = await db.supabase.from('seasons').select('id', { count: 'exact' });
    const seasonNumber = (seasons?.length || 0) + 1;

    await db.supabase.from('seasons').insert({
      name: `Season ${seasonNumber}`,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      is_active: true
    });

    console.log(`Neue Season gestartet: Season ${seasonNumber} bis ${endDate.toLocaleDateString()}`);
  },

  /**
   * Setzt die Startwerte für die Profit-Berechnung bei allen Usern zurück
   */
  async resetUserPerformanceSnapshots() {
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

      const currentNetWorth = Number(user.balance) + cryptoValue;

      // Sowohl Season als auch Tag-Start auf aktuellen Wert setzen
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
