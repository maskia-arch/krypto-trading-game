import { useEffect } from 'react';
import useStore from '../lib/store';

export default function useGameData() {
  const { 
    fetchProfile, 
    loadVersion, 
    refreshPrices, 
    loadChart, 
    chartSymbol, 
    chartRange,
    fetchLeveragePositions,
    profile
  } = useStore();

  useEffect(() => {
    loadVersion();
    fetchProfile();
    refreshPrices();
    fetchLeveragePositions();
    
    if (loadChart) {
      loadChart(chartSymbol, chartRange);
    }

    try {
      const tg = window.Telegram?.WebApp;
      if (tg) { 
        tg.ready(); 
        tg.expand(); 
        tg.setHeaderColor('#06080f'); 
        tg.setBackgroundColor('#06080f');
      }
    } catch (e) {}

    const priceInterval = setInterval(() => {
      refreshPrices();
    }, 15000);

    const profileInterval = setInterval(() => {
      fetchProfile();
      fetchLeveragePositions();
    }, 15000);

    const chartInterval = setInterval(() => {
      loadChart(chartSymbol, chartRange);
    }, 60000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(profileInterval);
      clearInterval(chartInterval);
    };
  }, [fetchProfile, loadVersion, refreshPrices, loadChart, chartSymbol, chartRange, fetchLeveragePositions]);

  useEffect(() => {
    if (profile) {
      const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
      if (!isPro && profile.background_url) {
        fetchProfile();
      }
    }
  }, [profile, fetchProfile]);
}
