import React, { useState } from 'react';
import useStore from '../../lib/store';

export default function LeveragePanel() {
  const { profile, chartSymbol, prices, openLeveragePosition, showToast, leveragePolicy, leveragePositions } = useStore();
  
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [loadingDir, setLoadingDir] = useState(null);

  const bal = Number(profile?.balance || 0);
  const currentPrice = prices[chartSymbol] || 0;
  
  const maxLev = leveragePolicy?.maxLeverage || 5;
  const maxPos = leveragePolicy?.maxPositions || 1;
  const currentOpen = leveragePositions?.length || 0;

  const collatNum = Number(collateral) || 0;
  const notional = collatNum * leverage;
  const fee = notional * 0.005;
  const totalCost = collatNum + fee;

  const liqLong = currentPrice * (1 - 1 / leverage);
  const liqShort = currentPrice * (1 + 1 / leverage);

  const canOpen = currentOpen < maxPos;
  const hasBalance = bal >= totalCost && collatNum > 0;

  const handleOpen = async (direction) => {
    if (!hasBalance) return showToast('Nicht genug Guthaben (inkl. Gebühren)', 'error');
    if (!canOpen) return showToast(`Maximal ${maxPos} Positionen erlaubt`, 'error');
    if (leverage > maxLev) return showToast(`Maximaler Hebel ist ${maxLev}x`, 'error');

    setLoadingDir(direction);
    try {
      await openLeveragePosition(chartSymbol, direction, collatNum, leverage);
      showToast(`✅ ${leverage}x ${direction} auf ${chartSymbol} geöffnet!`);
      setCollateral('');
    } catch (err) {
      showToast(`❌ ${err.message || 'Fehler beim Öffnen'}`, 'error');
    }
    setLoadingDir(null);
  };

  const setPercent = (pct) => {
    const amount = (bal * pct) / 1.005; 
    setCollateral(amount > 0 ? amount.toFixed(2) : '');
  };

  const availableMultipliers = [1, 2, 3, 5, 10].filter(m => m <= maxLev || m === 10);

  return (
    <div className="card p-4 border border-white/5 ring-1 ring-white/5 space-y-4">
      
      <div>
        <div className="flex justify-between items-end mb-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)]">Sicherheitsmarge (EUR)</p>
          <p className="text-xs font-mono font-bold text-neon-green">{bal.toLocaleString('de-DE')}€</p>
        </div>
        
        <div className="bg-black/40 rounded-xl flex items-center px-3 py-2 border border-white/5 focus-within:border-neon-blue/50 transition-colors">
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
          {[0.1, 0.25, 0.5, 1].map(pct => (
            <button
              key={pct}
              onClick={() => setPercent(pct)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white transition-all border border-white/5"
            >
              {pct * 100}%
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)]">Hebel wählen</p>
          <p className="text-xs font-mono font-bold text-neon-blue">{leverage}x</p>
        </div>
        
        <div className="flex gap-1.5">
          {availableMultipliers.map(mult => {
            const isLocked = mult > maxLev;
            const isSelected = leverage === mult;
            return (
              <button
                key={mult}
                disabled={isLocked}
                onClick={() => setLeverage(mult)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border relative ${
                  isSelected 
                    ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                    : isLocked 
                      ? 'bg-white/5 text-white/20 border-transparent opacity-50 grayscale' 
                      : 'bg-black/40 text-[var(--text-dim)] border-white/5 hover:border-white/20'
                }`}
              >
                {mult}x
                {isLocked && <span className="absolute -top-1.5 -right-1.5 text-[10px]">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-dim)]">Positionsgröße:</span>
          <span className="font-mono font-bold text-white">{notional.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-dim)]">Gebühr (0.5%):</span>
          <span className="font-mono font-bold text-neon-gold">{fee.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</span>
        </div>
        <div className="flex justify-between text-xs pt-2 border-t border-white/5">
          <span className="text-[var(--text-dim)]">Liq. Preis (Long):</span>
          <span className="font-mono font-bold text-neon-red">{liqLong.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-dim)]">Liq. Preis (Short):</span>
          <span className="font-mono font-bold text-neon-red">{liqShort.toLocaleString('de-DE', {minimumFractionDigits: 2})}€</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => handleOpen('LONG')}
          disabled={!canOpen || !hasBalance || loadingDir !== null}
          className={`flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border ${
            canOpen && hasBalance && loadingDir === null
              ? 'bg-neon-green/20 text-neon-green border-neon-green/30 hover:bg-neon-green/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-white/5 text-[var(--text-dim)] border-transparent opacity-50 cursor-not-allowed'
          }`}
        >
          {loadingDir === 'LONG' ? 'Öffnet...' : '📈 LONG'}
        </button>
        
        <button
          onClick={() => handleOpen('SHORT')}
          disabled={!canOpen || !hasBalance || loadingDir !== null}
          className={`flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border ${
            canOpen && hasBalance && loadingDir === null
              ? 'bg-neon-red/20 text-neon-red border-neon-red/30 hover:bg-neon-red/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              : 'bg-white/5 text-[var(--text-dim)] border-transparent opacity-50 cursor-not-allowed'
          }`}
        >
          {loadingDir === 'SHORT' ? 'Öffnet...' : '📉 SHORT'}
        </button>
      </div>

      {!canOpen && (
        <p className="text-center text-[10px] text-neon-red font-bold uppercase tracking-wide">
          Limit erreicht: Maximal {maxPos} offene Hebel-Position(en) erlaubt.
        </p>
      )}

    </div>
  );
}
