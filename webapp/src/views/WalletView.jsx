import React, { useState, useEffect } from 'react';
import TradeView from './TradeView';
import ChartView from './ChartView';
import LiveChart30m from '../components/trading/LiveChart30m';
import LeveragePanel from '../components/trading/LeveragePanel';
import PositionsTable from '../components/trading/PositionsTable';
import useStore from '../lib/store';

export default function WalletView() {
  const [mode, setMode] = useState('spot');
  const { fetchLeveragePositions } = useStore();

  useEffect(() => {
    fetchLeveragePositions();

    const interval = setInterval(() => {
      fetchLeveragePositions();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchLeveragePositions]);

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

      {/* Content Rendering */}
      {mode === 'spot' ? (
        <div className="space-y-4 tab-enter">
          <ChartView />
          <TradeView />
        </div>
      ) : (
        <div className="flex flex-col tab-enter">
          {/* 1. Chart (Bleibt oben) */}
          <LiveChart30m />
          
          {/* 2. LeveragePanel (Coin-Wechsler & Kaufmenü) 
              Hier liegen die Buttons, die fest unter dem Chart kleben sollen.
          */}
          <div className="mt-4 order-1">
            <LeveragePanel />
          </div>
          
          {/* 3. PositionsTable (Aktive Positionen) 
              Durch 'order-2' und die Platzierung im Code wandern sie UNTER das Panel 
              oder bleiben übersichtlich getrennt.
          */}
          <div className="mt-6 order-2">
            <PositionsTable /> 
          </div>
        </div>
      )}
    </div>
  );
}
