import { create } from 'zustand';
import { api } from './api';

const useStore = create((set, get) => ({
  appName: 'ValueTradeGame',
  version: '0.1',
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

  loadVersion: async () => {
    try {
      const data = await api.getVersion();
      if (data && data.version) {
        set({ version: data.version });
      }
    } catch (e) {}
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

  loadChart: async (symbol, range) => {
    const s = symbol || get().chartSymbol;
    const r = range || get().chartRange;
    
    try {
      const data = await api.getChart(s, r);
      
      if (data && data.data) {
        set({ 
          chartData: data.data, 
          chartSymbol: s, 
          chartRange: r 
        });
      } else {
        set({ chartData: [], chartSymbol: s, chartRange: r });
      }
    } catch (e) {
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

  // Aktualisierte Leaderboard-Logik mit Filter-Support
  loadLeaderboard: async (filter = 'profit_season') => {
    try {
      // Wir übergeben den Filter an die API (muss in api.js ggf. noch angepasst werden)
      const data = await api.getLeaderboard(filter);
      set({ 
        leaderboard: data.leaders || [], 
        season: data.season, 
        feePool: data.pool || 0 
      });
    } catch (e) {
      console.error('Leaderboard Store Error:', e);
    }
  },
}));

export default useStore;
