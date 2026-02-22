import React, { useState, useEffect } from 'react';
import useStore from '../../lib/store';
import TradeInfoModal from '../modals/TradeInfoModal';

const InfoBtn = ({ type, setInfoType }) => (
  <button 
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInfoType(type); }}
    className="w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center hover:bg-white/20 transition-colors ml-1"
  >
    ?
  </button>
);

export default function LeveragePanel({ hideCoinSelector = false }) {
  const { 
    profile, chartSymbol, prices, openLeveragePosition, 
    showToast, leveragePolicy, leveragePositions, getAvailableMargin,
    fetchLeveragePositions, isPremiumUser
  } = useStore();
  
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState(2);
  const [loadingDir, setLoadingDir] = useState(null);
  const [showProSettings, setShowProSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [trailingStop, setTrailingStop] = useState(false);
  const [infoType, setInfoType] = useState(null);
  const [showProInfo, setShowProInfo] = useState(false);

  const isPremium = isPremiumUser();

  useEffect(() => {
    fetchLeveragePositions();
  }, [fetchLeveragePositions]);

  if (!leveragePolicy || !profile) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  const coin = chartSymbol || 'BTC';
  const maxLev = leveragePolicy?.maxLeverage || leveragePolicy?.max_leverage || 10;
  const maxPos = isPremium ? 3 : (leveragePolicy?.maxPositions || leveragePolicy?.max_positions || 1);
  const currentOpen = leveragePositions?.length || 0;
  const isMonday = leveragePolicy?.isMonday || leveragePolicy?.is_monday || false;
  const zockerEnabled = leveragePolicy?.zockerEnabled || (leveragePolicy?.zockerLeverages?.length > 0) || false;
  
  const availableMargin = Number(getAvailableMargin()) || 0;

  const collatNum = Number(collateral) || 0;
  const notional = collatNum * leverage;
  const fee = notional * 0.005;
  const totalCost = collatNum + fee;

  const canOpen = currentOpen < maxPos;
  const hasMargin = totalCost <= availableMargin && collatNum > 0;

  const handleOpen = async (dir) => {
    if (!canOpen) return showToast(`Limit erreicht: Max ${maxPos} Position(en)`, 'error');
    if (!hasMargin) return showToast(`Unzureichende Margin (inkl. Gebühren)`, 'error');

    setLoadingDir(dir);
    try {
      const options = {
        stop_loss: isPremium && stopLoss ? Number(stopLoss) : null,
        take_profit: isPremium && takeProfit ? Number(takeProfit) : null,
        limit_price: isPremium && limitPrice ? Number(limitPrice) : null,
        trailing_stop: isPremium ? trailingStop : false
      };

      await openLeveragePosition(coin, dir, collatNum, leverage, options);
      const isZocker = leverage >= 20;
      showToast(`${isZocker ? '🎰' : '⚡'} ${leverage}x ${dir} auf ${coin} geöffnet!`);
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

  return (
    <div className="space-y-4 tab-enter">

      {/* Pro Info Modal für Free User */}
      {showProInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowProInfo(false)} />
          <div className="relative w-full max-w-[320px] card border border-neon-gold/20 bg-gradient-to-b from-[#1a1c26] to-black p-6 shadow-2xl tab-enter">
            <div className="flex flex-col items-center text-center">
              <div className="text-4xl mb-3">⭐</div>
              <h3 className="text-lg font-black uppercase tracking-widest mb-4 text-neon-gold">Value-Pro</h3>
              
              <div className="w-full space-y-2.5 text-left mb-5">
                {[
                  { icon: '🎰', title: 'Zocker-Modus', desc: 'x20 & x50 Hebel — dauerhaft!' },
                  { icon: '⚡', title: '3 Positionen', desc: 'Gleichzeitig offen halten' },
                  { icon: '🛡️', title: 'Stop-Loss & Take-Profit', desc: 'Automatischer Verlust-Schutz' },
                  { icon: '📈', title: 'Trailing-Stop', desc: 'Gewinne automatisch absichern' },
                  { icon: '🎯', title: 'Limit-Orders', desc: 'Automatisch im Dip kaufen' },
                  { icon: '🎨', title: 'Profilhintergrund', desc: 'Individuelles Design' },
                  { icon: '✏️', title: 'Namensänderung', desc: 'Alle 30 Tage möglich' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-wider">{item.title}</p>
                      <p className="text-[9px] text-white/40">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowProInfo(false)}
                className="w-full py-3 rounded-xl bg-neon-gold/20 hover:bg-neon-gold/30 text-neon-gold text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border border-neon-gold/30"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 border border-white/5 space-y-4 bg-gradient-to-b from-bg-card to-black/40 shadow-xl">
        <div className="space-y-3">
          <div className="flex justify-between items-end px-1">
            <p className="text-[10px] uppercase tracking-wider font-black text-[var(--text-dim)]">Einsatz</p>
            <p className="text-xs font-mono font-bold text-neon-blue">{availableMargin.toLocaleString('de-DE')}€ verfügbar</p>
          </div>
          
          <div className="bg-black/60 rounded-xl flex items-center px-4 py-3 border border-white/5 focus-within:border-neon-blue/50">
            <input 
              type="number" 
              value={collateral} 
              onChange={(e) => setCollateral(e.target.value)} 
              placeholder="0.00" 
              className="bg-transparent w-full text-lg font-bold text-white outline-none" 
            />
            <span className="text-[var(--text-dim)] font-black text-sm ml-2">EUR</span>
          </div>

          <div className="flex gap-1.5">
            {[25, 50, 75, 100].map(pct => (
              <button 
                key={pct} 
                onClick={() => {
                  const raw = (availableMargin * (pct / 100)) / (1 + (leverage * 0.005));
                  setCollateral((Math.floor(raw * 100) / 100).toFixed(2));
                }}
                className="flex-1 py-2 rounded-lg text-[10px] font-black bg-white/5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white transition-all border border-white/5 active:scale-95"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Standard Hebel */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-black text-[var(--text-dim)] mb-2 px-1">Hebel</p>
          <div className="flex gap-1.5">
            {[2, 3, 5, 10].map(mult => (
              <button key={mult} onClick={() => setLeverage(mult)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black border transition-all ${
                  leverage === mult 
                    ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/40' 
                    : 'bg-black/40 text-[var(--text-dim)] border-white/5 hover:text-white/60'
                }`}>
                {mult}x
              </button>
            ))}
          </div>
        </div>

        {/* v0.3.2: Zocker-Modus (x20, x50) */}
        <div className="border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">🎰</span>
              <p className="text-[10px] uppercase tracking-wider font-black text-neon-red">Zocker-Modus</p>
            </div>
            {!isPremium && !isMonday && (
              <button 
                onClick={() => setShowProInfo(true)}
                className="text-[9px] font-black uppercase tracking-wider text-neon-gold bg-neon-gold/10 px-2 py-0.5 rounded border border-neon-gold/20"
              >
                Pro Info
              </button>
            )}
          </div>
          
          {zockerEnabled ? (
            <div className="flex gap-1.5">
              {[20, 50].map(mult => (
                <button key={mult} onClick={() => setLeverage(mult)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-black border transition-all ${
                    leverage === mult 
                      ? 'bg-neon-red/20 text-neon-red border-neon-red/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]' 
                      : 'bg-black/40 text-neon-red/60 border-neon-red/10 hover:bg-neon-red/10'
                  }`}>
                  {mult}x {leverage === mult && '🔥'}
                </button>
              ))}
            </div>
          ) : (
            <button 
              onClick={() => setShowProInfo(true)}
              className="w-full py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/20 border border-white/5 flex items-center justify-center gap-2"
            >
              🔒 x20 & x50 nur für Pro {isMonday ? '' : '(oder Montag)'}
            </button>
          )}

          {!isPremium && isMonday && zockerEnabled && (
            <p className="text-[8px] text-neon-red/60 text-center mt-1.5 font-bold italic">
              ⚠️ Zocker-Positionen werden um Mitternacht automatisch abgerechnet
            </p>
          )}
        </div>

        {/* Pro Features: SL/TP */}
        <div className="border-t border-white/5 pt-2">
          <button 
            onClick={() => {
              if (isPremium) {
                setShowProSettings(!showProSettings);
              } else {
                setShowProInfo(true);
              }
            }} 
            className={`w-full flex items-center justify-between p-2 rounded-lg ${isPremium ? 'hover:bg-white/5 text-white' : 'text-white/40'}`}
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
                <label className="text-[9px] font-black uppercase text-white/40 flex items-center">Stop Loss <InfoBtn type="stop_loss" setInfoType={setInfoType}/></label>
                <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="Preis..." className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase text-white/40 flex items-center">Take Profit <InfoBtn type="take_profit" setInfoType={setInfoType}/></label>
                <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="Preis..." className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none" />
              </div>
            </div>
          )}
        </div>

        {/* Pro Features: Advanced */}
        <div className="border-t border-white/5 pt-2">
          <button 
            onClick={() => {
              if (isPremium) {
                setShowAdvanced(!showAdvanced);
              } else {
                setShowProInfo(true);
              }
            }}
            className={`w-full flex items-center justify-between p-2 rounded-lg ${isPremium ? 'hover:bg-white/5 text-white' : 'text-white/40'}`}
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
                <label className="text-[9px] font-black uppercase text-white/40 flex items-center">Limit Order <InfoBtn type="limit_order" setInfoType={setInfoType}/></label>
                <input type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Preis..." className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white outline-none" />
              </div>
              <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/10">
                <span className="text-[9px] font-black uppercase text-white/40 flex items-center">Trailing Stop <InfoBtn type="trailing_stop" setInfoType={setInfoType}/></span>
                <button onClick={() => setTrailingStop(!trailingStop)} className={`w-10 h-5 rounded-full relative transition-all ${trailingStop ? 'bg-neon-blue' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${trailingStop ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Zocker Warnung */}
        {leverage >= 20 && (
          <div className="bg-neon-red/10 border border-neon-red/20 rounded-xl p-3 text-center">
            <p className="text-[10px] font-black text-neon-red uppercase tracking-widest">
              ⚠️ {leverage}x Zocker-Modus — Hohes Liquidierungsrisiko!
            </p>
          </div>
        )}

        <div className="flex gap-2 border-t border-white/5 pt-4">
          <button onClick={() => handleOpen('LONG')} disabled={!canOpen || !hasMargin || loadingDir !== null}
            className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${canOpen && hasMargin ? 'bg-neon-green/10 text-neon-green border-neon-green/20 hover:bg-neon-green/20 shadow-lg shadow-neon-green/5' : 'bg-white/5 text-white/10 grayscale cursor-not-allowed'}`}>
            {loadingDir === 'LONG' ? 'Sende...' : `LONG ${leverage}x`}
          </button>
          <button onClick={() => handleOpen('SHORT')} disabled={!canOpen || !hasMargin || loadingDir !== null}
            className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${canOpen && hasMargin ? 'bg-neon-red/10 text-neon-red border-neon-red/20 hover:bg-neon-red/20 shadow-lg shadow-neon-red/5' : 'bg-white/5 text-white/10 grayscale cursor-not-allowed'}`}>
            {loadingDir === 'SHORT' ? 'Sende...' : `SHORT ${leverage}x`}
          </button>
        </div>

        {!canOpen && (
          <p className="text-center text-[9px] text-neon-red font-black uppercase tracking-widest animate-pulse">
            Limit erreicht: Max {maxPos} Position(en)
          </p>
        )}
      </div>

      {infoType && <TradeInfoModal type={infoType} isOpen={!!infoType} onClose={() => setInfoType(null)} />}
    </div>
  );
}
