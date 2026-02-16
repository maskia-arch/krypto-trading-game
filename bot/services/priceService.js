const { db } = require('../core/database');

const BINANCE_MAP = {
  BTC: 'BTCEUR',
  ETH: 'ETHEUR',
  LTC: 'LTCEUR'
};

const priceService = {
  async fetchAndStorePrices() {
    try {
      const symbols = JSON.stringify(Object.values(BINANCE_MAP));
      const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`;
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }
      
      const data = await res.json();

      if (!data || data.length === 0) {
        throw new Error('Keine Daten erhalten');
      }

      const priceMap = {};
      data.forEach(item => {
        priceMap[item.symbol] = Number(item.price);
      });

      for (const symbol of Object.keys(BINANCE_MAP)) {
        const binanceSymbol = BINANCE_MAP[symbol];
        const price = priceMap[binanceSymbol];
        
        if (price === undefined || price === null || price <= 0 || isNaN(price)) {
          console.warn(`⚠️ Ungültiger Preis für ${symbol} ignoriert.`);
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
