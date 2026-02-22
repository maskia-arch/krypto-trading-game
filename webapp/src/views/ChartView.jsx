import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid
} from 'recharts';
import useStore from '../lib/store';

const RANGES = [
  { key: '1m',  label: 'LIVE' },
  { key: '3h',  label: '3H' },
  { key: '12h', label: '12H' },
  { key: '24h', label: '24H' },
];

const COIN_THEME = {
  BTC: { stroke: '#f7931a', gradStart: 'rgba(247,147,26,0.3)', gradEnd: 'rgba(247,147,26,0)' },
  ETH: { stroke: '#627eea', gradStart: 'rgba(98,126,234,0.3)',  gradEnd: 'rgba(98,126,234,0)' },
  LTC: { stroke: '#bfbbbb', gradStart: 'rgba(191,187,187,0.3)', gradEnd: 'rgba(191,187,187,0)' },
};

// Intelligenter Preis-Formatter aus LiveChart30m adaptiert
const fmtPrice = (v) => {
  if (v >= 10000) return v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  if (v >= 100) return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return v.toLocaleString('de-DE', { maximumFractionDigits: 2 });
};

const CustomTooltip = ({ active, payload, theme }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur-md border border-white/10"
         style={{ background: 'rgba(10,12,20,0.9)' }}>
      <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{payload[0].payload.fullTime}</p>
      <p className="font-mono font-black text-sm drop-shadow-md" style={{ color: theme.stroke }}>
        {fmtPrice(Number(payload[0].value))}€
      </p>
    </div>
  );
};

export default function ChartView() {
  const { chartData, chartSymbol, chartRange, prices, loadChart, setChartRange } = useStore();
  const [loading, setLoading] = useState(false);
  const refreshTimer = useRef(null);

  const doLoad = useCallback(async (sym, range) => {
    setLoading(true);
    await loadChart(sym, range);
    setLoading(false);
  }, [loadChart]);

  useEffect(() => {
    doLoad(chartSymbol, chartRange);
    refreshTimer.current = setInterval(() => doLoad(chartSymbol, chartRange), 60000);
    return () => clearInterval(refreshTimer.current);
  }, [chartSymbol, chartRange, doLoad]);

  const switchRange = (r) => { setChartRange(r); };

  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  // --- SICHERHEITS-PANZERUNG ---
  const safeChartData = Array.isArray(chartData) ? chartData : [];

  let mappedData = safeChartData.map(d => {
    const date = new Date(d.recorded_at || Date.now());
    return {
      time: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      fullTime: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      price: Number(d.price_eur) || 0,
      ts: date.getTime(),
    };
  });

  if (chartRange === '1m') {
    mappedData = mappedData.filter(d => d.ts >= oneHourAgo);
  }

  const priceVals = mappedData.map(d => d.price).filter(p => p > 0);
  const minP = priceVals.length ? Math.min(...priceVals) : 0;
  const maxP = priceVals.length ? Math.max(...priceVals) : 100;
  const pad = (maxP - minP) * 0.05 || 1;

  const first = mappedData.length ? mappedData[0].price : 0;
  const last = mappedData.length ? mappedData[mappedData.length - 1].price : 0;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const isUp = change >= 0;

  const theme = COIN_THEME[chartSymbol] || COIN_THEME.BTC;
  const livePrice = prices?.[chartSymbol] || last || 0;

  return (
    <div className="space-y-3 tab-enter w-full">
      
      {/* Header-Modul: Preis & Range-Picker */}
      <div className="card p-4 border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/60 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full pointer-events-none opacity-20 transition-colors duration-500" style={{ backgroundColor: theme.stroke }}></div>
        
        <div className="flex items-end justify-between relative z-10 mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: theme.stroke }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: theme.stroke }}></span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] font-black text-[var(--text-dim)]">
                ValueTrade Live · {chartSymbol}
              </span>
            </div>
            <p className="text-2xl font-mono font-black tracking-tighter drop-shadow-lg text-white" style={{ textShadow: `0 0 20px ${theme.stroke}40` }}>
              {livePrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
            </p>
          </div>
          
          <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black flex items-center gap-1 ${
            isUp ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-neon-red/10 text-neon-red border border-neon-red/20'
          }`}>
            <span>{isUp ? '▲' : '▼'}</span>
            <span>{Math.abs(change).toFixed(2)}%</span>
          </div>
        </div>

        {/* Range Picker */}
        <div className="flex gap-1.5 relative z-10">
          {RANGES.map(r => {
            const active = chartRange === r.key;
            return (
              <button key={r.key} onClick={() => switchRange(r.key)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all duration-300 ${
                  active 
                    ? 'bg-white/10 text-white shadow-[0_2px_10px_rgba(255,255,255,0.05)] border-white/20' 
                    : 'bg-black/40 text-[var(--text-dim)] border-white/5 hover:text-white/80'
                } border`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart-Bereich */}
      <div className="card overflow-hidden bg-black/40 border border-white/5 relative p-4">
        
        {loading && mappedData.length === 0 ? (
          <div className="flex items-center justify-center h-60">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${theme.stroke}40`, borderTopColor: 'transparent' }}></div>
          </div>
        ) : mappedData.length > 0 ? (
          <div className="w-full relative" style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* Margin Right und Left angepasst für maximalen Platz */}
              <AreaChart data={mappedData} margin={{ top: 10, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id={`grad-${chartSymbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.gradStart} />
                    <stop offset="100%" stopColor={theme.gradEnd} />
                  </linearGradient>
                  <filter id={`glow-${chartSymbol}`}>
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Sauberes Grid integriert */}
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />

                <XAxis
                  dataKey="time"
                  stroke="rgba(255,255,255,0.1)"
                  tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                  minTickGap={40} // Verhindert überlappende Zeiten
                />
                
                {/* Y-Achse nach Rechts verschoben wie im Trading-Standard */}
                <YAxis
                  orientation="right"
                  domain={[minP - pad, maxP + pad]}
                  stroke="transparent"
                  tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
                  tickFormatter={fmtPrice}
                  width={55}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                
                <ReferenceLine y={first} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" strokeWidth={1} />
                <Tooltip content={<CustomTooltip theme={theme} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={theme.stroke}
                  strokeWidth={2}
                  fill={`url(#grad-${chartSymbol})`}
                  animationDuration={400}
                  dot={false}
                  activeDot={{ r: 4, fill: '#fff', stroke: theme.stroke, strokeWidth: 2 }}
                  style={{ filter: `url(#glow-${chartSymbol})` }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 gap-3 opacity-50">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${theme.stroke}40`, borderTopColor: 'transparent' }}></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Warte auf Marktdaten...</p>
          </div>
        )}
      </div>

      {/* Stats-Grid (Tief, Hoch, Spanne) - Angleichung an LiveChart30m Wording */}
      {mappedData.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Tief', value: `${fmtPrice(minP)}€`, color: 'text-neon-red' },
            { label: 'Hoch', value: `${fmtPrice(maxP)}€`, color: 'text-neon-green' },
            { label: 'Spanne', value: `${fmtPrice(maxP - minP)}€`, color: 'text-neon-blue' },
          ].map(s => (
            <div key={s.label} className="card p-2 border border-white/5 bg-black/30 text-center hover:bg-white/5 transition-colors rounded-lg">
              <p className="text-[8px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">{s.label}</p>
              <p className={`text-[11px] font-mono font-black mt-1 ${s.color} drop-shadow-sm`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
