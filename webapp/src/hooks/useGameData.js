import { useEffect } from 'react';
import useStore from '../lib/store';

export default function useGameData() {
  const { loadProfile, loadVersion, refreshPrices } = useStore();

  useEffect(() => {
    if (loadVersion) loadVersion();
    if (loadProfile) loadProfile();
    if (refreshPrices) refreshPrices();

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
      if (refreshPrices) refreshPrices();
    }, 15000);

    const profileInterval = setInterval(() => {
      if (loadProfile) loadProfile();
    }, 30000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(profileInterval);
    };
  }, [loadProfile, loadVersion, refreshPrices]);
}
