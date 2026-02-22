import React, { useState, useEffect } from 'react';
import useStore from '../lib/store';

const COINS = {
  BTC: { name: 'Bitcoin',  emoji: '₿', color: '#f7931a', bg: 'rgba(247,147,26,0.1)', border: 'rgba(247,147,26,0.2)' },
  ETH: { name: 'Ethereum', emoji: 'Ξ', color: '#627eea', bg: 'rgba(98,126,234,0.1)',  border: 'rgba(98,126,234,0.2)' },
  LTC: { name: 'Litecoin', emoji: 'Ł', color: '#bfbbbb', bg: 'rgba(191,187,187,0.1)', border: 'rgba(191,187,187,0.2)' },
};
const FEE = 0.005;

export default function TradeView({ hideCoinSelector = false }) {
  const { profile, assets, prices, buyCrypto, sellCrypto, showToast, chartSymbol } = useStore();
  
  const coin = chartSymbol; 
  const [action, setAction] = useState('buy');
  const [euroIn, setEuroIn] = useState('');
  const [cryptoIn, setCryptoIn] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEuroIn('');
    setCryptoIn('');
  }, [coin, action]);

  const price = prices[coin] || 0;
  const balance = Number(profile?.balance || 0);
  const asset = assets.find(a => a.symbol === coin);
  const holding = Number(asset?.amount || 0);
  const holdVal = holding * price;
  const avgBuy = Number(asset?.avg_buy || 0);
  const pnl = holding > 0 ? holdVal - holding * avgBuy : 0;

  const euroAmt = Number(euroIn) || 0;
  const fee = euroAmt * FEE;
  const cryptoGet = price > 0 ? (euroAmt - fee) / price : 0;

  const sellAmt = Number(cryptoIn) || 0;
  const sellGross = sellAmt * price;
  const sellFee = sellGross * FEE;
  const sellNet = sellGross - sellFee;

  const handleBuy = async () => {
    if (euroAmt <= 0 || euroAmt > balance + 0.01) return;
    setBusy(true);
    try {
      const r = await buyCrypto(coin, euroAmt);
      const amount = r?.crypto_amount || r?.amount;
      showToast(`✅ ${Number(amount || 0).toFixed(6)} ${coin} gekauft!`);
      setEuroIn('');
    } catch (e) { 
      showToast(`❌ ${e.message || 'Fehler beim Kauf'}`, 'error'); 
    }
    setBusy(false);
  };

  const handleSell = async () => {
    if (sellAmt <= 0 || sellAmt > holding + 0.000001) return;
    setBusy(true);
    try {
      const r = await sellCrypto(coin, sellAmt);
      const eur = r?.euro_received || r?.total_eur || r?.eur;
      showToast(`✅ ${coin} verkauft für ${Number(eur || 0).toFixed(2)}€`);
      setCryptoIn('');
    } catch (e) { 
      showToast(`❌ ${e.message || 'Fehler beim Verkauf'}`, 'error'); 
    }
    setBusy(false);
  };

  const ci = COINS[coin] || COINS.BTC;

  return (
    <div className="space-y-4 pb-4 tab-enter">
      
      {!hideCoinSelector && (
        <div className="flex gap-2">
          {Object.entries(COINS).map(([sym, info]) => {
            const active = coin === sym;
            const p = prices[sym] || 0;
            return (
              <button key={sym} onClick={() => useStore.getState().setChartSymbol(sym)}
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
      )}

      <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
        <button onClick={() => setAction('buy')}
          className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${
            action === 'buy' 
              ? 'bg-neon-green/20 text-neon-green shadow-[0_2px_15px_rgba(34,214,138,0.15)] border border-neon-green/30' 
              : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
          }`}>
          BUY
        </button>
        <button onClick={() => setAction('sell')}
          className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${
            action === 'sell' 
              ? 'bg-neon-red/20 text-neon-red shadow-[0_2px_15px_rgba(244,63,94,0.15)] border border-neon-red/30' 
              : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
          }`}>
          SELL
        </button>
      </div>

      <div className="card p-4 border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/60 relative overflow-hidden shadow-xl">
        <div className={`absolute -top-20 -left-20 w-48 h-48 blur-[80px] rounded-full pointer-events-none opacity-20 transition-colors duration-700 ${
          action === 'buy' ? 'bg-neon-green' : 'bg-neon-red'
        }`}></div>

        {action === 'buy' ? (
          <div className="space-y-4 relative z-10">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Betrag in EUR</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Verfügbar:</span>
                  <span className="text-[11px] font-mono font-bold text-white drop-shadow-sm">{balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</span>
                </div>
              </div>
              <div className="bg-black/60 rounded-xl flex items-center px-4 py-3.5 border border-white/5 focus-within:border-white/20 transition-all">
                <input 
                  type="number" inputMode="decimal" value={euroIn} onChange={e => setEuroIn(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent w-full text-xl font-mono font-bold text-white outline-none placeholder:text-white/20"
                />
                <span className="text-[var(--text-dim)] font-black text-sm ml-2">EUR</span>
              </div>
            </div>

            <div className="flex gap-1.5">
              {[10, 25, 50, 100].map(pct => (
                <button key={pct} onClick={() => setEuroIn((balance * pct / 100).toFixed(2))}
                  className="flex-1 py-2 rounded-lg text-[10px] font-black bg-white/5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white transition-all border border-white/5">
                  {pct}%
                </button>
              ))}
            </div>

            {euroAmt > 0 && (
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                  <span className="text-[var(--text-dim)]">Du erhältst:</span>
                  <span className="text-neon-green font-mono text-xs">{cryptoGet.toFixed(6)} {coin}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                  <span className="text-[var(--text-dim)]">Gebühr (0.5%):</span>
                  <span className="text-white/60 font-mono text-[10px]">{fee.toFixed(2)}€</span>
                </div>
              </div>
            )}

            <button onClick={handleBuy}
              disabled={busy || euroAmt <= 0 || euroAmt > balance + 0.01}
              className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all border ${
                busy || euroAmt <= 0 || euroAmt > balance + 0.01
                  ? 'bg-white/5 text-white/10 border-transparent grayscale cursor-not-allowed'
                  : 'bg-neon-green/10 text-neon-green border-neon-green/20 hover:bg-neon-green/20 active:scale-95 shadow-[0_0_15px_rgba(34,214,138,0.1)]'
              }`}>
              {busy ? 'Wird ausgeführt...' : `${coin} kaufen`}
            </button>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Menge {coin}</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Bestand:</span>
                  <span className="text-[11px] font-mono font-bold text-white drop-shadow-sm">{holding.toFixed(6)}</span>
                </div>
              </div>
              <div className="bg-black/60 rounded-xl flex items-center px-4 py-3.5 border border-white/5 focus-within:border-white/20 transition-all">
                <input 
                  type="number" inputMode="decimal" value={cryptoIn} onChange={e => setCryptoIn(e.target.value)}
                  placeholder="0.000000"
                  className="bg-transparent w-full text-xl font-mono font-bold text-white outline-none placeholder:text-white/20"
                />
                <span className="text-[var(--text-dim)] font-black text-sm ml-2">{coin}</span>
              </div>
            </div>

            <div className="flex gap-1.5">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => setCryptoIn((holding * pct / 100).toFixed(8))}
                  className="flex-1 py-2 rounded-lg text-[10px] font-black bg-white/5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white transition-all border border-white/5">
                  {pct}%
                </button>
              ))}
            </div>

            {sellAmt > 0 && (
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                  <span className="text-[var(--text-dim)]">Du erhältst:</span>
                  <span className="text-neon-green font-mono text-xs">{sellNet.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                  <span className="text-[var(--text-dim)]">Gebühr (0.5%):</span>
                  <span className="text-white/60 font-mono text-[10px]">{sellFee.toFixed(2)}€</span>
                </div>
              </div>
            )}

            <button onClick={handleSell}
              disabled={busy || sellAmt <= 0 || sellAmt > holding + 0.000001}
              className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all border ${
                busy || sellAmt <= 0 || sellAmt > holding + 0.000001
                  ? 'bg-white/5 text-white/10 border-transparent grayscale cursor-not-allowed'
                  : 'bg-neon-red/10 text-neon-red border-neon-red/20 hover:bg-neon-red/20 active:scale-95 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
              }`}>
              {busy ? 'Wird ausgeführt...' : `${coin} verkaufen`}
            </button>
          </div>
        )}
      </div>

      {holding > 0 && (
        <div className="card p-3 border border-white/5 bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner" style={{ background: ci.bg, border: `1px solid ${ci.border}` }}>
              {ci.emoji}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-dim)]">Dein {coin} Bestand</p>
              <p className="text-sm font-mono font-bold text-white leading-tight mt-0.5">{holding.toFixed(6)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-mono font-black text-white">{holdVal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€</p>
            <p className={`text-[10px] font-mono font-black mt-0.5 ${pnl >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}€
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
