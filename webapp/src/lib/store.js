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
        set({ error: "Dein Profil konnte nicht geladen werden.", loading: false });
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
      const [posData, priceData] = await Promise.all([
        api.getLeveragePositions(),
        api.getPrices()
      ]);

      const priceMap = {};
      (priceData.prices || []).forEach(p => { priceMap[p.symbol] = Number(p.price_eur); });

      set({
        leveragePositions: Array.isArray(posData.positions) ? posData.positions : [],
        leveragePolicy: posData.policy || get().leveragePolicy,
        prices: priceMap 
      });
    } catch (e) {
      console.error("Leverage Fetch Error:", e);
    }
  },

  // --- HANDELSAKTIONEN MIT SYNC-FIX ---

  openLeveragePosition: async (symbol, direction, collateral, leverage, options = {}) => {
    try {
      const { leveragePositions, leveragePolicy } = get();
      const isPremium = get().isPremiumUser();
      const maxPos = isPremium ? 3 : (leveragePolicy?.max_positions || 1);

      if (leveragePositions.length >= maxPos) {
        throw new Error(`Limit erreicht: Max ${maxPos} Positionen erlaubt.`);
      }

      const data = await api.openLeverage(symbol, direction, collateral, leverage, options);
      
      // Erst warten, dann UI updaten
      await get().fetchProfile();
      await get().fetchLeveragePositions();
      
      get().showToast("Position eröffnet!", "success");
      return data;
    } catch (err) {
      get().showToast(err.message, "error");
      throw err;
    }
  },

  partialClosePosition: async (positionId) => {
    try {
      const data = await api.partialClose(positionId);
      
      // Sequentielles Update für stabilen State
      await get().fetchProfile();
      await get().fetchLeveragePositions();
      
      get().showToast("Teilschließung erfolgreich", "success");
      return data;
    } catch (err) {
      get().showToast(err.message, "error");
      throw err;
    }
  },

  closeLeveragePosition: async (positionId) => {
    try {
      // 1. Auf API-Bestätigung warten
      const data = await api.closeLeverage(positionId);
      
      // 2. State-Reset erzwingen: Wir setzen die Positionen kurz lokal leer, 
      // falls das Backend langsam ist (Optimistic UI Update)
      set(state => ({
        leveragePositions: state.leveragePositions.filter(p => p.id !== positionId)
      }));

      // 3. Echten DB-Stand laden
      await get().fetchProfile();
      await get().fetchLeveragePositions();
      
      get().showToast("Position geschlossen", "success");
      return data;
    } catch (err) {
      get().showToast(err.message, "error");
      throw err;
    }
  }
}));

export default useStore;
