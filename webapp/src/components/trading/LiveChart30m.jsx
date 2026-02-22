import React, { useEffect, useMemo, useState } from 'react';
import useStore from '../../lib/store';

export default function LiveChart30m() {
  const { chartSymbol, chartData, loadChart, prices } = useStore();
  const [timeRange, setTimeRange] = useState('30m');

  const coins = [
    { id: 'BTC', label: 'Bitcoin', color: '#F7931A' },
    { id: 'ETH', label: 'Ethereum', color: '#627EEA' },
    { id: 'LTC', label: 'Litecoin', color: '#BFBBBB' }
  ];

  useEffect(() => {
    if (!chartSymbol) return;
    
    loadChart(chartSymbol, timeRange);
    const interval = setInterval(() => loadChart(chartSymbol, timeRange), 45000);
    return () => clearInterval(interval);
  }, [chartSymbol, timeRange, loadChart]);

  const activeCoin = coins.find(c => c.id === chartSymbol) || coins[0];
  const currentPrice = prices?.[chartSymbol] || 0;

  const chartInfo = useMemo(() => {
    const safeChartData = Array.isArray(chartData) ? chartData : [];

    if (safeChartData.length < 2) {
      return { points: '', fillPoints: '', min: 0, max: 0, lastX: 0, lastY: 0, timestamps: [], priceLabels: [], change: 0, isUp: true, firstPrice: 0, lastPrice: 0 };
    }
    
    const validData = safeChartData.filter(d => !isNaN(Number(d.price_eur)) && d.recorded_at);
    if (validData.length < 2) {
       return { points: '', fillPoints: '', min: 0, max: 0, lastX: 0, lastY: 0, timestamps: [], priceLabels: [], change: 0, isUp: true, firstPrice: 0, lastPrice: 0 };
    }

    const chartPrices = validData.map(d => Number(d.price_eur));
    const min = Math.min(...chartPrices);
    const max = Math.max(...chartPrices);
    const range = (max - min) || 1;
    
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

    // Zeitstempel für X-Achse berechnen (5 Stück gleichmäßig verteilt)
    const numLabels = 5;
    const timestamps = [];
    for (let i = 0; i < numLabels; i++) {
      const idx = Math.round((i / (numLabels - 1)) * (validData.length - 1));
      const d = new Date(validData[idx].recorded_at);
      timestamps.push({
        x: (idx / (validData.length - 1)) * 100,
        label: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      });
    }

    // Preislabels für Y-Achse (3 Stück: min, mid, max)
    const mid = (min + max) / 2;
    const priceLabels = [
      { y: 100 - (((max - min) / range) * 100), value: max },
      { y: 100 - (((mid - min) / range) * 100), value: mid },
      { y: 100 - (((min - min) / range) * 100), value: min },
    ];

    const firstPrice = chartPrices[0];
    const lastPrice = chartPrices[chartPrices.length - 1];
    const change = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    return {
      points: pts.join(' '),
      fillPoints: `0,110 ${pts.join(' ')} 100,110`,
      min,
      max,
      lastX,
      lastY,
      timestamps,
      priceLabels,
      change,
      isUp: change >= 0,
      firstPrice,
      lastPrice
    };
  }, [chartData]);

  // Preis-Formatter
  const fmtPrice = (v) => {
    if (v >= 10000) return v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
    if (v >= 100) return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    return v.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  };

  return (
    <div className="card p-4 space-y-3 border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/60 relative overflow-hidden shadow-xl">
      {/* Hintergrund-Glow */}
      <div className="absolute top-0 right-0 w-40 h-40 blur-[80px] rounded-full pointer-events-none transition-colors duration-700" style={{ backgroundColor: activeCoin.color + '15' }}></div>
      <div className={`absolute bottom-0 left-0 w-24 h-24 blur-[60px] rounded-full pointer-events-none transition-colors duration-700 ${chartInfo.isUp ? 'bg-neon-green/5' : 'bg-neon-red/5'}`}></div>

      {/* Header: Zeitraum-Regler + Preis + Change */}
      <div className="flex justify-between items-start relative z-10">
        <div className="flex flex-col gap-2">
          {/* Time Range Switcher */}
          <div className="flex gap-1 bg-black/60 p-1 rounded-xl border border-white/5 backdrop-blur-md">
            {['10m', '30m'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${
                  timeRange === range 
                    ? 'bg-white/10 text-white shadow-sm border border-white/10' 
                    : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: activeCoin.color }}></span>
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: activeCoin.color }}></span>
            </span>
            <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-[0.2em] font-black">{chartSymbol} · {timeRange}</p>
          </div>
          <p className="text-xl font-mono font-black text-white tracking-tighter leading-none" style={{ textShadow: `0 0 20px ${activeCoin.color}40` }}>
            {currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
          </p>
          {/* Prozent-Änderung */}
          {chartInfo.points && (
            <div className={`flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
              chartInfo.isUp 
                ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' 
                : 'bg-neon-red/10 text-neon-red border border-neon-red/20'
            }`}>
              <span>{chartInfo.isUp ? '▲' : '▼'}</span>
              <span>{Math.abs(chartInfo.change).toFixed(2)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart-Bereich */}
      <div className="w-full relative bg-black/40 rounded-xl overflow-hidden border border-white/5" style={{ paddingTop: '4px' }}>
        
        {/* Horizontale Gitter-Linien */}
        <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none" style={{ top: '4px', bottom: '24px' }}>
          <div className="w-full border-t border-dashed border-white/[0.06]"></div>
          <div className="w-full border-t border-dashed border-white/[0.06]"></div>
          <div className="w-full border-t border-dashed border-white/[0.06]"></div>
          <div className="w-full border-t border-dashed border-white/[0.06]"></div>
        </div>

        {(!Array.isArray(chartData) || chartData.length < 2) ? (
          <div className="flex items-center justify-center flex-col gap-2" style={{ height: '180px' }}>
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${activeCoin.color}80`, borderTopColor: 'transparent' }}></div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">Lade Chartdaten...</p>
          </div>
        ) : (
          <div className="w-full relative">
            {/* Y-Achse Preis-Labels (rechts) */}
            <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-1 pointer-events-none z-20" style={{ bottom: '24px', width: '52px' }}>
              {chartInfo.priceLabels.map((pl, i) => (
                <div key={i} className="text-right pr-2">
                  <span className="text-[8px] font-mono font-bold text-white/25 bg-black/60 px-1 py-0.5 rounded">
                    {fmtPrice(pl.value)}€
                  </span>
                </div>
              ))}
            </div>

            {/* SVG Chart */}
            <div style={{ height: '160px', paddingRight: '50px' }}>
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 -10 100 120">
                <defs>
                  <linearGradient id={`grad30-${chartSymbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeCoin.color} stopOpacity="0.35" />
                    <stop offset="60%" stopColor={activeCoin.color} stopOpacity="0.08" />
                    <stop offset="100%" stopColor={activeCoin.color} stopOpacity="0.0" />
                  </linearGradient>
                  <filter id={`glow30-${chartSymbol}`}>
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Einstiegslinie (Referenz zum ersten Preis) */}
                {chartInfo.firstPrice > 0 && (
                  <line
                    x1="0"
                    y1={100 - (((chartInfo.firstPrice - chartInfo.min) / ((chartInfo.max - chartInfo.min) || 1)) * 100)}
                    x2="100"
                    y2={100 - (((chartInfo.firstPrice - chartInfo.min) / ((chartInfo.max - chartInfo.min) || 1)) * 100)}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="2 3"
                    strokeWidth="0.3"
                  />
                )}

                {/* Fill-Gradient */}
                <polyline
                  fill={`url(#grad30-${chartSymbol})`}
                  stroke="none"
                  points={chartInfo.fillPoints}
                />
                
                {/* Chart-Linie */}
                <polyline
                  fill="none"
                  stroke={activeCoin.color}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={chartInfo.points}
                  filter={`url(#glow30-${chartSymbol})`}
                />
                
                {/* Endpunkt-Dot mit Puls */}
                <circle 
                  cx={chartInfo.lastX} 
                  cy={chartInfo.lastY} 
                  r="3" 
                  fill={activeCoin.color}
                  opacity="0.15"
                >
                  <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle 
                  cx={chartInfo.lastX} 
                  cy={chartInfo.lastY} 
                  r="1.8" 
                  fill="#fff" 
                  stroke={activeCoin.color} 
                  strokeWidth="0.6"
                  filter={`url(#glow30-${chartSymbol})`}
                />
              </svg>
            </div>

            {/* X-Achse Zeitstempel (unten) */}
            <div className="relative w-full border-t border-white/[0.05]" style={{ height: '22px', paddingRight: '50px' }}>
              {chartInfo.timestamps.map((ts, i) => (
                <span
                  key={i}
                  className="absolute text-[8px] font-mono font-bold text-white/25 -translate-x-1/2 pt-1"
                  style={{ left: `${ts.x}%` }}
                >
                  {ts.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats-Leiste unter dem Chart */}
      {chartInfo.points && (
        <div className="flex gap-2 relative z-10">
          <div className="flex-1 bg-black/30 rounded-lg p-2 text-center border border-white/[0.03]">
            <p className="text-[7px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Tief</p>
            <p className="text-[10px] font-mono font-black text-neon-red mt-0.5">{fmtPrice(chartInfo.min)}€</p>
          </div>
          <div className="flex-1 bg-black/30 rounded-lg p-2 text-center border border-white/[0.03]">
            <p className="text-[7px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Hoch</p>
            <p className="text-[10px] font-mono font-black text-neon-green mt-0.5">{fmtPrice(chartInfo.max)}€</p>
          </div>
          <div className="flex-1 bg-black/30 rounded-lg p-2 text-center border border-white/[0.03]">
            <p className="text-[7px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Spanne</p>
            <p className="text-[10px] font-mono font-black text-neon-blue mt-0.5">{fmtPrice(chartInfo.max - chartInfo.min)}€</p>
          </div>
        </div>
      )}
    </div>
  );
}
