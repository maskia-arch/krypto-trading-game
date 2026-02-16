import { create } from 'zustand';
import { api } from './api';

const useStore = create((set, get) => ({
  // ── State ───────────────────────────────────────────
  version: '0.1',
  profile: null,
  assets: [],
  prices: {},
  prevPrices: {},          // Für Tick-Up / Tick-Down Animation
  chartData: [],
  chartSymbol: 'BTC',
  chartRange: '3h',
  leaderboard: [],
  season: null,
  feePool: 0,
  loading: true,
  error: null,
  tab: 'trade',            // trade | chart | assets | rank
  toast: null,

  // ── Actions ─────────────────────────────────────────
  setTab: (tab) => set({ tab }),
  setChartSymbol: (s) => set({ chartSymbol: s }),
  setChartRange: (r) => set({ chartRange: r }),

  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  loadVersion: async () => {
    try {
      const { version } = await api.getVersion();
      set({ version });
    } catch (e) { /* keep default */ }
  },

  loadProfile: async () => {
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

  refreshPrices: async () => {
    try {
      const old = { ...get().prices };
      const data = await api.getPrices();
      const priceMap = {};
      (data.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });
      set({ prices: priceMap, prevPrices: old });
    } catch (e) { /* silent */ }
  },

  loadChart: async (symbol, range) => {
    try {
      const s = symbol || get().chartSymbol;
      const r = range || get().chartRange;
      const data = await api.getChart(s, r);
      set({ chartData: data.data || [], chartSymbol: s, chartRange: r });
    } catch (e) { /* silent */ }
  },

  buyCrypto: async (symbol, amountEur) => {
    const result = await api.buy(symbol, amountEur);
    await get().loadProfile();
    return result;
  },

  sellCrypto: async (symbol, amountCrypto) => {
    const result = await api.sell(symbol, amountCrypto);
    await get().loadProfile();
    return result;
  },

  loadLeaderboard: async () => {
    try {
      const data = await api.getLeaderboard();
      set({ leaderboard: data.leaders || [], season: data.season, feePool: data.pool || 0 });
    } catch (e) { /* silent */ }
  },
}));

export default useStore;
