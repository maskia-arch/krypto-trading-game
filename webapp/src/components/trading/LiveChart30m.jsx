import React, { useEffect, useMemo } from 'react';
import useStore from '../../lib/store';

export default function LiveChart30m() {
  const { chartSymbol, setChartSymbol, chartData, loadChart, prices } = useStore();

  const coins = [
    { id: 'BTC', label: 'Bitcoin', color: '#F7931A' },
    { id: 'ETH', label: 'Ethereum', color: '#627EEA' },
    { id: 'LTC', label: 'Litecoin', color: '#BFBBBB' }
  ];

  useEffect(() => {
    loadChart(chartSymbol, '30m');
    const interval = setInterval(() => loadChart(chartSymbol, '30m'), 45000);
    return () => clearInterval(interval);
  }, [chartSymbol, loadChart]);

  const activeCoin = coins.find(c => c.id === chartSymbol) || coins[0];
  const currentPrice = prices[chartSymbol] || 0;

  const points = useMemo(() => {
    if (!chartData || chartData.length === 0) return '';
    
    const chartPrices = chartData.map(d => Number(d.price_eur));
    const min = Math.min(...chartPrices);
    const max = Math.max(...chartPrices);
    const range = max - min || 1;
    
    return chartPrices.map((p, i) => {
      const x = (i / (chartPrices.length - 1)) * 100;
      const y = 100 - (((p - min) / range) * 100);
      return `${x},${y}`;
    }).join(' ');
  }, [chartData]);

  return (
    <div className="card p-4 space-y-4 border border-white/5 ring-1 ring-white/5">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
          {coins.map(c => (
            <button
              key={c.id}
              onClick={() => setChartSymbol(c.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                chartSymbol === c.id 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-[var(--text-dim)] hover:text-white/80'
              }`}
            >
              {c.id}
            </button>
          ))}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest font-bold">30m Live</p>
          <p className="text-sm font-mono font-bold text-white">
            {currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
          </p>
        </div>
      </div>

      <div className="h-32 w-full relative mt-2 bg-black/20 rounded-xl overflow-hidden border border-white/5">
        {(!chartData || chartData.length < 2) ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 -10 100 120">
            <defs>
              <linearGradient id={`grad-${chartSymbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeCoin.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={activeCoin.color} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <polyline
              fill={`url(#grad-${chartSymbol})`}
              stroke="none"
              points={`0,110 ${points} 100,110`}
            />
            <polyline
              fill="none"
              stroke={activeCoin.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
              className="drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
