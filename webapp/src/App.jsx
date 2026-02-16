import React, { useEffect } from 'react';
import useStore from './lib/store';

// Import der neuen Layout-Komponenten
import Header from './components/layout/Header';
import Navbar from './components/layout/Navbar';
import PriceTicker from './components/layout/PriceTicker';

// Import der Views (ehemals Panels)
import TradeView from './views/TradeView';
import ChartView from './views/ChartView';
import AssetsView from './views/AssetsView';
import RankView from './views/RankView';

const TABS = [
  { id: 'trade', label: 'Trade',  icon: '📈' },
  { id: 'chart', label: 'Chart',  icon: '📊' },
  { id: 'assets', label: 'Assets', icon: '💎' },
  { id: 'rank',  label: 'Rang',   icon: '🏆' },
];

const COIN_META = {
  BTC: { emoji: '₿', name: 'Bitcoin' },
  ETH: { emoji: 'Ξ', name: 'Ethereum' },
  LTC: { emoji: 'Ł', name: 'Litecoin' },
};

export default function App() {
  const { tab, setTab, fetchProfile, prices, prevPrices } = useStore();

  useEffect(() => {
    fetchProfile();
    const interval = setInterval(fetchProfile, 10000);
    return () => clearInterval(interval);
  }, [fetchProfile]);

  return (
    <div className="min-h-screen text-white pb-24 select-none">
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.05] bg-[#06080f]/80">
        <Header />
        
        <div className="flex overflow-x-auto no-scrollbar py-2 border-t border-white/[0.03]">
          {Object.keys(COIN_META).map(sym => (
            <PriceTicker 
              key={sym} 
              symbol={sym} 
              price={prices[sym]} 
              prevPrice={prevPrices[sym]} 
            />
          ))}
        </div>
      </header>

      <main className="px-4 pt-4 tab-enter" key={tab}>
        {tab === 'trade' && <TradeView />}
        {tab === 'chart' && <ChartView />}
        {tab === 'assets' && <AssetsView />}
        {tab === 'rank' && <RankView />}
      </main>

      <Navbar tabs={TABS} currentTab={tab} onTabChange={setTab} />
    </div>
  );
}
