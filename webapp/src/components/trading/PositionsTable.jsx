import React, { useEffect, useState } from 'react';
import useStore from '../../lib/store';

export default function PositionsTable() {
  const { leveragePositions, prices, closeLeveragePosition, fetchLeveragePositions, showToast } = useStore();
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    fetchLeveragePositions();
  }, [fetchLeveragePositions]);

  if (!leveragePositions || leveragePositions.length === 0) {
    return (
      <div className="card p-6 border border-white/5 ring-1 ring-white/5 flex flex-col items-center justify-center text-center space-y-2">
        <span className="text-3xl grayscale opacity-50">📭</span>
        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-dim)]">Keine offenen Positionen</p>
      </div>
    );
  }

  const handleClose = async (id) => {
    if (!window.confirm('Möchtest du diese Position wirklich schließen?')) return;
    
    setLoadingId(id);
    try {
      const res = await closeLeveragePosition(id);
      const isProfit = res.result.pnl >= 0;
      const emoji = isProfit ? '📈' : '📉';
      showToast(`${emoji} Position geschlossen! PnL: ${res.result.pnl > 0 ? '+' : ''}${res.result.pnl.toFixed(2)}€`);
    } catch (err) {
      showToast(`❌ ${err.message || 'Fehler beim Schließen'}`, 'error');
    }
    setLoadingId(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)] px-1">Offene Trades ({leveragePositions.length})</p>
      
      {leveragePositions.map(pos => {
        const currentPrice = prices[pos.symbol] || Number(pos.entry_price);
        const entryPrice = Number(pos.entry_price);
        const collateral = Number(pos.collateral);
        const leverage = Number(pos.leverage);
        const notional = collateral * leverage;

        let pnl = 0;
        if (pos.direction === 'LONG') {
          pnl = ((currentPrice - entryPrice) / entryPrice) * notional;
        } else {
          pnl = ((entryPrice - currentPrice) / entryPrice) * notional;
        }

        const equity = collateral + pnl;
        const pnlPercent = (pnl / collateral) * 100;
        const isProfit = pnl >= 0;

        return (
          <div key={pos.id} className="card p-3 border border-white/5 ring-1 ring-white/5 relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${pos.direction === 'LONG' ? 'bg-neon-green' : 'bg-neon-red'}`} />
            
            <div className="pl-2 flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{pos.symbol}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    pos.direction === 'LONG' ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
                  }`}>
                    {pos.leverage}x {pos.direction}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-dim)] font-mono mt-1">
                  Einstieg: {entryPrice.toLocaleString('de-DE', {minimumFractionDigits: 2})}€
                </p>
              </div>
              
              <div className="text-right">
                <p className={`text-sm font-mono font-bold ${isProfit ? 'text-neon-green' : 'text-neon-red'}`}>
                  {isProfit ? '+' : ''}{pnl.toLocaleString('de-DE', {minimumFractionDigits: 2})}€
                </p>
                <p className={`text-[10px] font-bold ${isProfit ? 'text-neon-green' : 'text-neon-red'}`}>
                  {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="pl-2 grid grid-cols-2 gap-2 mb-3">
              <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Marge</p>
                <p className="text-xs font-mono font-bold text-white">{collateral.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</p>
              </div>
              <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Aktuell</p>
                <p className="text-xs font-mono font-bold text-neon-blue">{currentPrice.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</p>
              </div>
            </div>

            <button
              onClick={() => handleClose(pos.id)}
              disabled={loadingId === pos.id}
              className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border bg-white/5 text-white hover:bg-neon-red/20 hover:text-neon-red hover:border-neon-red/30"
            >
              {loadingId === pos.id ? 'Schließt...' : 'Position schließen'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
