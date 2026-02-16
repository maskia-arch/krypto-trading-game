import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import useStore from '../lib/store';

const RANGES = [
  { key: '3h',  label: '3H' },
  { key: '12h', label: '12H' },
  { key: '24h', label: '24H' },
];

const COIN_THEME = {
  BTC: { stroke: '#f7931a', gradStart: 'rgba(247,147,26,0.25)', gradEnd: 'rgba(247,147,26,0)' },
  ETH: { stroke: '#627eea', gradStart: 'rgba(98,126,234,0.25)',  gradEnd: 'rgba(98,126,234,0)' },
  LTC: { stroke: '#bfbbbb', gradStart: 'rgba(191,187,187,0.20)', gradEnd: 'rgba(191,187,187,0)' },
};

export default function ChartView() {
  const { chartData, chartSymbol, chartRange, prices, loadChart, setChartSymbol, setChartRange } = useStore();
  const [loading, setLoading] = useState(false);
  const refreshTimer = useRef(null);

  const doLoad = useCallback(async (sym, range) => {
    setLoading(true);
    await loadChart(sym, range);
    setLoading(false);
  }, [loadChart]);

  useEffect(() => {
    doLoad(chartSymbol, chartRange);
    refreshTimer.current = setInterval(() => doLoad(chartSymbol, chartRange), 30000);
    return () => clearInterval(refreshTimer.current);
  }, [chartSymbol, chartRange, doLoad]);

  const switchCoin = (sym) => { setChartSymbol(sym); };
  const switchRange = (r) => { setChartRange(r); };

  const data = chartData.map(d => ({
    time: new Date(d.recorded_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    price: Number(d.price_eur),
    ts: new Date(d.recorded_at).getTime(),
  }));

  const priceVals = data.map(d => d.price);
  const minP = priceVals.length ? Math.min(...priceVals) : 0;
  const maxP = priceVals.length ? Math.max(...priceVals) : 100;
  const pad = (maxP - minP) * 0.05 || 1;

  const first = data.length ? data[0].price : 0;
  const last = data.length ? data[data.length - 1].price : 0;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const isUp = change >= 0;

  const theme = COIN_THEME[chartSymbol] || COIN_THEME.BTC;
  const livePrice = prices[chartSymbol] || last;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur-md"
           style={{ background: 'rgba(12,16,25,0.92)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ color: 'var(--text-dim)' }}>{payload[0].payload.time}</p>
        <p className="font-mono font-bold text-sm" style={{ color: theme.stroke }}>
          {Number(payload[0].value).toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-4">

      <div className="flex gap-1.5">
        {Object.entries(COIN_THEME).map(([sym, t]) => {
          const active = chartSymbol === sym;
          return (
            <button key={sym} onClick={() => switchCoin(sym)}
              className={`btn-press flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                active ? 'text-white' : 'text-[var(--text-dim)]'
              }`}
              style={{
                background: active ? `${t.stroke}15` : 'var(--bg-card)',
                border: `1px solid ${active ? `${t.stroke}30` : 'var(--border-dim)'}`,
                color: active ? t.stroke : undefined,
              }}>
              {sym}
            </button>
          );
        })}
      </div>

      <div className="card p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="live-dot" />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>
                Live · {chartSymbol}
              </span>
            </div>
            <p className="text-3xl font-mono font-bold" style={{ color: theme.stroke }}>
              {livePrice.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${
            isUp ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
          }`}>
            {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="flex gap-1.5">
        {RANGES.map(r => {
          const active = chartRange === r.key;
          return (
            <button key={r.key} onClick={() => switchRange(r.key)}
              className={`btn-press flex-1 py-2 rounded-xl text-xs font-bold transition-all`}
              style={{
                background: active ? 'rgba(255,255,255,0.06)' : 'var(--bg-card)',
                border: `1px solid ${active ? 'rgba(255,255,255,0.1)' : 'var(--border-dim)'}`,
                color: active ? 'var(--text-primary)' : 'var(--text-dim)',
              }}>
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden" style={{ padding: '12px 4px 4px 0' }}>
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center h-72">
            <div className="shimmer h-3 w-28 rounded" />
          </div>
        ) : data.length > 0 ? (
          <div style={{ position: 'relative' }}>
            {loading && (
              <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg"
                   style={{ background: 'rgba(6,8,15,0.8)' }}>
                <div className="live-dot" style={{ width: 5, height: 5 }} />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--text-dim)' }}>Aktualisiert…</span>
              </div>
            )}
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`grad-${chartSymbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.gradStart} />
                    <stop offset="100%" stopColor={theme.gradEnd} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="transparent"
                  tick={{ fontSize: 9, fill: '#4b5c72', fontFamily: 'JetBrains Mono' }}
                  interval="preserveStartEnd"
                  tickCount={5}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[minP - pad, maxP + pad]}
                  stroke="transparent"
                  tick={{ fontSize: 9, fill: '#4b5c72', fontFamily: 'JetBrains Mono' }}
                  tickFormatter={v => `${v.toFixed(0)}`}
                  width={48}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine y={first} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)' }} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={theme.stroke}
                  strokeWidth={2}
                  fill={`url(#grad-${chartSymbol})`}
                  animationDuration={400}
                  dot={false}
                  activeDot={{ r: 4, fill: theme.stroke, stroke: '#06080f', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-72 gap-2">
            <span className="text-4xl">📊</span>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Noch keine Daten</p>
            <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Preise werden minütlich gespeichert</p>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Tief', value: `${minP.toLocaleString('de-DE', { maximumFractionDigits: 2 })}€`, color: 'text-neon-red' },
            { label: 'Hoch', value: `${maxP.toLocaleString('de-DE', { maximumFractionDigits: 2 })}€`, color: 'text-neon-green' },
            { label: 'Datenpunkte', value: data.length, color: 'text-neon-blue' },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>{s.label}</p>
              <p className={`text-xs font-mono font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
