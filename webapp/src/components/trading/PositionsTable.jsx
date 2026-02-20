import React, { useState } from 'react';
import useStore from '../../lib/store';

export default function PositionsTable() {
  const { leveragePositions, prices, closeLeveragePosition, partialClosePosition, showToast } = useStore();
  const [busyId, setBusyId] = useState(null);

  if (!Array.isArray(leveragePositions) || leveragePositions.length === 0) {
    return (
      <div className="card p-6 border border-white/5 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden transition-all duration-500">
        <div className="absolute inset-0 bg-neon-blue/5 blur-3xl pointer-events-none"></div>
        <span className="text-3xl opacity-30 drop-shadow-xl relative z-10">📊</span>
        <p className="text-[9px] uppercase tracking-[0.2em] font-black text-[var(--text-dim)] relative z-10">
          Warten auf Markteintritt...
        </p>
      </div>
    );
  }

  const handleClose = async (id, partial = false) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = partial ? await partialClosePosition(id) : await closeLeveragePosition(id);
      const pnlValue = res?.pnl || res?.result?.pnl || 0;
      const emoji = pnlValue >= 0 ? '💰' : '📉';
      const typeText = partial ? 'Teil-Position (50%)' : 'Position';
      
      showToast(`${emoji} ${typeText} geschlossen! PnL: ${pnlValue > 0 ? '+' : ''}${pnlValue.toFixed(2)}€`);
    } catch (err) {
      showToast(`❌ ${err.message || 'Fehler beim Schließen'}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 tab-enter">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse shadow-[0_0_8px_rgba(34,214,138,0.8)]"></div>
          <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">
            Aktive Positionen ({leveragePositions.length})
          </p>
        </div>
      </div>
      
      {leveragePositions.map(pos => {
        const currentPrice = Number(prices[pos.symbol] || pos.entry_price || 0);
        const entryPrice = Number(pos.entry_price || 0);
        const liqPrice = Number(pos.liquidation_price || 0);
        const collateral = Number(pos.collateral || 0);
        const leverage = Number(pos.leverage || 1);
        const notional = collateral * leverage;

        let pnl = 0;
        if (pos.direction === 'LONG') {
          pnl = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * notional : 0;
        } else {
          pnl = entryPrice > 0 ? ((entryPrice - currentPrice) / entryPrice) * notional : 0;
        }

        const pnlPercent = collateral > 0 ? (pnl / collateral) * 100 : 0;
        const isProfit = pnl >= 0;
        const isLong = pos.direction === 'LONG';

        const distanceToLiq = isLong 
          ? (currentPrice > 0 ? ((currentPrice - liqPrice) / currentPrice) * 100 : 0)
          : (currentPrice > 0 ? ((liqPrice - currentPrice) / currentPrice) * 100 : 0);

        return (
          <div key={pos.id} className="card p-3 border border-white/5 relative overflow-hidden bg-gradient-to-br from-[#0a0c14] to-black/80 backdrop-blur-xl shadow-lg transition-all duration-300">
            
            <div className={`absolute -top-10 -right-10 w-32 h-32 blur-[60px] opacity-20 pointer-events-none transition-colors duration-700 ${isLong ? 'bg-neon-green' : 'bg-neon-red'}`} />
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isLong ? 'bg-neon-green shadow-[0_0_10px_rgba(34,214,138,0.5)]' : 'bg-neon-red shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} />
            
            <div className="pl-3 flex justify-between items-start mb-3 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-black text-white drop-shadow-md">{pos.symbol}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border ${
                    isLong ? 'bg-neon-green/10 text-neon-green border-neon-green/20' : 'bg-neon-red/10 text-neon-red border-neon-red/20'
                  }`}>
                    {leverage}x {pos.direction}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-[var(--text-dim)] uppercase font-black tracking-widest">Einstieg</span>
                  <span className="text-xs font-mono font-bold text-white/90">{entryPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</span>
                </div>
              </div>
              
              <div className="text-right">
                <p className={`text-[17px] font-mono font-black tabular-nums tracking-tighter transition-all duration-300 ${
                  isProfit ? 'text-neon-green drop-shadow-[0_0_8px_rgba(34,214,138,0.6)]' : 'text-neon-red drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                }`}>
                  {isProfit ? '+' : ''}{pnl.toFixed(2)}€
                </p>
                <div className={`flex items-center justify-end gap-0.5 text-[10px] font-black mt-0.5 ${isProfit ? 'text-neon-green' : 'text-neon-red'}`}>
                  <span>{isProfit ? '▲' : '▼'}</span>
                  <span>{Math.abs(pnlPercent).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Anzeige für SL / TP Marken */}
            {(pos.stop_loss || pos.take_profit) && (
              <div className="pl-3 flex gap-3 mb-3 relative z-10 border-t border-white/5 pt-2">
                {pos.stop_loss && (
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-neon-red/70 tracking-tighter">Stop Loss</span>
                    <span className="text-[10px] font-mono font-bold text-white/60">{Number(pos.stop_loss).toLocaleString()}€</span>
                  </div>
                )}
                {pos.take_profit && (
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-neon-green/70 tracking-tighter">Take Profit</span>
                    <span className="text-[10px] font-mono font-bold text-white/60">{Number(pos.take_profit).toLocaleString()}€</span>
                  </div>
                )}
              </div>
            )}

            <div className="pl-3 grid grid-cols-3 gap-2 mb-4 relative z-10">
              <div className="bg-white/[0.03] backdrop-blur-sm p-2 rounded-xl border border-white/5">
                <p className="text-[8px] uppercase font-black tracking-wider text-[var(--text-dim)]">Marge</p>
                <p className="text-[11px] font-mono font-bold text-white mt-0.5">{collateral.toFixed(2)}€</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-sm p-2 rounded-xl border border-white/5">
                <p className="text-[8px] uppercase font-black tracking-wider text-[var(--text-dim)]">Markt</p>
                <p className="text-[11px] font-mono font-bold text-neon-blue mt-0.5">{currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-sm p-2 rounded-xl border border-red-500/10">
                <p className="text-[8px] uppercase font-black tracking-wider text-neon-red">Liq. Preis</p>
                <p className="text-[11px] font-mono font-bold text-neon-red/90 mt-0.5">{liqPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</p>
              </div>
            </div>

            {distanceToLiq < 15 && distanceToLiq > 0 && (
              <div className="pl-3 mb-4 relative z-10">
                <div className="flex justify-between text-[8px] font-black uppercase mb-1">
                  <span className="text-neon-red animate-pulse">Margin Call Gefahr!</span>
                  <span className="text-neon-red/70">{distanceToLiq.toFixed(1)}% bis Liq.</span>
                </div>
                <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden border border-red-500/20">
                  <div className="h-full bg-neon-red shadow-[0_0_8px_rgba(244,63,94,0.8)] relative transition-all duration-500" style={{ width: `${Math.max(5, 100 - (distanceToLiq * 6.6))}%` }}>
                    <div className="absolute inset-0 bg-white/30 animate-[pulse_1s_ease-in-out_infinite]" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 relative z-10">
              <button
                onClick={() => handleClose(pos.id, true)}
                disabled={!!busyId}
                className="flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 bg-white/5 text-white/80 active:scale-[0.98] disabled:opacity-50 transition-all hover:bg-white/10"
              >
                {busyId === pos.id ? '...' : 'Partial (50%)'}
              </button>
              
              <button
                onClick={() => handleClose(pos.id, false)}
                disabled={!!busyId}
                className="flex-[2] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 bg-white/10 text-white active:scale-[0.98] disabled:opacity-50 transition-all hover:bg-white/20 hover:border-white/30"
              >
                {busyId === pos.id ? '...' : 'Position schließen'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
