import React, { useState } from 'react';
import TradeView from './TradeView';
import LiveChart30m from '../components/trading/LiveChart30m';
import LeveragePanel from '../components/trading/LeveragePanel';
import PositionsTable from '../components/trading/PositionsTable';

export default function WalletView() {
  const [mode, setMode] = useState('spot');

  return (
    <div className="space-y-4 pb-6 tab-enter">
      
      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
        <button
          onClick={() => setMode('spot')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mode === 'spot' 
              ? 'bg-white/10 text-white shadow-sm' 
              : 'text-[var(--text-dim)] hover:text-white/80'
          }`}
        >
          📈 Spot
        </button>
        <button
          onClick={() => setMode('leverage')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mode === 'leverage' 
              ? 'bg-neon-blue/20 text-neon-blue shadow-[0_0_10px_rgba(59,130,246,0.2)] border border-neon-blue/30' 
              : 'text-[var(--text-dim)] hover:text-white/80'
          }`}
        >
          ⚡ Hebel
        </button>
      </div>

      {mode === 'spot' ? (
        <TradeView />
      ) : (
        <div className="space-y-4 tab-enter">
          <LiveChart30m />
          <LeveragePanel />
          <PositionsTable />
        </div>
      )}

    </div>
  );
}
