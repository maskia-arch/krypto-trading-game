import { create } from 'zustand';
import { api } from './api';

const useStore = create((set, get) => ({
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

  // --- NEU: CHART LOGIK FIX ---
  loadChart: async (symbol, range) => {
    try {
      // Wir setzen die Daten nicht auf leer, um Flackern zu vermeiden, 
      // aber wir könnten ein lokales loading-Flag setzen falls gewünscht.
      const data = await api.getChart(symbol || get().chartSymbol, range || get().chartRange);
      if (data && data.data) {
        set({ chartData: data.data });
      }
    } catch (e) {
      console.error("Chart-Ladefehler:", e);
      set({ chartData: [] }); // Fallback auf leeres Array bei Fehler
    }
  },

  // --- NEU: LEADERBOARD LOGIK FIX ---
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

  loadVersion: async () => {
    try {
      const data = await api.getVersion();
      if (data && data.version) {
        set({ version: data.version });
      }
    } catch (e) {
      console.error("Versions-Fehler:", e);
    }
  },

  fetchProfile: async (retryCount = 0) => {
    try {
      if (!get().profile && retryCount === 0) set({ loading: true });
      const data = await api.getProfile();
      if (!data || !data.profile) throw new Error("Profil-Daten unvollständig.");

      const priceMap = {};
      (data.prices || []).forEach(p => { 
        priceMap[p.symbol] = Number(p.price_eur); 
      });
      
      set({
        profile: { ...data.profile, collectibles: data.collectibles || [] },
        assets: data.assets || [],
        prices: priceMap,
        prevPrices: Object.keys(get().prices).length > 0 ? get().prices : priceMap,
        achievements: data.achievements || [],
        loading: false,
        error: null
      });
    } catch (err) {
      if (retryCount < 2) {
        setTimeout(() => get().fetchProfile(retryCount + 1), 1500);
      } else {
        set({ error: "Profil-Fehler", loading: false });
      }
    }
  },

  loadProfile: async () => get().fetchProfile(),

  refreshPrices: async () => {
    try {
      const old = { ...get().prices };
      const data = await api.getPrices();
      const priceMap = {};
      (data.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });
      set({ prices: priceMap, prevPrices: old });
    } catch (e) {}
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

  getAvailableMargin: () => {
    const balance = Number(get().profile?.balance || 0);
    // Verwendete Margin aller offenen Positionen abziehen
    const usedMargin = get().leveragePositions.reduce((sum, pos) => sum + Number(pos.collateral || 0), 0);
    return Math.max(0, balance - usedMargin);
  },

  buyCrypto: async (symbol, amount_eur) => {
    const res = await api.buy(symbol, amount_eur);
    await get().fetchProfile();
    return res;
  },

  sellCrypto: async (symbol, amount_crypto) => {
    const res = await api.sell(symbol, amount_crypto);
    await get().fetchProfile();
    return res;
  },

  openLeveragePosition: async (symbol, direction, collateral, leverage, options = {}) => {
    try {
      const res = await api.openLeverage(symbol, direction, collateral, leverage, options);
      await Promise.all([get().fetchProfile(), get().fetchLeveragePositions()]);
      return res;
    } catch (err) {
      throw err;
    }
  },

  partialClosePosition: async (positionId) => {
    try {
      const res = await api.partialClose(positionId);
      await Promise.all([get().fetchProfile(), get().fetchLeveragePositions()]);
      return res;
    } catch (err) {
      throw err;
    }
  },

  closeLeveragePosition: async (positionId) => {
    try {
      const res = await api.closeLeverage(positionId);
      // Optimistic Update: Position sofort aus der Liste entfernen
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
