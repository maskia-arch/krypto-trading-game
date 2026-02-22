import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, ReferenceLine, Tooltip } from 'recharts';
import useStore from '../../lib/store';

// Intelligenter Preis-Formatter
const fmtPrice = (v) => {
  if (v >= 10000) return v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  if (v >= 100) return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return v.toLocaleString('de-DE', { maximumFractionDigits: 2 });
};

// Custom Tooltip für schnelle Insights beim Hovern
const CustomTooltip = ({ active, payload, color }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur-md border border-white/10"
         style={{ background: 'rgba(10,12,20,0.9)' }}>
      <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{payload[0].payload.fullTime}</p>
      <p className="font-mono font-black text-sm drop-shadow-md" style={{ color }}>
        {fmtPrice(Number(payload[0].value))}€
      </p>
    </div>
  );
};

// Custom Dot: Zuverlässiger CSS-Puls, der exakt auf der Linie bleibt
const PulsatingDot = (props) => {
  const { cx, cy, index, dataLength, color } = props;
  
  if (index === dataLength - 1) {
    return (
      <g>
        <circle 
          cx={cx} cy={cy} r="6" 
          fill={color} 
          style={{
            animation: 'liveChartPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            transformOrigin: `${cx}px ${cy}px`
          }}
        />
        <circle cx={cx} cy={cy} r="3" fill="#fff" stroke={color} strokeWidth="1.5" />
        <style>
          {`
            @keyframes liveChartPulse {
              0%, 100% { transform: scale(1); opacity: 0.6; }
              50% { transform: scale(2); opacity: 0; }
            }
          `}
        </style>
      </g>
    );
  }
  return null;
};

export default function LiveChart30m() {
  const { chartSymbol, chartData, loadChart, prices } = useStore();
  const [timeRange, setTimeRange] = useState('30m');

  const coins = [
    { id: 'BTC', label: 'LIVE', color: '#F7931A', gradStart: 'rgba(247,147,26,0.3)', gradEnd: 'rgba(247,147,26,0)' },
    { id: 'ETH', label: 'LIVE', color: '#627EEA', gradStart: 'rgba(98,126,234,0.3)', gradEnd: 'rgba(98,126,234,0)' },
    { id: 'LTC', label: 'LIVE', color: '#BFBBBB', gradStart: 'rgba(191,187,187,0.3)', gradEnd: 'rgba(191,187,187,0)' }
  ];

  useEffect(() => {
    if (!chartSymbol) return;
    
    loadChart(chartSymbol, timeRange);
    const interval = setInterval(() => loadChart(chartSymbol, timeRange), 45000);
    return () => clearInterval(interval);
  }, [chartSymbol, timeRange, loadChart]);

  const activeCoin = coins.find(c => c.id === chartSymbol) || coins[0];
  const currentPrice = prices?.[chartSymbol] || 0;

  // Daten für Recharts aufbereiten
  const chartInfo = useMemo(() => {
    const safeChartData = Array.isArray(chartData) ? chartData : [];
    const validData = safeChartData.filter(d => !isNaN(Number(d.price_eur)) && d.recorded_at);
    
    if (validData.length < 2) return { mappedData: [], min: 0, max: 0, change: 0, isUp: true, firstPrice: 0 };

    const mappedData = validData.map(d => {
      const date = new Date(d.recorded_at);
      return {
        time: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        fullTime: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: Number(d.price_eur),
      };
    });

    const pricesArr = mappedData.map(d => d.price);
    const min = Math.min(...pricesArr);
    const max = Math.max(...pricesArr);
    const firstPrice = pricesArr[0];
    const lastPrice = pricesArr[pricesArr.length - 1];
    const change = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    return {
      mappedData,
      min,
      max,
      change,
      isUp: change >= 0,
      firstPrice
    };
  }, [chartData]);

  const pad = (chartInfo.max - chartInfo.min) * 0.05 || 1;

  return (
    <div className="space-y-3 tab-enter w-full">
      
      {/* Header-Modul: Angleichung an Spot-Chart */}
      <div className="card p-4 border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/60 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full pointer-events-none opacity-20 transition-colors duration-500" style={{ backgroundColor: activeCoin.color }}></div>
        
        <div className="flex items-end justify-between relative z-10 mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: activeCoin.color }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: activeCoin.color }}></span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] font-black text-[var(--text-dim)]">
                ValueTrade Live · {chartSymbol}
              </span>
            </div>
            <p className="text-2xl font-mono font-black tracking-tighter drop-shadow-lg text-white" style={{ textShadow: `0 0 20px ${activeCoin.color}40` }}>
              {currentPrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
            </p>
          </div>
          
          <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black flex items-center gap-1 ${
            chartInfo.isUp ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'bg-neon-red/10 text-neon-red border border-neon-red/20'
          }`}>
            <span>{chartInfo.isUp ? '▲' : '▼'}</span>
            <span>{Math.abs(chartInfo.change).toFixed(2)}%</span>
          </div>
        </div>

        {/* Range Picker (10m / 30m Toggle) */}
        <div className="flex gap-1.5 relative z-10">
          {['10m', '30m'].map(range => {
            const active = timeRange === range;
            return (
              <button key={range} onClick={() => setTimeRange(range)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all duration-300 uppercase ${
                  active 
                    ? 'bg-white/10 text-white shadow-[0_2px_10px_rgba(255,255,255,0.05)] border-white/20' 
                    : 'bg-black/40 text-[var(--text-dim)] border-white/5 hover:text-white/80'
                } border`}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart-Bereich: Komplett an Spot-Chart angepasst */}
      <div className="card overflow-hidden bg-black/40 border border-white/5 relative p-4">
        
        {chartInfo.mappedData.length < 2 ? (
          <div className="flex items-center justify-center h-60">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${activeCoin.color}40`, borderTopColor: 'transparent' }}></div>
          </div>
        ) : (
          <div className="w-full relative" style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartInfo.mappedData} margin={{ top: 10, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id={`grad30-${chartSymbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeCoin.gradStart} />
                    <stop offset="100%" stopColor={activeCoin.gradEnd} />
                  </linearGradient>
                  <filter id={`glow30-${chartSymbol}`}>
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Sauberes Grid */}
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />

                <XAxis 
                  dataKey="time" 
                  stroke="rgba(255,255,255,0.1)" 
                  tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tickMargin={12}
                />
                
                <YAxis 
                  orientation="right"
                  domain={[chartInfo.min - pad, chartInfo.max + pad]} 
                  stroke="transparent"
                  tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
                  tickFormatter={fmtPrice}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                  tickMargin={8}
                />

                <Tooltip content={<CustomTooltip color={activeCoin.color} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }} />

                <ReferenceLine y={chartInfo.firstPrice} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" strokeWidth={1} />

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={activeCoin.color}
                  strokeWidth={2}
                  fill={`url(#grad30-${chartSymbol})`}
                  animationDuration={300}
                  isAnimationActive={false} // Wichtig gegen Flackern beim Live-Daten-Update
                  style={{ filter: `url(#glow30-${chartSymbol})` }}
                  dot={<PulsatingDot dataLength={chartInfo.mappedData.length} color={activeCoin.color} />}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats-Grid: Exakt wie im Spot-Chart */}
      {chartInfo.mappedData.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Tief', value: `${fmtPrice(chartInfo.min)}€`, color: 'text-neon-red' },
            { label: 'Hoch', value: `${fmtPrice(chartInfo.max)}€`, color: 'text-neon-green' },
            { label: 'Spanne', value: `${fmtPrice(chartInfo.max - chartInfo.min)}€`, color: 'text-neon-blue' },
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
