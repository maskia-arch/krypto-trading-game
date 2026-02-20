import React, { useState, useEffect } from 'react';
import useStore from '../../lib/store';
import TradeInfoModal from '../modals/TradeInfoModal';

const COINS = {
  BTC: { name: 'Bitcoin',  emoji: '₿', color: '#f7931a', bg: 'rgba(247,147,26,0.1)', border: 'rgba(247,147,26,0.2)' },
  ETH: { name: 'Ethereum', emoji: 'Ξ', color: '#627eea', bg: 'rgba(98,126,234,0.1)',  border: 'rgba(98,126,234,0.2)' },
  LTC: { name: 'Litecoin', emoji: 'Ł', color: '#bfbbbb', bg: 'rgba(191,187,187,0.1)', border: 'rgba(191,187,187,0.2)' },
};

export default function LeveragePanel() {
  const { 
    profile, chartSymbol, setChartSymbol, prices, openLeveragePosition, 
    showToast, leveragePolicy, leveragePositions, getAvailableMargin,
    fetchLeveragePositions, isPremiumUser
  } = useStore();
  
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState(2);
  const [loadingDir, setLoadingDir] = useState(null);
  const [direction, setDirection] = useState('LONG');

  // Pro-Features States
  const [showProSettings, setShowProSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [trailingStop, setTrailingStop] = useState(false);
  
  // Modal State
  const [infoType, setInfoType] = useState(null);

  const isPremium = isPremiumUser();

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
  const maxPos = isPremium ? 3 : (leveragePolicy?.max_positions || 1);
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
    if (!canOpen) return showToast(`Limit erreicht: Max ${maxPos} Position(en)`, 'error');

    setLoadingDir(dir);
    try {
      const options = {
        stop_loss: isPremium ? stopLoss : null,
        take_profit: isPremium ? takeProfit : null,
        limit_price: isPremium ? limitPrice : null,
        trailing_stop: isPremium ? trailingStop : false
      };

      await openLeveragePosition(coin, dir, collatNum, leverage, options);
      showToast(`⚡ ${leverage}x ${dir} auf ${coin} geöffnet!`);
      setCollateral('');
      setStopLoss('');
      setTakeProfit('');
      setLimitPrice('');
    } catch (err) {
      showToast(`❌ ${err.message || 'Fehler'}`, 'error');
    } finally {
      setLoadingDir(null);
    }
  };

  const InfoBtn = ({ type }) => (
    <button 
      onClick={(e) => { e.stopPropagation(); setInfoType(type); }}
      className="w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center hover:bg-white/20 transition-colors"
    >
      ?
    </button>
  );

  return (
    <div className="space-y-4 tab-enter">
      
      {/* Coin Selector */}
      <div className="flex gap-2">
        {Object.entries(COINS).map(([sym, info]) => {
          const active = coin === sym;
          return (
            <button key={sym} onClick={() => setChartSymbol(sym)}
              className="flex-1 rounded-2xl p-3 text-center transition-all bg-black/40 border border-white/5"
              style={{ borderColor: active ? info.border : 'rgba(255,255,255,0.05)', background: active ? info.bg : 'rgba(0,0,0,0.4)' }}>
              <div className="text-xl mb-1">{info.emoji}</div>
              <div className={`text-[10px] font-black tracking-widest ${active ? 'text-white' : 'text-white/40'}`}>{sym}</div>
            </button>
          );
        })}
      </div>

      <div className="card p-4 border border-white/5 space-y-4 bg-gradient-to-b from-bg-card to-black/40 shadow-xl">
        {/* Margin Input */}
        <div>
          <div className="flex justify-between items-end mb-2 px-1">
            <p className="text-[10px] uppercase tracking-wider font-black text-[var(--text-dim)]">Einsatz</p>
            <p className="text-xs font-mono font-bold text-neon-blue">{availableMargin.toLocaleString('de-DE')}€ verfügbar</p>
          </div>
          <div className="bg-black/60 rounded-xl flex items-center px-4 py-3 border border-white/5 focus-within:border-neon-blue/50">
            <input type="number" value={collateral} onChange={(e) => setCollateral(e.target.value)} placeholder="0.00" className="bg-transparent w-full text-lg font-bold text-white outline-none" />
            <span className="text-[var(--text-dim)] font-black text-sm ml-2">EUR</span>
          </div>
        </div>

        {/* Leverage Select */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-black text-[var(--text-dim)] mb-2 px-1">Hebel</p>
          <div className="flex gap-1.5">
            {[2, 3, 5, 10].map(mult => (
              <button key={mult} disabled={mult > maxLev} onClick={() => setLeverage(mult)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black border transition-all ${leverage === mult ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/40' : 'bg-black/40 text-[var(--text-dim)] border-white/5'}`}>
                {mult}x {mult > maxLev && '🔒'}
              </button>
            ))}
          </div>
        </div>

        {/* PRO SETTINGS DROPDOWN */}
        <div className="border-t border-white/5 pt-2">
          <button 
            onClick={() => isPremium && setShowProSettings(!showProSettings)}
            className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${isPremium ? 'hover:bg-white/5 text-white' : 'opacity-50 text-white/40 cursor-not-allowed'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">🎯</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Profit & Schutz {!isPremium && '🔒'}</span>
            </div>
            <span className="text-[10px]">{showProSettings ? '▲' : '▼'}</span>
          </button>

          {showProSettings && isPremium && (
            <div className="space-y-3 p-2 mt-2 bg-black/20 rounded-xl border border-white/5 tab-enter">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase text-white/40 flex items-center gap-1">Stop Loss <InfoBtn type="stop_loss"/></label>
                </div>
                <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="Preis eingeben..." className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-neon-red/50" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase text-white/40 flex items-center gap-1">Take Profit <InfoBtn type="take_profit"/></label>
                </div>
                <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="Preis eingeben..." className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-neon-green/50" />
              </div>
            </div>
          )}
        </div>

        {/* ADVANCED DROPDOWN */}
        <div className="border-t border-white/5 pt-2">
          <button 
            onClick={() => isPremium && setShowAdvanced(!showAdvanced)}
            className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${isPremium ? 'hover:bg-white/5 text-white' : 'opacity-50 text-white/40 cursor-not-allowed'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">⚙️</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Erweiterte Optionen {!isPremium && '🔒'}</span>
            </div>
            <span className="text-[10px]">{showAdvanced ? '▲' : '▼'}</span>
          </button>

          {showAdvanced && isPremium && (
            <div className="space-y-3 p-2 mt-2 bg-black/20 rounded-xl border border-white/5 tab-enter">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase text-white/40 flex items-center gap-1">Limit Order <InfoBtn type="limit_order"/></label>
                </div>
                <input type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Einstiegspreis..." className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-neon-blue/50" />
              </div>
              <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/10">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-white/40 flex items-center gap-1">Trailing Stop <InfoBtn type="trailing_stop"/></span>
                </div>
                <button onClick={() => setTrailingStop(!trailingStop)} className={`w-10 h-5 rounded-full relative transition-all ${trailingStop ? 'bg-neon-blue' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${trailingStop ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Execution Buttons */}
        <div className="flex gap-2 border-t border-white/5 pt-4">
          <button onClick={() => handleOpen('LONG')} disabled={!canOpen || !hasMargin || loadingDir !== null}
            className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${canOpen && hasMargin ? 'bg-neon-green/10 text-neon-green border-neon-green/20 hover:bg-neon-green/20 shadow-lg shadow-neon-green/5' : 'bg-white/5 text-white/10 grayscale cursor-not-allowed'}`}>
            {loadingDir === 'LONG' ? 'Sende...' : 'LONG'}
          </button>
          <button onClick={() => handleOpen('SHORT')} disabled={!canOpen || !hasMargin || loadingDir !== null}
            className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${canOpen && hasMargin ? 'bg-neon-red/10 text-neon-red border-neon-red/20 hover:bg-neon-red/20 shadow-lg shadow-neon-red/5' : 'bg-white/5 text-white/10 grayscale cursor-not-allowed'}`}>
            {loadingDir === 'SHORT' ? 'Sende...' : 'SHORT'}
          </button>
        </div>

        {!canOpen && (
          <p className="text-center text-[9px] text-neon-red font-black uppercase tracking-widest animate-pulse">
            Limit erreicht: Max {maxPos} Position(en)
          </p>
        )}
      </div>

      {/* Info Modal Integration */}
      <TradeInfoModal 
        type={infoType} 
        isOpen={!!infoType} 
        onClose={() => setInfoType(null)} 
      />
    </div>
  );
}
