import React, { useEffect } from 'react';
import useStore from './lib/store';
import { api } from './lib/api';

import Header from './components/layout/Header';
import Navbar from './components/layout/Navbar';
import PriceTicker from './components/layout/PriceTicker';

import ChartView from './views/ChartView';
import AssetsView from './views/AssetsView';
import RankView from './views/RankView';
import SettingsView from './views/SettingsView';
import ProfileView from './views/ProfileView';
import AffiliateView from './views/AffiliateView'; // NEU: Import für das Affiliate-System

const TABS = [
  { id: 'chart', label: 'Chart',  icon: '📊' },
  { id: 'assets', label: 'Assets', icon: '💎' },
  { id: 'rank',  label: 'Rang',   icon: '🏆' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const COIN_META = {
  BTC: { emoji: '₿', name: 'Bitcoin' },
  ETH: { emoji: 'Ξ', name: 'Ethereum' },
  LTC: { emoji: 'Ł', name: 'Litecoin' },
};

export default function App() {
  const { tab, setTab, fetchProfile, refreshPrices, loadVersion, prices, prevPrices, showToast } = useStore();

  useEffect(() => {
    loadVersion();
    fetchProfile();

    const priceInterval = setInterval(() => {
      refreshPrices();
    }, 60000);

    const profileInterval = setInterval(() => {
      fetchProfile();
    }, 15000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(profileInterval);
    };
  }, [fetchProfile, refreshPrices, loadVersion]);

  useEffect(() => {
    const handleStartParam = async () => {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;

      tg.ready();
      const startParam = tg.initDataUnsafe?.start_param;

      if (startParam === 'claim_bonus') {
        try {
          const res = await api.claimBonus();
          showToast(`🎁 Bonus aktiviert: +${res.claimed}€!`, 'success');
          await fetchProfile();
        } catch (err) {
          console.error(err.message);
        }
      }
    };

    handleStartParam();
  }, [fetchProfile, showToast]);

  useEffect(() => {
    if (tab === 'trade') {
      setTab('chart');
    }
  }, [tab, setTab]);

  return (
    <div className="min-h-screen text-white pb-24 select-none">
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.05] bg-[#06080f]/80">
        <Header />
        
        <div className="flex overflow-x-auto no-scrollbar py-2 border-t border-white/[0.03]">
          {Object.keys(COIN_META).map(sym => (
            <PriceTicker 
              key={sym} 
              symbol={sym} 
              price={prices[sym] || 0} 
              prevPrice={prevPrices[sym] || 0} 
            />
          ))}
        </div>
      </header>

      <main className="px-4 pt-4 tab-enter">
        {tab === 'chart' && <ChartView />}
        {tab === 'assets' && <AssetsView />}
        {tab === 'rank' && <RankView />}
        {tab === 'settings' && <SettingsView />}
        {tab === 'profile' && <ProfileView />}
        {tab === 'affiliate' && <AffiliateView />} {/* NEU: Hier wird die Ansicht gerendert */}
      </main>

      <Navbar tabs={TABS} currentTab={tab} onTabChange={setTab} />
    </div>
  );
}
