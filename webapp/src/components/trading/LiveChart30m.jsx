import React, { useEffect, useMemo, useState } from 'react';
import useStore from '../../lib/store';

export default function LiveChart30m() {
  const { chartSymbol, chartData, loadChart, prices } = useStore();
  // Lokaler State für den Zeitbereich (10m oder 30m)
  const [timeRange, setTimeRange] = useState('30m');

  const coins = [
    { id: 'BTC', label: 'Bitcoin', color: '#F7931A' },
    { id: 'ETH', label: 'Ethereum', color: '#627EEA' },
    { id: 'LTC', label: 'Litecoin', color: '#BFBBBB' }
  ];

  // Effekt zum Laden der Chart-Daten basierend auf Symbol UND Zeitraum
  useEffect(() => {
    loadChart(chartSymbol, timeRange);
    const interval = setInterval(() => loadChart(chartSymbol, timeRange), 45000);
    return () => clearInterval(interval);
  }, [chartSymbol, timeRange, loadChart]);

  const activeCoin = coins.find(c => c.id === chartSymbol) || coins[0];
  const currentPrice = prices[chartSymbol] || 0;

  const chartInfo = useMemo(() => {
    if (!chartData || chartData.length === 0) return { points: '', fillPoints: '', min: 0, max: 0, lastX: 0, lastY: 0 };
    
    const chartPrices = chartData.map(d => Number(d.price_eur));
    const min = Math.min(...chartPrices);
    const max = Math.max(...chartPrices);
    const range = max - min || 1;
    
    let lastX = 0;
    let lastY = 0;

    const pts = chartPrices.map((p, i) => {
      const x = (i / (chartPrices.length - 1)) * 100;
      const y = 100 - (((p - min) / range) * 100);
      if (i === chartPrices.length - 1) {
        lastX = x;
        lastY = y;
      }
      return `${x},${y}`;
    });

    return {
      points: pts.join(' '),
      fillPoints: `0,110 ${pts.join(' ')} 100,110`,
      min,
      max,
      lastX,
      lastY
    };
  }, [chartData]);

  return (
    <div className="card p-4 space-y-4 border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/60 relative overflow-hidden shadow-xl">
      <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full pointer-events-none transition-colors duration-500" style={{ backgroundColor: activeCoin.color + '1A' }}></div>

      <div className="flex justify-between items-start relative z-10">
        {/* Neuer Time-Range-Switcher statt Coin-Selector */}
        <div className="flex gap-1 bg-black/60 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          {['10m', '30m'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                timeRange === range 
                  ? 'bg-white/10 text-white shadow-sm scale-105' 
                  : 'text-[var(--text-dim)] hover:text-white/80'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="text-right flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: activeCoin.color }}></span>
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: activeCoin.color }}></span>
            </span>
            <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-[0.2em] font-black">{timeRange} Live</p>
          </div>
          <p className="text-lg font-mono font-black text-white tracking-tighter mt-0.5">
            {currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
          </p>
        </div>
      </div>

      <div className="h-40 w-full relative mt-4 bg-black/40 rounded-xl overflow-hidden border border-white/5">
        <div className="absolute inset-0 flex flex-col justify-between py-3 px-0 pointer-events-none opacity-20">
          <div className="w-full border-t border-dashed border-white/20"></div>
          <div className="w-full border-t border-dashed border-white/20"></div>
          <div className="w-full border-t border-dashed border-white/20"></div>
        </div>

        {(!chartData || chartData.length < 2) ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${activeCoin.color}80`, borderTopColor: 'transparent' }}></div>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <div className="absolute top-1 right-2 text-[9px] font-mono text-[var(--text-dim)]/50 font-bold">{chartInfo.max.toLocaleString('de-DE')}</div>
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[var(--text-dim)]/50 font-bold">{chartInfo.min.toLocaleString('de-DE')}</div>

            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 -10 100 120">
              <defs>
                <linearGradient id={`grad-${chartSymbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeCoin.color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={activeCoin.color} stopOpacity="0.0" />
                </linearGradient>
                <filter id={`glow-${chartSymbol}`}>
                  <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              <polyline
                fill={`url(#grad-${chartSymbol})`}
                stroke="none"
                points={chartInfo.fillPoints}
              />
              
              <polyline
                fill="none"
                stroke={activeCoin.color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={chartInfo.points}
                filter={`url(#glow-${chartSymbol})`}
              />
              
              <circle 
                cx={chartInfo.lastX} 
                cy={chartInfo.lastY} 
                r="1.5" 
                fill="#fff" 
                stroke={activeCoin.color} 
                strokeWidth="0.5"
                filter={`url(#glow-${chartSymbol})`}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
