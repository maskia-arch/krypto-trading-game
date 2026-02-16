import { create } from 'zustand';
import { api } from './api';

const useStore = create((set, get) => ({
  // Branding & Status
  appName: 'ValueTradeGame',
  version: '0.1', // Initialer Fallback-Wert
  profile: null,
  assets: [],
  prices: {},
  prevPrices: {},
  chartData: [],
  chartSymbol: 'BTC',
  chartRange: '3h',
  leaderboard: [],
  season: null,
  feePool: 0,
  loading: true,
  error: null,
  tab: 'trade',
  toast: null,

  setTab: (tab) => set({ tab }),
  setChartSymbol: (s) => set({ chartSymbol: s }),
  setChartRange: (r) => set({ chartRange: r }),

  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  // Verbessertes Laden der Version
  loadVersion: async () => {
    try {
      // t-Parameter erzwingt das Umgehen von Browser-Caches
      const res = await fetch('/version.txt?t=' + Date.now(), {
        cache: 'no-store'
      });
      
      if (res.ok) {
        const text = await res.text();
        const cleanVersion = text.trim();
        if (cleanVersion) {
          set({ version: cleanVersion });
          return;
        }
      }
      
      // Fallback auf API falls Datei nicht lesbar
      const data = await api.getVersion().catch(() => null);
      if (data?.version) set({ version: data.version });
      
    } catch (e) {
      console.warn("Version-Fetch fehlgeschlagen, nutze Default.");
      set({ version: 'v0.1.25' }); // Dein aktueller Stand
    }
  },

  fetchProfile: async () => {
    try {
      set({ loading: true, error: null });
      const data = await api.getProfile();
      const priceMap = {};
      (data.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });
      set({
        profile: data.profile,
        assets: data.assets || [],
        prices: priceMap,
        prevPrices: priceMap,
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  loadProfile: async () => {
    return get().fetchProfile();
  },

  refreshPrices: async () => {
    try {
      const old = { ...get().prices };
      const data = await api.getPrices();
      const priceMap = {};
      (data.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });
      set({ prices: priceMap, prevPrices: old });
    } catch (e) {}
  },

  // ValueTrade Engine Chart-Loader
  loadChart: async (symbol, range) => {
    const s = symbol || get().chartSymbol;
    const r = range || get().chartRange;
    
    try {
      const data = await api.getChart(s, r);
      
      // Wenn Daten kommen, aktualisieren wir den State
      if (data && data.data) {
        set({ 
          chartData: data.data, 
          chartSymbol: s, 
          chartRange: r 
        });
      } else {
        // Falls das Array leer ist (Engine liefert noch nichts)
        set({ chartData: [], chartSymbol: s, chartRange: r });
      }
    } catch (e) {
      console.error("ValueTrade Engine: Chart-Verbindung unterbrochen");
      set({ chartData: [] });
    }
  },

  buyCrypto: async (symbol, amountEur) => {
    const data = await api.buy(symbol, amountEur);
    await get().fetchProfile();
    return data;
  },

  sellCrypto: async (symbol, amountCrypto) => {
    const data = await api.sell(symbol, amountCrypto);
    await get().fetchProfile();
    return data;
  },

  loadLeaderboard: async () => {
    try {
      const data = await api.getLeaderboard();
      set({ leaderboard: data.leaders || [], season: data.season, feePool: data.pool || 0 });
    } catch (e) {}
  },
}));

export default useStore;
