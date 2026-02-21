import React, { useEffect, useState } from 'react';
import useStore from './lib/store';
import { api } from './lib/api';

import Header from './components/layout/Header';
import Navbar from './components/layout/Navbar';
import PriceTicker from './components/layout/PriceTicker';

import WalletView from './views/WalletView';
import AssetsView from './views/AssetsView';
import RankView from './views/RankView';
import SettingsView from './views/SettingsView';
import ProfileView from './views/ProfileView';
import AffiliateView from './views/AffiliateView';

const TABS = [
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
    loadChart, chartSymbol, chartRange,
    prices, prevPrices, showToast, loading, error, version, profile 
  } = useStore();
  
  const [authChecking, setAuthChecking] = useState(true);
  const lastKnownVersion = localStorage.getItem('vt_last_version') || '...';

  useEffect(() => {
    if (version) {
      localStorage.setItem('vt_last_version', version);
    }
  }, [version]);

  useEffect(() => {
    const initApp = async () => {
      // Sicherheits-Timeout: Wenn nach 8 Sekunden nichts geladen ist, 
      // beenden wir den Ladebildschirm trotzdem, um die UI anzuzeigen.
      const fallbackTimer = setTimeout(() => {
        setAuthChecking(false);
      }, 8000);

      try {
        const tg = window.Telegram?.WebApp;
        if (tg) {
          tg.ready();
          tg.expand();
          tg.setBackgroundColor('#06080f');
          tg.setHeaderColor('#06080f');
        }
        
        // Führt alle Initialisierungen parallel aus
        await Promise.allSettled([
          loadVersion(),
          fetchProfile(),
          loadChart(chartSymbol, chartRange)
        ]);
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        clearTimeout(fallbackTimer);
        setAuthChecking(false);
      }
    };

    initApp();

    const priceInterval = setInterval(refreshPrices, 60000); // Preis-Update alle 60s
    const profileInterval = setInterval(() => {
      if (profile) fetchProfile(); // Profil-Update nur bei existierendem Profil
    }, 25000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(profileInterval);
    };
  }, [fetchProfile, refreshPrices, loadVersion, loadChart, chartSymbol, chartRange, profile]);

  useEffect(() => {
    const checkBonus = async () => {
      const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (startParam === 'claim_bonus' && profile && !profile.inactivity_bonus_claimed) {
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

  useEffect(() => {
    if (tab === 'trade' || tab === 'chart') {
      setTab('wallet'); // Erzwingt Wallet-Tab bei ungültigen Zuständen
    }
  }, [tab, setTab]);

  // Ladebildschirm-Logik mit Fallback-Schutz
  if (authChecking || (loading && !profile && !error)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white bg-[#06080f] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/5 border-t-neon-blue rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">VT</div>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-widest animate-pulse">ValueTrade</h1>
          <p className="text-[10px] font-mono text-[var(--text-dim)] mt-1 uppercase tracking-tighter">
            Verbinde mit Engine v{version || lastKnownVersion}...
          </p>
        </div>
      </div>
    );
  }

  // Fehler-Screen nur bei echtem Fehler ohne Profil-Daten
  if (error && !profile) {
    return (
      <div className="flex h-screen items-center justify-center text-white px-8 text-center bg-[#06080f]">
        <div className="space-y-6 max-w-xs">
          <div className="text-5xl animate-bounce">⚠️</div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Verbindung instabil</h2>
            <p className="text-xs text-[var(--text-dim)] leading-relaxed">
              {error}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest"
          >
            🔄 System Neustart
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
        <div className="px-4 pt-4 pb-24">
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
