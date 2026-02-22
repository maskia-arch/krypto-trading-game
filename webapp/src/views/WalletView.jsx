import React, { useState, useEffect, useRef } from 'react';
import TradeView from './TradeView';
import ChartView from './ChartView';
import LiveChart30m from '../components/trading/LiveChart30m';
import LeveragePanel from '../components/trading/LeveragePanel';
import PositionsTable from '../components/trading/PositionsTable';
import useStore from '../lib/store';

const COINS = {
  BTC: { name: 'Bitcoin',  emoji: '₿', color: '#f7931a', bg: 'rgba(247,147,26,0.1)', border: 'rgba(247,147,26,0.2)' },
  ETH: { name: 'Ethereum', emoji: 'Ξ', color: '#627eea', bg: 'rgba(98,126,234,0.1)',  border: 'rgba(98,126,234,0.2)' },
  LTC: { name: 'Litecoin', emoji: 'Ł', color: '#bfbbbb', bg: 'rgba(191,187,187,0.1)', border: 'rgba(191,187,187,0.2)' },
};

export default function WalletView() {
  const [mode, setMode] = useState('spot');
  
  const { 
    fetchLeveragePositions, 
    leveragePolicy, 
    isClosing,
    chartSymbol, 
    setChartSymbol,
    prices 
  } = useStore();
  
  const isClosingRef = useRef(isClosing);

  useEffect(() => {
    isClosingRef.current = isClosing;
  }, [isClosing]);

  useEffect(() => {
    if (typeof fetchLeveragePositions === 'function') {
      fetchLeveragePositions().catch(err => console.error("Initial Fetch Error:", err));

      const interval = setInterval(() => {
        if (isClosingRef.current) return;
        fetchLeveragePositions().catch(() => {});
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [fetchLeveragePositions]);

  // Der zentrale Coin Selector, der nun für BEIDE Modi genutzt wird
  const renderCoinSelector = () => (
    <div className="flex gap-2">
      {Object.entries(COINS).map(([sym, info]) => {
        const active = chartSymbol === sym;
        const p = prices?.[sym] || 0;
        return (
          <button key={sym} onClick={() => setChartSymbol(sym)}
            className="flex-1 rounded-2xl p-3 text-center transition-all relative overflow-hidden bg-black/40 border border-white/5 active:scale-95"
            style={{
              borderColor: active ? info.border : 'rgba(255,255,255,0.05)',
              background: active ? info.bg : 'rgba(0,0,0,0.4)',
            }}>
            <div className="text-xl leading-none mb-1.5">{info.emoji}</div>
            <div className={`text-[10px] font-black tracking-widest ${active ? 'text-white' : 'text-white/40'}`}>
              {sym}
            </div>
            {/* Preis nur anzeigen, wenn er geladen ist (Spot-Style) */}
            {mode === 'spot' && p > 0 && (
              <div className="text-[9px] font-mono mt-1 text-white/20">
                {p.toLocaleString('de-DE', { maximumFractionDigits: 0 })}€
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 pb-6 tab-enter">
      {/* Mode Switcher */}
      <div className="flex bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-inner">
        <button
          onClick={() => setMode('spot')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl transition-all duration-300 ${
            mode === 'spot' 
              ? 'bg-white/10 text-white shadow-[0_2px_10px_rgba(255,255,255,0.05)] border border-white/10' 
              : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
          }`}
        >
          📈 Spot
        </button>
        <button
          onClick={() => setMode('leverage')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl transition-all duration-300 ${
            mode === 'leverage' 
              ? 'bg-neon-blue/20 text-neon-blue shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-neon-blue/30' 
              : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
          }`}
        >
          ⚡ Hebel
        </button>
      </div>

      {mode === 'spot' ? (
        <div className="space-y-4 tab-enter">
          <ChartView />
          {/* NEU: Coin Selector hier eingefügt */}
          {renderCoinSelector()}
          {/* ACHTUNG: Du musst die Coin-Buttons in TradeView.jsx entfernen, sonst sind sie dort doppelt! */}
          <TradeView hideCoinSelector={true} /> 
        </div>
      ) : (
        <div className="flex flex-col space-y-4 tab-enter">
          {!leveragePolicy ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50 gap-3">
              <div className="w-8 h-8 border-2 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Initialisiere Hebel-Markt...</p>
            </div>
          ) : (
            <>
              <LiveChart30m />
              
              {/* NEU: Coin Selector DIREKT unter dem Chart */}
              {renderCoinSelector()}
              
              <PositionsTable />
              
              {/* LeveragePanel nutzt den prop hideCoinSelector (falls du ihn implementiert hast) */}
              <LeveragePanel hideCoinSelector={true} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
