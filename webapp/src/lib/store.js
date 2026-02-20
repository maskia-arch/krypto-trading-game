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
  chartRange: '30m', // Standard auf 30m für Hebel-Ansicht
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

  fetchProfile: async () => {
    try {
      if (!get().profile) {
        set({ loading: true });
      }
      set({ error: null });
      
      const data = await api.getProfile();
      const priceMap = {};
      (data.prices || []).forEach(p => { 
        priceMap[p.symbol] = Number(p.price_eur); 
      });
      
      set({
        profile: { ...data.profile, collectibles: data.collectibles || [] },
        assets: data.assets || [],
        prices: priceMap,
        prevPrices: get().prices[Object.keys(priceMap)[0]] ? get().prices : priceMap,
        achievements: data.achievements || [],
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  loadProfile: async () => {
    return get().fetchProfile();
  },

  loadPublicProfile: async (id) => {
    try {
      const data = await api.getPublicProfile(id);
      return { 
        ...data.profile, 
        collectibles: data.collectibles || [] 
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  refreshPrices: async () => {
    try {
      const old = { ...get().prices };
      const data = await api.getPrices();
      const priceMap = {};
      (data.prices || []).forEach(p => { 
        priceMap[p.symbol] = Number(p.price_eur); 
      });
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

  loadLeaderboard: async (filter = 'profit_season') => {
    try {
      const data = await api.getLeaderboard(filter);
      set({ 
        leaderboard: data.leaders || [], 
        season: data.season, 
        feePool: data.pool || 0 
      });
    } catch (e) {
      console.error(e);
    }
  },

  fetchLeveragePositions: async () => {
    try {
      const [posData, priceData] = await Promise.all([
        api.getLeveragePositions(),
        api.getPrices()
      ]);

      const priceMap = {};
      (priceData.prices || []).forEach(p => { 
        priceMap[p.symbol] = Number(p.price_eur); 
      });

      set({
        leveragePositions: Array.isArray(posData.positions) ? posData.positions : [],
        leveragePolicy: posData.policy || get().leveragePolicy,
        prices: priceMap 
      });
    } catch (e) {
      console.error("Leverage Fetch Error:", e);
    }
  },

  getAvailableMargin: () => {
    const { profile, leveragePositions, leveragePolicy } = get();
    if (!profile) return 0;

    const factor = leveragePolicy?.margin_limit_factor ?? 0.5;
    const usedMargin = (leveragePositions || []).reduce((sum, p) => sum + Number(p.collateral), 0);
    const maxMargin = Number(profile.balance) * factor;
    
    return Math.max(0, maxMargin - usedMargin);
  },

  openLeveragePosition: async (symbol, direction, collateral, leverage) => {
    const available = get().getAvailableMargin();
    if (Number(collateral) > available) {
      throw new Error(`Limit überschritten. Verfügbare Margin: ${available.toFixed(2)}€`);
    }

    const data = await api.openLeverage(symbol, direction, collateral, leverage);
    await Promise.all([
      get().fetchProfile(),
      get().fetchLeveragePositions()
    ]);
    return data;
  },

  closeLeveragePosition: async (positionId) => {
    const data = await api.closeLeverage(positionId);
    await Promise.all([
      get().fetchProfile(),
      get().fetchLeveragePositions()
    ]);
    return data;
  }
}));

export default useStore;
