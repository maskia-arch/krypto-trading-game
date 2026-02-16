import React, { useEffect, useRef } from 'react';
import useStore from './lib/store';
import TradePanel from './components/TradePanel';
import ChartPanel from './components/ChartPanel';
import AssetsPanel from './components/AssetsPanel';
import RankPanel from './components/RankPanel';

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

function PriceTicker({ symbol, price, prevPrice }) {
  const ref = useRef(null);
  const prev = useRef(price);

  useEffect(() => {
    if (!ref.current) return;
    if (price > prev.current) {
      ref.current.classList.remove('tick-down');
      ref.current.classList.add('tick-up');
    } else if (price < prev.current) {
      ref.current.classList.remove('tick-up');
      ref.current.classList.add('tick-down');
    }
    prev.current = price;
    const t = setTimeout(() => {
      ref.current?.classList.remove('tick-up', 'tick-down');
    }, 600);
    return () => clearTimeout(t);
  }, [price]);

  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
         style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[10px] opacity-50">{COIN_META[symbol]?.emoji}</span>
      <span className="text-[10px] font-medium opacity-40">{symbol}</span>
      <span ref={ref} className="text-[11px] font-mono font-semibold">
        {price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
      </span>
    </div>
  );
}

export default function App() {
  const { tab, setTab, profile, prices, prevPrices, version, loading, error, toast,
          loadProfile, loadVersion, refreshPrices } = useStore();

  useEffect(() => {
    loadVersion();
    loadProfile();
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#06080f'); tg.setBackgroundColor('#06080f'); }
    } catch (e) { /* */ }
    const iv = setInterval(refreshPrices, 15000); // alle 15s
    return () => clearInterval(iv);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="text-5xl">📈</div>
          <div className="shimmer h-3 w-32 rounded mx-auto" />
          <p className="text-xs text-[var(--text-dim)]">Marktdaten werden geladen…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="card p-6 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-sm text-neon-red mb-1 font-medium">Verbindungsfehler</p>
          <p className="text-xs text-[var(--text-dim)] mb-4">{error}</p>
          <button onClick={loadProfile}
            className="btn-press px-5 py-2.5 bg-neon-blue/10 text-neon-blue rounded-xl text-sm font-semibold border border-neon-blue/20">
            Erneut verbinden
          </button>
        </div>
      </div>
    );
  }

  const balance = Number(profile?.balance || 0);

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-deep)' }}>

      {/* ── Toast ────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-3 left-3 right-3 z-[100] px-4 py-3 rounded-2xl text-sm font-medium backdrop-blur-md border ${
          toast.type === 'error'
            ? 'bg-neon-red/10 text-neon-red border-neon-red/20'
            : 'bg-neon-green/10 text-neon-green border-neon-green/20'
        }`} style={{ animation: 'tabSlide 0.2s ease-out' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ───────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b"
              style={{ background: 'rgba(6,8,15,0.88)', borderColor: 'var(--border-dim)' }}>
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="live-dot" />
              <div>
                <h1 className="text-sm font-bold tracking-tight">
                  Krypto Game
                  <span className="text-[10px] font-mono font-normal text-[var(--text-dim)] ml-1.5">v{version}</span>
                </h1>
                <p className="text-[11px] text-[var(--text-dim)]">
                  {profile?.first_name || 'Trader'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-base font-mono font-bold ${balance >= 10000 ? 'text-neon-green glow-green' : balance > 0 ? 'text-[var(--text-primary)]' : 'text-neon-red glow-red'}`}>
                {balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
              </p>
              <p className="text-[10px] text-[var(--text-dim)]">Kontostand</p>
            </div>
          </div>
        </div>

        {/* Live Price Ticker */}
        <div className="flex gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
          {Object.entries(prices).map(([sym, price]) => (
            <PriceTicker key={sym} symbol={sym} price={price} prevPrice={prevPrices[sym] || price} />
          ))}
        </div>
      </header>

      {/* ── Content ──────────────────────────────── */}
      <main className="px-4 pt-4 tab-enter" key={tab}>
        {tab === 'trade' && <TradePanel />}
        {tab === 'chart' && <ChartPanel />}
        {tab === 'assets' && <AssetsPanel />}
        {tab === 'rank' && <RankPanel />}
      </main>

      {/* ── Bottom Navigation ────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t bottom-safe"
           style={{ background: 'rgba(6,8,15,0.92)', borderColor: 'var(--border-dim)' }}>
        <div className="flex justify-around pt-1.5 pb-1">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`btn-press flex flex-col items-center px-4 py-1.5 rounded-xl transition-all ${
                  active ? 'bg-white/[0.04]' : ''
                }`}>
                <span className={`text-[20px] transition-transform ${active ? 'scale-110' : 'grayscale opacity-40'}`}>
                  {t.icon}
                </span>
                <span className={`text-[10px] mt-0.5 font-semibold tracking-wide ${
                  active ? 'text-neon-blue' : 'text-[var(--text-dim)]'
                }`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
