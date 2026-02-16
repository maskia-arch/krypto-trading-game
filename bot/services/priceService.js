// ============================================================
// SERVICE: PRICE FETCHER (services/priceService.js)
// ============================================================

const { COINS } = require('../core/config');
const { db } = require('../core/database');

const priceService = {
  /**
   * Holt aktuelle Kurse von CoinGecko und speichert sie in Supabase
   * Betrifft die Tabellen: current_prices und market_history
   */
  async fetchAndStorePrices() {
    try {
      // IDs für CoinGecko vorbereiten (z.B. "bitcoin,ethereum,litecoin")
      const ids = Object.values(COINS).map(c => c.gecko).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (!data || Object.keys(data).length === 0) {
        throw new Error('Keine Daten von CoinGecko erhalten');
      }

      for (const [symbol, info] of Object.entries(COINS)) {
        const price = data[info.gecko]?.eur;
        
        // ENGINE-CHECK: Nur speichern, wenn ein gültiger Preis existiert
        if (price === undefined || price === null || price <= 0) {
          console.warn(`⚠️ Ungültiger Preis für ${symbol} ignoriert.`);
          continue;
        }

        // 1. Aktuellen Preis in 'current_prices' aktualisieren (Upsert)
        await db.supabase
          .from('current_prices')
          .upsert({ 
            symbol, 
            price_eur: price, 
            updated_at: new Date().toISOString() 
          });

        // 2. Preis in 'market_history' für Charts archivieren (Insert)
        // WICHTIG: Die Tabelle muss mit der economy.js übereinstimmen!
        await db.supabase
          .from('market_history')
          .insert({ 
            symbol, 
            price_eur: price,
            recorded_at: new Date().toISOString() // Expliziter Zeitstempel für die Engine
          });
      }
      
      console.log(`✅ ValueTrade Engine: Preise archiviert (${new Date().toLocaleTimeString('de-DE')})`);
    } catch (err) {
      console.error('❌ Preis-Fetch Fehler:', err.message);
    }
  }
};

module.exports = { priceService };
