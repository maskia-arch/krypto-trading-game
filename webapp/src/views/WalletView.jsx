import React, { useState, useEffect } from 'react';
import TradeView from './TradeView';
import ChartView from './ChartView';
import LiveChart30m from '../components/trading/LiveChart30m';
import LeveragePanel from '../components/trading/LeveragePanel';
import PositionsTable from '../components/trading/PositionsTable';
import useStore from '../lib/store';

export default function WalletView() {
  const [mode, setMode] = useState('spot');
  
  // SICHERHEIT: Wir ziehen nur die benötigte Funktion und prüfen, ob sie existiert
  const fetchLeveragePositions = useStore((state) => state.fetchLeveragePositions);
  const leveragePolicy = useStore((state) => state.leveragePolicy);

  useEffect(() => {
    // Nur ausführen, wenn die Funktion im Store auch wirklich existiert
    if (typeof fetchLeveragePositions === 'function') {
      fetchLeveragePositions().catch(err => console.error("Initial Fetch Error:", err));

      const interval = setInterval(() => {
        fetchLeveragePositions().catch(() => {}); // Fehler im Intervall ignorieren
      }, 8000); // Intervall leicht erhöht auf 8s für bessere Performance

      return () => clearInterval(interval);
    }
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
          {/* FALLBACK: Falls die Hebel-Daten noch laden, zeige einen Lade-Indikator 
              statt die Seite abstürzen zu lassen */}
          {!leveragePolicy ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50 gap-3">
              <div className="w-8 h-8 border-2 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Initialisiere Hebel-Markt...</p>
            </div>
          ) : (
            <>
              {/* 1. Chart */}
              <LiveChart30m />
              
              {/* 2. LeveragePanel */}
              <div className="mt-4 order-1">
                <LeveragePanel />
              </div>
              
              {/* 3. PositionsTable */}
              <div className="mt-6 order-2">
                <PositionsTable /> 
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
