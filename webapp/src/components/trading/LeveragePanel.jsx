import React, { useState, useEffect } from 'react';
import useStore from '../../lib/store';

export default function LeveragePanel() {
  const { 
    profile, chartSymbol, prices, openLeveragePosition, 
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

  const currentPrice = prices[chartSymbol] || 0;
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
      await openLeveragePosition(chartSymbol, dir, collatNum, leverage);
      showToast(`⚡ ${leverage}x ${dir} auf ${chartSymbol} geöffnet!`);
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
    <div className="card p-4 border border-white/5 space-y-4 bg-gradient-to-b from-bg-card to-black/40">
      <div>
        <div className="flex justify-between items-end mb-2">
          <p className="text-[10px] uppercase tracking-wider font-black text-[var(--text-dim)]">Einsatz (Verfügbare Margin)</p>
          <p className="text-xs font-mono font-bold text-neon-blue">{availableMargin.toLocaleString('de-DE')}€</p>
        </div>
        
        <div className="bg-black/60 rounded-xl flex items-center px-3 py-3 border border-white/5 focus-within:border-neon-blue/50 transition-all">
          <input
            type="number"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            placeholder="0.00"
            className="bg-transparent w-full text-lg font-bold text-white outline-none"
          />
          <span className="text-[var(--text-dim)] font-bold text-sm ml-2">EUR</span>
        </div>
        
        <div className="flex gap-1.5 mt-2">
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <button
              key={pct}
              onClick={() => setPercent(pct)}
              className="flex-1 py-2 rounded-lg text-[10px] font-black bg-white/5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white transition-all border border-white/5"
            >
              {pct * 100}%
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
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
                className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all border relative ${
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
          <span className="text-[var(--text-dim)]">Liq. Preis (geschätzt):</span>
          <span className="text-neon-red font-mono">
            {direction === 'LONG' ? liqLong.toLocaleString('de-DE', {minimumFractionDigits: 2}) : liqShort.toLocaleString('de-DE', {minimumFractionDigits: 2})}€
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { setDirection('LONG'); handleOpen('LONG'); }}
          disabled={!canOpen || !hasMargin || loadingDir !== null}
          className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all border ${
            canOpen && hasMargin 
              ? 'bg-neon-green/10 text-neon-green border-neon-green/20 hover:bg-neon-green/20 active:scale-95'
              : 'bg-white/5 text-white/10 border-transparent grayscale cursor-not-allowed'
          }`}
        >
          {loadingDir === 'LONG' ? 'Sende...' : 'Buy / Long'}
        </button>
        
        <button
          onClick={() => { setDirection('SHORT'); handleOpen('SHORT'); }}
          disabled={!canOpen || !hasMargin || loadingDir !== null}
          className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all border ${
            canOpen && hasMargin 
              ? 'bg-neon-red/10 text-neon-red border-neon-red/20 hover:bg-neon-red/20 active:scale-95'
              : 'bg-white/5 text-white/10 border-transparent grayscale cursor-not-allowed'
          }`}
        >
          {loadingDir === 'SHORT' ? 'Sende...' : 'Sell / Short'}
        </button>
      </div>

      {!canOpen && (
        <p className="text-center text-[9px] text-neon-red font-black uppercase tracking-widest animate-pulse">
          Limit: Max {maxPos} Position(en) erlaubt
        </p>
      )}
    </div>
  );
}
