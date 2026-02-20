import React, { useState, useEffect } from 'react';
import useStore from '../../lib/store';

const COINS = {
  BTC: { name: 'Bitcoin',  emoji: '₿', color: '#f7931a', bg: 'rgba(247,147,26,0.1)', border: 'rgba(247,147,26,0.2)' },
  ETH: { name: 'Ethereum', emoji: 'Ξ', color: '#627eea', bg: 'rgba(98,126,234,0.1)',  border: 'rgba(98,126,234,0.2)' },
  LTC: { name: 'Litecoin', emoji: 'Ł', color: '#bfbbbb', bg: 'rgba(191,187,187,0.1)', border: 'rgba(191,187,187,0.2)' },
};

export default function LeveragePanel() {
  const { 
    profile, chartSymbol, setChartSymbol, prices, openLeveragePosition, 
    showToast, leveragePolicy, leveragePositions, getAvailableMargin,
    fetchLeveragePositions
  } = useStore();
  
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState(2);
  const [loadingDir, setLoadingDir] = useState(null);
  const [direction, setDirection] = useState('LONG');

  useEffect(() => {
    fetchLeveragePositions();
  }, [fetchLeveragePositions]);

  if (!leveragePolicy) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  const coin = chartSymbol;
  const currentPrice = prices[coin] || 0;
  const maxLev = leveragePolicy?.max_leverage || 5;
  const maxPos = leveragePolicy?.max_positions || 1;
  const currentOpen = leveragePositions?.length || 0;
  const availableMargin = getAvailableMargin();

  const collatNum = Number(collateral) || 0;
  const notional = collatNum * leverage;
  const fee = notional * 0.005;
  const totalCost = collatNum + fee;

  const liqLong = currentPrice * (1 - (1 / leverage) * 0.9);
  const liqShort = currentPrice * (1 + (1 / leverage) * 0.9);

  const canOpen = currentOpen < maxPos;
  const hasMargin = collatNum <= availableMargin && totalCost <= Number(profile?.balance) && collatNum > 0;

  const handleOpen = async (dir) => {
    if (collatNum > availableMargin) {
      return showToast(`Margin-Limit überschritten! Verfügbar: ${availableMargin.toFixed(2)}€`, 'error');
    }
    if (totalCost > Number(profile?.balance)) {
      return showToast('Nicht genug Cash für Gebühren', 'error');
    }
    if (!canOpen) {
      return showToast(`Limit erreicht: Max ${maxPos} Position(en)`, 'error');
    }

    setLoadingDir(dir);
    try {
      await openLeveragePosition(coin, dir, collatNum, leverage);
      showToast(`⚡ ${leverage}x ${dir} auf ${coin} geöffnet!`);
      setCollateral('');
    } catch (err) {
      showToast(`❌ ${err.message || 'Fehler'}`, 'error');
    } finally {
      setLoadingDir(null);
    }
  };

  const setPercent = (pct) => {
    let amount = availableMargin * pct;
    const feeForThis = amount * leverage * 0.005;
    if ((amount + feeForThis) > Number(profile?.balance)) {
      amount = (Number(profile?.balance) * pct) / (1 + leverage * 0.005);
    }
    const safeAmount = Math.floor(amount * 100) / 100;
    setCollateral(safeAmount > 0 ? safeAmount.toFixed(2) : '');
  };

  const leverageOptions = [2, 3, 5, 10];

  return (
    <div className="space-y-4 tab-enter">
      
      {/* Coin Selector (Synchronisiert mit Spot & Chart) */}
      <div className="flex gap-2">
        {Object.entries(COINS).map(([sym, info]) => {
          const active = coin === sym;
          const p = prices[sym] || 0;
          return (
            <button key={sym} onClick={() => setChartSymbol(sym)}
              className="flex-1 rounded-2xl p-3 text-center transition-all relative overflow-hidden bg-black/40 border border-white/5 active:scale-95"
              style={{
                borderColor: active ? info.border : 'rgba(255,255,255,0.05)',
                background: active ? info.bg : 'rgba(0,0,0,0.4)',
              }}>
              <div className="text-xl leading-none mb-1.5">{info.emoji}</div>
              <div className={`text-[10px] font-black tracking-widest ${active ? 'text-white' : 'text-white/40'}`}>
                {sym}
              </div>
              <div className="text-[9px] font-mono mt-1 text-white/20">
                {p.toLocaleString('de-DE', { maximumFractionDigits: 0 })}€
              </div>
            </button>
          );
        })}
      </div>

      {/* Leverage Form Card */}
      <div className="card p-4 border border-white/5 space-y-4 bg-gradient-to-b from-bg-card to-black/40 shadow-xl">
        <div>
          <div className="flex justify-between items-end mb-2 px-1">
            <p className="text-[10px] uppercase tracking-wider font-black text-[var(--text-dim)]">Einsatz (Verfügbare Margin)</p>
            <p className="text-xs font-mono font-bold text-neon-blue">{availableMargin.toLocaleString('de-DE')}€</p>
          </div>
          
          <div className="bg-black/60 rounded-xl flex items-center px-4 py-3.5 border border-white/5 focus-within:border-neon-blue/50 transition-all">
            <input
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="0.00"
              className="bg-transparent w-full text-lg font-bold text-white outline-none placeholder:text-white/10"
            />
            <span className="text-[var(--text-dim)] font-black text-sm ml-2">EUR</span>
          </div>
          
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[0.25, 0.5, 0.75, 1].map(pct => (
              <button
                key={pct}
                onClick={() => setPercent(pct)}
                className="py-2 rounded-lg text-[10px] font-black bg-white/5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white transition-all border border-white/5"
              >
                {pct * 100}%
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2 px-1">
            <p className="text-[10px] uppercase tracking-wider font-black text-[var(--text-dim)]">Hebel wählen</p>
            <p className={`text-xs font-mono font-bold ${leverage > 5 ? 'text-neon-purple animate-pulse' : 'text-neon-blue'}`}>{leverage}x</p>
          </div>
          
          <div className="flex gap-1.5">
            {leverageOptions.map(mult => {
              const isLocked = mult > maxLev;
              const isSelected = leverage === mult;
              return (
                <button
                  key={mult}
                  disabled={isLocked}
                  onClick={() => setLeverage(mult)}
                  className={`flex-1 py-3 rounded-xl text-xs font-black transition-all border relative ${
                    isSelected 
                      ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                      : isLocked 
                        ? 'bg-white/5 text-white/10 border-transparent grayscale' 
                        : 'bg-black/40 text-[var(--text-dim)] border-white/5 hover:border-white/20'
                  }`}
                >
                  {mult}x
                  {isLocked && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-black/60 rounded-xl p-3 border border-white/5 space-y-2">
          <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
            <span className="text-[var(--text-dim)]">Positionswert:</span>
            <span className="text-white font-mono">{notional.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</span>
          </div>
          <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
            <span className="text-[var(--text-dim)] text-neon-red">Est. Liquidation:</span>
            <span className="text-neon-red font-mono">
              {direction === 'LONG' ? liqLong.toLocaleString('de-DE', {minimumFractionDigits: 2}) : liqShort.toLocaleString('de-DE', {minimumFractionDigits: 2})}€
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { setDirection('LONG'); handleOpen('LONG'); }}
            disabled={!canOpen || !hasMargin || loadingDir !== null}
            className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all border ${
              canOpen && hasMargin 
                ? 'bg-neon-green/10 text-neon-green border-neon-green/20 hover:bg-neon-green/20 active:scale-95 shadow-[0_0_15px_rgba(34,214,138,0.1)]'
                : 'bg-white/5 text-white/10 border-transparent grayscale cursor-not-allowed'
            }`}
          >
            {loadingDir === 'LONG' ? 'Sende...' : 'LONG'}
          </button>
          
          <button
            onClick={() => { setDirection('SHORT'); handleOpen('SHORT'); }}
            disabled={!canOpen || !hasMargin || loadingDir !== null}
            className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all border ${
              canOpen && hasMargin 
                ? 'bg-neon-red/10 text-neon-red border-neon-red/20 hover:bg-neon-red/20 active:scale-95 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                : 'bg-white/5 text-white/10 border-transparent grayscale cursor-not-allowed'
            }`}
          >
            {loadingDir === 'SHORT' ? 'Sende...' : 'SHORT'}
          </button>
        </div>

        {!canOpen && (
          <p className="text-center text-[9px] text-neon-red font-black uppercase tracking-widest animate-pulse">
            Limit erreicht: Max {maxPos} Position(en)
          </p>
        )}
      </div>
    </div>
  );
}
