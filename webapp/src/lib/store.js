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
  leverageHistory: [],

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

  loadVersion: async () => {
    try {
      const data = await api.getVersion();
      set({ version: data.version || data.v || null });
    } catch (e) {
      console.error(e);
    }
  },

  refreshPrices: async () => {
    try {
      const data = await api.getPrices();
      const priceMap = {};
      (data.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });
      set(state => ({
        prevPrices: Object.keys(state.prices).length > 0 ? state.prices : priceMap,
        prices: priceMap
      }));
    } catch (e) {
      console.error(e);
    }
  },

  loadChart: async (symbol, range) => {
    try {
      const data = await api.getChart(symbol || get().chartSymbol, range || get().chartRange);
      if (data && data.data) {
        set({ chartData: data.data });
      }
    } catch (e) {
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
      console.error(e);
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
        loading: false,
        error: null
      });
    } catch (err) {
      if (retryCount < 2) {
        setTimeout(() => get().fetchProfile(retryCount + 1), 1500);
      } else {
        set({ error: err.message || 'Verbindung fehlgeschlagen', loading: false });
      }
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
      console.error('Fehler beim Laden der Leverage-Positionen:', e);
    }
  },

  fetchLeverageHistory: async () => {
    try {
      const data = await api.getTransactions();
      set({ leverageHistory: data.transactions || [] });
    } catch (e) {
      console.error(e);
    }
  },

  loadPublicProfile: async (id) => {
    try {
      return await api.getPublicProfile(id);
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  getAvailableMargin: () => {
    const profile = get().profile;
    if (!profile) return 0;
    const balance = Number(profile.balance || 0);
    const policy = get().leveragePolicy;
    const maxMarginPct = Number(policy?.max_margin_percent ?? policy?.maxMarginPercent ?? 0.5);
    const maxMargin = balance * maxMarginPct;
    const positions = get().leveragePositions || [];
    const usedMargin = positions.reduce((sum, pos) => sum + Number(pos.collateral || 0), 0);
    return Math.max(0, maxMargin - usedMargin);
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
    const res = await api.openLeverage(symbol, direction, collateral, leverage, options);
    await Promise.all([get().fetchProfile(), get().fetchLeveragePositions()]);
    return res;
  },

  closeLeveragePosition: async (positionId) => {
    const currentPositions = get().leveragePositions;
    const position = currentPositions.find(p => p.id === positionId);

    if (!position) {
      throw new Error('Position nicht gefunden');
    }

    // Optimistic Update: Sofort entfernen
    set({
      leveragePositions: currentPositions.filter(p => p.id !== positionId)
    });

    try {
      const res = await api.closeLeverage(positionId);

      // Erfolg: Neu laden (Sync mit DB)
      await Promise.all([get().fetchProfile(), get().fetchLeveragePositions()]);
      return res;
    } catch (err) {
      // Fehler: Rollback – Position zurückholen
      set({ leveragePositions: currentPositions });
      console.error('Close fehlgeschlagen, Rollback ausgeführt:', err);
      throw err;
    }
  },

  partialClosePosition: async (positionId) => {
    const currentPositions = get().leveragePositions;
    const position = currentPositions.find(p => p.id === positionId);

    if (!position) {
      throw new Error('Position nicht gefunden');
    }

    // Optimistic: Collateral reduzieren (da Partial Close)
    set({
      leveragePositions: currentPositions.map(p =>
        p.id === positionId ? { ...p, collateral: p.collateral * 0.5 } : p
      )
    });

    try {
      const res = await api.partialClose(positionId);

      // Erfolg: Neu laden
      await Promise.all([get().fetchProfile(), get().fetchLeveragePositions()]);
      return res;
    } catch (err) {
      // Fehler: Rollback
      set({ leveragePositions: currentPositions });
      console.error('Partial Close fehlgeschlagen, Rollback:', err);
      throw err;
    }
  }
}));

export default useStore;