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
      
      console.log(`✅ ValueTrade Engine: Preise archiviert (${new Date().toLocaleTimeString('de-DE')})`);
    } catch (err) {
      console.error(`❌ Preis-Fetch Fehler: ${err.message}`);
    }
  }
};

module.exports = { priceService };
