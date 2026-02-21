import { create } from 'zustand';
import { api } from './api';

const useStore = create((set, get) => ({
  // ... (States bleiben identisch bis leveragePolicy)
  appName: 'ValueTradeGame',
  version: null,
  profile: null,
  assets: [],
  prices: {},
  prevPrices: {},
  chartData: [],
  chartSymbol: 'BTC',
  chartRange: '30m',
  leaderboard: [],
  season: null,
  feePool: 0,
  achievements: [],
  loading: true,
  error: null,
  tab: 'wallet',
  toast: null,
  leveragePositions: [],
  leveragePolicy: null,

  setTab: (tab) => set({ tab }),
  setChartSymbol: (s) => set({ chartSymbol: s }),
  setChartRange: (r) => set({ chartRange: r }),

  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  isPremiumUser: () => {
    const p = get().profile;
    if (!p) return false;
    const isPro = p.is_pro && new Date(p.pro_until) > new Date();
    return !!p.is_admin || isPro;
  },

  // --- LOGIK-FIXES ---

  loadChart: async (symbol, range) => {
    try {
      const data = await api.getChart(symbol || get().chartSymbol, range || get().chartRange);
      if (data && data.data) {
        set({ chartData: data.data });
      }
    } catch (e) {
      console.error("Chart-Ladefehler:", e);
      set({ chartData: [] });
    }
  },

  loadLeaderboard: async (filter) => {
    try {
      const data = await api.getLeaderboard(filter);
      if (data) {
        set({ 
          leaderboard: data.leaders || [],
          season: data.season || null,
          feePool: Number(data.pool) || 0
        });
      }
    } catch (e) {
      console.error("Leaderboard-Ladefehler:", e);
    }
  },

  fetchProfile: async (retryCount = 0) => {
    try {
      const data = await api.getProfile();
      if (!data || !data.profile) throw new Error("Profil-Daten unvollständig.");

      const priceMap = {};
      (data.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });
      
      set({
        profile: { ...data.profile, collectibles: data.collectibles || [] },
        assets: data.assets || [],
        prices: priceMap,
        prevPrices: Object.keys(get().prices).length > 0 ? get().prices : priceMap,
        achievements: data.achievements || [],
        loading: false
      });
    } catch (err) {
      if (retryCount < 2) setTimeout(() => get().fetchProfile(retryCount + 1), 1500);
    }
  },

  fetchLeveragePositions: async () => {
    try {
      const posData = await api.getLeveragePositions();
      set({
        leveragePositions: Array.isArray(posData.positions) ? posData.positions : [],
        leveragePolicy: posData.policy || get().leveragePolicy
      });
    } catch (e) {
      console.error("Leverage Fetch Error:", e);
    }
  },

  // --- MARGIN-BERECHNUNG (GEPANZERT) ---
  getAvailableMargin: () => {
    const profile = get().profile;
    if (!profile) return 0;
    
    const balance = Number(profile.balance || 0);
    const positions = get().leveragePositions || [];
    
    // Summe aller Sicherheiten (Collaterals) der offenen Positionen
    const usedMargin = positions.reduce((sum, pos) => sum + Number(pos.collateral || 0), 0);
    
    // Verhindert, dass durch Gebühren-Lags negative Werte entstehen
    return Math.max(0, balance - usedMargin);
  },

  // --- HANDEL ---
  openLeveragePosition: async (symbol, direction, collateral, leverage, options = {}) => {
    try {
      const res = await api.openLeverage(symbol, direction, collateral, leverage, options);
      // Wichtig: Beides aktualisieren, damit Margin sofort stimmt
      await Promise.all([get().fetchProfile(), get().fetchLeveragePositions()]);
      return res;
    } catch (err) {
      throw err;
    }
  },

  closeLeveragePosition: async (positionId) => {
    try {
      const res = await api.closeLeverage(positionId);
      // Optimistic Update für sofortiges Feedback im UI
      set(state => ({
        leveragePositions: state.leveragePositions.filter(p => p.id !== positionId)
      }));
      await Promise.all([get().fetchProfile(), get().fetchLeveragePositions()]);
      return res;
    } catch (err) {
      throw err;
    }
  }
}));

export default useStore;
