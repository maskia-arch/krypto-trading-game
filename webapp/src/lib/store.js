import { create } from 'zustand';
import client from '../api/client';

const useStore = create((set, get) => ({
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
      const res = await client.get('/api/version');
      set({ version: res.data.version });
    } catch (e) {}
  },

  fetchProfile: async () => {
    try {
      set({ loading: true, error: null });
      const res = await client.get('/api/profile');
      const data = res.data;
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
      const res = await client.get('/api/prices');
      const priceMap = {};
      (res.data.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });
      set({ prices: priceMap, prevPrices: old });
    } catch (e) {}
  },

  loadChart: async (symbol, range) => {
    try {
      const s = symbol || get().chartSymbol;
      const r = range || get().chartRange;
      const res = await client.get(`/api/prices/chart?symbol=${s}&range=${r}`);
      set({ chartData: res.data.data || [], chartSymbol: s, chartRange: r });
    } catch (e) {}
  },

  buyCrypto: async (symbol, amountEur) => {
    const res = await client.post('/api/trading/buy', { symbol, amount_eur: amountEur });
    await get().fetchProfile();
    return res.data;
  },

  sellCrypto: async (symbol, amountCrypto) => {
    const res = await client.post('/api/trading/sell', { symbol, amount_crypto: amountCrypto });
    await get().fetchProfile();
    return res.data;
  },

  loadLeaderboard: async () => {
    try {
      const res = await client.get('/api/economy/leaderboard');
      set({ leaderboard: res.data.leaders || [], season: res.data.season, feePool: res.data.pool || 0 });
    } catch (e) {}
  },
}));

export default useStore;
