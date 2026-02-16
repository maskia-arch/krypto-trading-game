import { useEffect } from 'react';
import useStore from '../lib/store';

export default function useGameData() {
  const { 
    loadProfile, 
    loadVersion, 
    refreshPrices, 
    loadChart, 
    chartSymbol, 
    chartRange 
  } = useStore();

  useEffect(() => {
    // Initialer Daten-Load
    if (loadVersion) loadVersion();
    if (loadProfile) loadProfile();
    if (refreshPrices) refreshPrices();
    
    // WICHTIG: Chart-Daten beim Start laden
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

    // Intervalle für Live-Updates
    const priceInterval = setInterval(() => {
      if (refreshPrices) refreshPrices();
    }, 15000);

    const profileInterval = setInterval(() => {
      if (loadProfile) loadProfile();
    }, 30000);

    // Chart alle 60 Sekunden im Hintergrund aktualisieren
    const chartInterval = setInterval(() => {
      if (loadChart) loadChart(chartSymbol, chartRange);
    }, 60000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(profileInterval);
      clearInterval(chartInterval);
    };
  }, [loadProfile, loadVersion, refreshPrices, loadChart, chartSymbol, chartRange]);
}
