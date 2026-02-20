import React, { useEffect, useState } from 'react';
import useStore from '../../lib/store';

export default function OrderHistory() {
  const { chartSymbol, prices, leverageHistory, fetchLeverageHistory } = useStore();
  const [filter, setFilter] = useState('all'); // 'all', 'profit', 'loss'

  useEffect(() => {
    if (fetchLeverageHistory) {
      fetchLeverageHistory();
    }
  }, [fetchLeverageHistory]);

  const filteredOrders = (leverageHistory || []).filter(order => {
    if (filter === 'profit') return Number(order.pnl) > 0;
    if (filter === 'loss') return Number(order.pnl) < 0;
    return true;
  });

  if (!leverageHistory || leverageHistory.length === 0) {
    return (
      <div className="card p-6 border border-white/5 bg-black/20 text-center">
        <p className="text-[10px] uppercase tracking-widest font-black text-white/20">Keine abgeschlossenen Trades</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 tab-enter">
      {/* Header & Filter */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">
          Trade Historie
        </p>
        <div className="flex gap-2">
          {['all', 'profit', 'loss'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={`text-[9px] uppercase font-black px-2 py-1 rounded-md transition-all ${
                filter === f ? 'bg-white/10 text-white' : 'text-white/20'
              }`}
            >
              {f === 'all' ? 'Alle' : f === 'profit' ? 'Gewinn' : 'Verlust'}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="space-y-2">
        {filteredOrders.map((order) => {
          const isProfit = Number(order.pnl) >= 0;
          return (
            <div key={order.id} className="card p-3 border border-white/5 bg-black/40 flex justify-between items-center relative overflow-hidden">
              {/* Status-Indikator an der Seite */}
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isProfit ? 'bg-neon-green/40' : 'bg-neon-red/40'}`} />
              
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white">{order.symbol}</span>
                  <span className="text-[8px] text-white/40 uppercase font-bold">{new Date(order.closed_at).toLocaleDateString()}</span>
                </div>
                <div className={`text-[9px] px-1.5 py-0.5 rounded border ${
                  order.direction === 'LONG' ? 'border-neon-green/20 text-neon-green' : 'border-neon-red/20 text-neon-red'
                }`}>
                  {order.leverage}x {order.direction}
                </div>
              </div>

              <div className="text-right">
                <p className={`text-xs font-mono font-black ${isProfit ? 'text-neon-green' : 'text-neon-red'}`}>
                  {isProfit ? '+' : ''}{Number(order.pnl).toFixed(2)}€
                </p>
                <p className="text-[9px] text-white/20 font-mono">
                  ROI: {((Number(order.pnl) / Number(order.collateral)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
