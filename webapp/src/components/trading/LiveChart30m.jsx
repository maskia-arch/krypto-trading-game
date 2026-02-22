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
    <div className="rounded-lg px-2 py-1 text-xs shadow-xl backdrop-blur-md border border-white/10"
         style={{ background: 'rgba(10,12,20,0.9)' }}>
      <p className="text-[9px] font-bold text-[var(--text-dim)]">{payload[0].payload.time}</p>
      <p className="font-mono font-black text-xs drop-shadow-md" style={{ color }}>
        {fmtPrice(Number(payload[0].value))}€
      </p>
    </div>
  );
};

// Custom Dot: Lässt den letzten Punkt des Graphen pulsieren
const PulsatingDot = (props) => {
  const { cx, cy, index, dataLength, color } = props;
  if (index === dataLength - 1) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill={color} className="animate-ping" opacity={0.4} />
        <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={color} strokeWidth={1.5} />
      </g>
    );
  }
  return null;
};

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

  // Daten für Recharts aufbereiten
  const chartInfo = useMemo(() => {
    const safeChartData = Array.isArray(chartData) ? chartData : [];
    const validData = safeChartData.filter(d => !isNaN(Number(d.price_eur)) && d.recorded_at);
    
    if (validData.length < 2) return { mappedData: [], min: 0, max: 0, change: 0, isUp: true, firstPrice: 0 };

    const mappedData = validData.map(d => {
      const date = new Date(d.recorded_at);
      return {
        time: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
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
          {chartInfo.mappedData.length > 0 && (
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
      <div className="w-full relative bg-black/40 rounded-xl overflow-hidden border border-white/5 p-2 pt-4">
        {chartInfo.mappedData.length < 2 ? (
          <div className="flex items-center justify-center flex-col gap-2" style={{ height: '160px' }}>
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${activeCoin.color}80`, borderTopColor: 'transparent' }}></div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">Lade Chartdaten...</p>
          </div>
        ) : (
          <div className="w-full relative" style={{ height: '160px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartInfo.mappedData} margin={{ top: 5, right: 0, bottom: 0, left: -25 }}>
                <defs>
                  <linearGradient id={`grad30-${chartSymbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeCoin.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={activeCoin.color} stopOpacity={0.0} />
                  </linearGradient>
                  <filter id={`glow30-${chartSymbol}`}>
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="rgba(255,255,255,0.06)" />

                <XAxis 
                  dataKey="time" 
                  stroke="transparent" 
                  tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  tickMargin={8}
                />
                
                <YAxis 
                  orientation="right"
                  domain={[chartInfo.min - pad, chartInfo.max + pad]} 
                  stroke="transparent"
                  tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
                  tickFormatter={fmtPrice}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />

                <Tooltip content={<CustomTooltip color={activeCoin.color} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }} />

                {/* Referenzlinie für den Eröffnungspreis */}
                <ReferenceLine y={chartInfo.firstPrice} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" strokeWidth={1} />

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={activeCoin.color}
                  strokeWidth={1.5}
                  fill={`url(#grad30-${chartSymbol})`}
                  animationDuration={300}
                  isAnimationActive={false} // Verhindert Flackern bei Live-Updates
                  style={{ filter: `url(#glow30-${chartSymbol})` }}
                  dot={<PulsatingDot dataLength={chartInfo.mappedData.length} color={activeCoin.color} />}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats-Leiste unter dem Chart */}
      {chartInfo.mappedData.length > 0 && (
        <div className="flex gap-2 relative z-10">
          <div className="flex-1 bg-black/30 rounded-lg p-2 text-center border border-white/[0.03] hover:bg-white/5 transition-colors">
            <p className="text-[7px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Tief</p>
            <p className="text-[10px] font-mono font-black text-neon-red mt-0.5">{fmtPrice(chartInfo.min)}€</p>
          </div>
          <div className="flex-1 bg-black/30 rounded-lg p-2 text-center border border-white/[0.03] hover:bg-white/5 transition-colors">
            <p className="text-[7px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Hoch</p>
            <p className="text-[10px] font-mono font-black text-neon-green mt-0.5">{fmtPrice(chartInfo.max)}€</p>
          </div>
          <div className="flex-1 bg-black/30 rounded-lg p-2 text-center border border-white/[0.03] hover:bg-white/5 transition-colors">
            <p className="text-[7px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Spanne</p>
            <p className="text-[10px] font-mono font-black text-neon-blue mt-0.5">{fmtPrice(chartInfo.max - chartInfo.min)}€</p>
          </div>
        </div>
      )}
    </div>
  );
}
