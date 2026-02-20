const { db } = require('../core/database');

const COINBASE_MAP = {
  BTC: 'BTC',
  ETH: 'ETH',
  LTC: 'LTC'
};

const priceService = {
  async fetchAndStorePrices() {
    try {
      const url = `https://api.coinbase.com/v2/exchange-rates?currency=EUR`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      
      const json = await res.json();
      if (!json || !json.data || !json.data.rates) {
        throw new Error('Keine Raten von Coinbase erhalten');
      }

      const rates = json.data.rates;

      for (const symbol of Object.keys(COINBASE_MAP)) {
        const coinKey = COINBASE_MAP[symbol];
        const rateStr = rates[coinKey];

        if (!rateStr) continue;

        const price = 1 / Number(rateStr);

        if (isNaN(price) || price <= 0) continue;

        await db.supabase
          .from('current_prices')
          .upsert({ 
            symbol, 
            price_eur: price, 
            updated_at: new Date().toISOString() 
          });

        await db.supabase
          .from('market_history')
          .insert({ 
            symbol, 
            price_eur: price,
            recorded_at: new Date().toISOString()
          });
      }
      
      await this.updateTrailingStops();
      
      console.log(`✅ ValueTrade Engine: Preise archiviert & Trailing-Checks ausgeführt (${new Date().toLocaleTimeString('de-DE')})`);
    } catch (err) {
      console.error(`❌ Preis-Fetch Fehler: ${err.message}`);
    }
  },

  async updateTrailingStops() {
    try {
      const { data: positions } = await db.supabase
        .from('leveraged_positions')
        .select('*')
        .eq('status', 'OPEN')
        .eq('trailing_stop', true);

      if (!positions || positions.length === 0) return;

      const { data: prices } = await db.supabase.from('current_prices').select('*');
      const priceMap = {};
      prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

      for (const pos of positions) {
        const currentPrice = priceMap[pos.symbol];
        if (!currentPrice) continue;

        const entryPrice = Number(pos.entry_price);
        const currentSL = pos.stop_loss ? Number(pos.stop_loss) : null;
        
        if (!currentSL) continue;

        const distance = Math.abs(entryPrice - currentSL);
        let newSL = null;

        if (pos.direction === 'LONG') {
          const targetSL = currentPrice - distance;
          if (targetSL > currentSL) {
            newSL = targetSL;
          }
        } else if (pos.direction === 'SHORT') {
          const targetSL = currentPrice + distance;
          if (targetSL < currentSL) {
            newSL = targetSL;
          }
        }

        if (newSL) {
          await db.supabase
            .from('leveraged_positions')
            .update({ stop_loss: newSL })
            .eq('id', pos.id);
        }
      }
    } catch (err) {
      console.error(`❌ Trailing-Stop Update Fehler: ${err.message}`);
    }
  }
};

module.exports = { priceService };
