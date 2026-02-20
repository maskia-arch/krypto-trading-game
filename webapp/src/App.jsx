import React, { useEffect, useState, useCallback } from 'react';
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
  
  const [authChecking, setAuthChecking] = useState(true);
  const [initError, setInitError] = useState(null);

  // 1. Initialisierung: Version & Profil laden
  useEffect(() => {
    const initApp = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        if (tg) {
          tg.ready();
          tg.expand();
        }
        
        await loadVersion();
        await fetchProfile();
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setAuthChecking(false);
      }
    };

    initApp();

    const priceInterval = setInterval(refreshPrices, 60000);
    const profileInterval = setInterval(() => {
      if (window.Telegram?.WebApp?.initData) fetchProfile();
    }, 20000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(profileInterval);
    };
  }, [fetchProfile, refreshPrices, loadVersion]);

  // 2. Bonus handling via Start-Parameter
  useEffect(() => {
    const checkBonus = async () => {
      const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (startParam === 'claim_bonus' && profile) {
        try {
          const res = await api.claimBonus();
          showToast(`🎁 Bonus aktiviert: +${res.claimed}€!`, 'success');
          fetchProfile();
        } catch (err) {
          console.error("Bonus error:", err.message);
        }
      }
    };
    checkBonus();
  }, [profile, fetchProfile, showToast]);

  // 3. Authentifizierungs-Timeout (Falls nach 10 Sek kein Profil da ist)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!profile && !loading) {
        setInitError("Authentifizierung fehlgeschlagen. Bitte starte die App über den Telegram Bot neu.");
      }
    }, 10000); // 10 Sekunden Puffer
    return () => clearTimeout(timer);
  }, [profile, loading]);

  // Navigation Fix
  useEffect(() => {
    if (tab === 'trade') setTab('wallet');
  }, [tab, setTab]);

  // Lade-Screen (Während der allererste Check läuft)
  if (authChecking || (loading && !profile && !initError)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white bg-[#06080f] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/5 border-t-neon-blue rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">VT</div>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-widest animate-pulse">ValueTrade</h1>
          <p className="text-[10px] font-mono text-[var(--text-dim)] mt-1 uppercase tracking-tighter">
            Verbinde mit Engine {version || '0.2.2'}...
          </p>
        </div>
      </div>
    );
  }

  // Fehler-Screen
  if (initError || (!profile && error)) {
    return (
      <div className="flex h-screen items-center justify-center text-white px-8 text-center bg-[#06080f]">
        <div className="space-y-4">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm text-[var(--text-dim)] leading-relaxed">
            {initError || "Dein Profil konnte nicht geladen werden. Bitte stelle sicher, dass du die App aus dem offiziellen Bot startest."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold active:scale-95 transition-transform"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#06080f] select-none">
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

      <main className="flex-1 view-container overflow-y-auto">
        <div className="px-4 pt-4 pb-20">
          {tab === 'chart' && <ChartView />}
          {tab === 'wallet' && <WalletView />}
          {tab === 'assets' && <AssetsView />}
          {tab === 'rank' && <RankView />}
          {tab === 'settings' && <SettingsView />}
          {tab === 'profile' && <ProfileView />}
          {tab === 'affiliate' && <AffiliateView />}
        </div>
      </main>

      <div className="flex-none">
        <Navbar tabs={TABS} currentTab={tab} onTabChange={setTab} />
      </div>
    </div>
  );
}
