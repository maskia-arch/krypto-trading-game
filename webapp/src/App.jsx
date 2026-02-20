import React, { useEffect, useState } from 'react';
import useStore from './lib/store';
import { api } from './lib/api';

import Header from './components/layout/Header';
import Navbar from './components/layout/Navbar';
import PriceTicker from './components/layout/PriceTicker';

import ChartView from './views/ChartView';
import WalletView from './views/WalletView';
import AssetsView from './views/AssetsView';
import RankView from './views/RankView';
import SettingsView from './views/SettingsView';
import ProfileView from './views/ProfileView';
import AffiliateView from './views/AffiliateView';

const TABS = [
  { id: 'chart', label: 'Chart',  icon: '📊' },
  { id: 'wallet', label: 'Wallet', icon: '💳' },
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
  const { 
    tab, setTab, fetchProfile, refreshPrices, loadVersion, 
    prices, prevPrices, showToast, loading, error, version, profile 
  } = useStore();
  
  const [timeoutError, setTimeoutError] = useState(null);

  useEffect(() => {
    loadVersion();
    fetchProfile();

    const priceInterval = setInterval(() => {
      refreshPrices();
    }, 60000);

    const profileInterval = setInterval(() => {
      if (!timeoutError) fetchProfile();
    }, 15000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(profileInterval);
    };
  }, [fetchProfile, refreshPrices, loadVersion, timeoutError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!profile) {
        setTimeoutError("Bitte nutze den Telegram Bot, um dich in deinem Spielprofil anzumelden.");
      }
    }, 60000);
    return () => clearTimeout(timer);
  }, [profile]);

  useEffect(() => {
    const handleStartParam = async () => {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;

      tg.ready();
      tg.expand(); // Sorgt dafür, dass die App den ganzen Screen nutzt
      
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
      setTab('wallet');
    }
  }, [tab, setTab]);

  const hasAuthError = timeoutError || (!profile && !loading && error);

  if (hasAuthError) {
    return (
      <div className="flex h-screen items-center justify-center text-white px-6 text-center bg-[#06080f]">
        <p className="text-sm text-[var(--text-dim)]">
          {timeoutError || "Bitte nutze den Telegram Bot, um dich in deinem Spielprofil anzumelden."}
        </p>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white bg-[#06080f] space-y-2">
        <h1 className="text-2xl font-bold tracking-widest">ValueTradeGame</h1>
        <p className="text-sm font-mono text-[var(--text-dim)]">V{version || '0.2'}</p>
        <div className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full animate-spin mt-4"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#06080f]">
      {/* Feststehender Header */}
      <header className="flex-none z-50 backdrop-blur-xl border-b border-white/[0.05] bg-[#06080f]/80">
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

      {/* Scrollbarer Inhaltsbereich */}
      <main className="flex-1 view-container">
        <div className="px-4 pt-4">
          {tab === 'chart' && <ChartView />}
          {tab === 'wallet' && <WalletView />}
          {tab === 'assets' && <AssetsView />}
          {tab === 'rank' && <RankView />}
          {tab === 'settings' && <SettingsView />}
          {tab === 'profile' && <ProfileView />}
          {tab === 'affiliate' && <AffiliateView />}
        </div>
      </main>

      {/* Feststehende Navbar */}
      <div className="flex-none">
        <Navbar tabs={TABS} currentTab={tab} onTabChange={setTab} />
      </div>
    </div>
  );
}
