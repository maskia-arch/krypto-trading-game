import React, { useEffect, useState } from 'react';
import useStore from '../../lib/store';

export default function PositionsTable() {
  const { leveragePositions, prices, closeLeveragePosition, fetchLeveragePositions, showToast } = useStore();
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    fetchLeveragePositions();
  }, [fetchLeveragePositions]);

  // Sicherstellen, dass leveragePositions ein Array ist und Daten enthält
  if (!Array.isArray(leveragePositions) || leveragePositions.length === 0) {
    return (
      <div className="card p-6 border border-white/5 flex flex-col items-center justify-center text-center space-y-2">
        <span className="text-3xl grayscale opacity-50">📭</span>
        <p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-dim)]">
          Keine offenen Positionen
        </p>
      </div>
    );
  }

  const handleClose = async (id) => {
    setLoadingId(id);
    try {
      const res = await closeLeveragePosition(id);
      // PnL aus dem Resultat oder Fallback auf 0
      const pnlValue = res?.pnl || res?.result?.pnl || 0;
      const emoji = pnlValue >= 0 ? '💰' : '📉';
      
      showToast(`${emoji} Position geschlossen! PnL: ${pnlValue > 0 ? '+' : ''}${pnlValue.toFixed(2)}€`);
    } catch (err) {
      showToast(`❌ ${err.message || 'Fehler beim Schließen'}`, 'error');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-3 tab-enter">
      <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)] px-1">
        Offene Trades ({leveragePositions.length})
      </p>
      
      {leveragePositions.map(pos => {
        // Numerische Konvertierung für Berechnungen
        const currentPrice = Number(prices[pos.symbol] || pos.entry_price || 0);
        const entryPrice = Number(pos.entry_price || 0);
        const liqPrice = Number(pos.liquidation_price || 0);
        const collateral = Number(pos.collateral || 0);
        const leverage = Number(pos.leverage || 1);
        const notional = collateral * leverage;

        // PnL Berechnung
        let pnl = 0;
        if (pos.direction === 'LONG') {
          pnl = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * notional : 0;
        } else {
          pnl = entryPrice > 0 ? ((entryPrice - currentPrice) / entryPrice) * notional : 0;
        }

        const pnlPercent = collateral > 0 ? (pnl / collateral) * 100 : 0;
        const isProfit = pnl >= 0;

        // Abstand zur Liquidation für Warnanzeige
        const distanceToLiq = pos.direction === 'LONG' 
          ? (currentPrice > 0 ? ((currentPrice - liqPrice) / currentPrice) * 100 : 0)
          : (currentPrice > 0 ? ((liqPrice - currentPrice) / currentPrice) * 100 : 0);

        return (
          <div key={pos.id} className="card p-3 border border-white/5 relative overflow-hidden bg-gradient-to-br from-bg-card to-black/40">
            {/* Indikator-Leiste für Long/Short */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${pos.direction === 'LONG' ? 'bg-neon-green' : 'bg-neon-red'}`} />
            
            <div className="pl-2 flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{pos.symbol}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${
                    pos.direction === 'LONG' ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
                  }`}>
                    {leverage}x {pos.direction}
                  </span>
                </div>
                <div className="flex flex-col mt-1">
                  <span className="text-[9px] text-[var(--text-dim)] uppercase font-bold">Einstieg</span>
                  <span className="text-xs font-mono font-bold text-white/80">{entryPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</span>
                </div>
              </div>
              
              <div className="text-right">
                <p className={`text-base font-mono font-black tabular-nums ${isProfit ? 'text-neon-green glow-green' : 'text-neon-red glow-red'}`}>
                  {isProfit ? '+' : ''}{pnl.toFixed(2)}€
                </p>
                <p className={`text-[10px] font-black ${isProfit ? 'text-neon-green' : 'text-neon-red'}`}>
                  {isProfit ? '▲' : '▼'} {Math.abs(pnlPercent).toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Daten-Grid */}
            <div className="pl-2 grid grid-cols-3 gap-2 mb-3">
              <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                <p className="text-[8px] uppercase font-black text-[var(--text-dim)]">Marge</p>
                <p className="text-[11px] font-mono font-bold text-white">{collateral.toFixed(2)}€</p>
              </div>
              <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                <p className="text-[8px] uppercase font-black text-[var(--text-dim)]">Markt</p>
                <p className="text-[11px] font-mono font-bold text-neon-blue">{currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</p>
              </div>
              <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                <p className="text-[8px] uppercase font-black text-neon-red">Liquidation</p>
                <p className="text-[11px] font-mono font-bold text-neon-red/80">{liqPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</p>
              </div>
            </div>

            {/* Margin Call Warnung */}
            {distanceToLiq < 15 && distanceToLiq > 0 && (
              <div className="pl-2 mb-3">
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-neon-red animate-pulse" 
                    style={{ width: `${Math.max(5, 100 - (distanceToLiq * 6.6))}%` }}
                  />
                </div>
                <p className="text-[8px] text-neon-red font-black uppercase mt-1 animate-pulse">Margin Call: Liquidationsgefahr!</p>
              </div>
            )}

            <button
              onClick={() => handleClose(pos.id)}
              disabled={loadingId === pos.id}
              className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border border-white/10 bg-white/5 text-white active:scale-[0.98] hover:bg-white/10 disabled:opacity-50"
            >
              {loadingId === pos.id ? 'Wird geschlossen...' : 'Position schließen'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
