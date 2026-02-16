const { db } = require('../core/database');

const GECKO_MAP = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  LTC: 'litecoin'
};

const priceService = {
  async fetchAndStorePrices() {
    try {
      const ids = Object.values(GECKO_MAP).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (!data || Object.keys(data).length === 0) {
        throw new Error('Keine Daten von CoinGecko erhalten');
      }

      for (const symbol of Object.keys(GECKO_MAP)) {
        const geckoId = GECKO_MAP[symbol];
        const price = data[geckoId]?.eur;
        
        if (price === undefined || price === null || price <= 0) {
          console.warn(`⚠️ Ungültiger Preis für ${symbol} ignoriert. (Gesucht nach: ${geckoId})`);
          continue;
        }

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
      console.error('❌ Preis-Fetch Fehler:', err.message);
    }
  }
};

module.exports = { priceService };
