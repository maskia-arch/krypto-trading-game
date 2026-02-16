import React, { useState } from 'react';
import useStore from '../lib/store';

const COINS = {
  BTC: { name: 'Bitcoin',  emoji: '₿', color: '#f7931a', bg: 'rgba(247,147,26,0.08)', border: 'rgba(247,147,26,0.18)' },
  ETH: { name: 'Ethereum', emoji: 'Ξ', color: '#627eea', bg: 'rgba(98,126,234,0.08)',  border: 'rgba(98,126,234,0.18)' },
  LTC: { name: 'Litecoin', emoji: 'Ł', color: '#bfbbbb', bg: 'rgba(191,187,187,0.08)', border: 'rgba(191,187,187,0.18)' },
};
const FEE = 0.005;

export default function TradeView() {
  const { profile, assets, prices, buyCrypto, sellCrypto, showToast } = useStore();
  const [coin, setCoin] = useState('BTC');
  const [action, setAction] = useState('buy');
  const [euroIn, setEuroIn] = useState('');
  const [cryptoIn, setCryptoIn] = useState('');
  const [busy, setBusy] = useState(false);

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
    // Toleranz von 0.01€ hinzugefügt, falls Rundungsfehler bei 100% Max-Button auftreten
    if (euroAmt <= 0 || euroAmt > balance + 0.01) return;
    setBusy(true);
    try {
      const r = await buyCrypto(coin, euroAmt);
      const amount = r?.crypto_amount || r?.amount;
      if (amount) {
        showToast(`✅ ${Number(amount).toFixed(6)} ${coin} gekauft!`);
      } else {
        showToast(`✅ ${coin} erfolgreich gekauft!`);
      }
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
      if (eur) {
        showToast(`✅ ${coin} verkauft für ${Number(eur).toFixed(2)}€`);
      } else {
        showToast(`✅ ${coin} erfolgreich verkauft!`);
      }
      setCryptoIn('');
    } catch (e) { 
      showToast(`❌ ${e.message || 'Fehler beim Verkauf'}`, 'error'); 
    }
    setBusy(false);
  };

  const ci = COINS[coin];

  return (
    <div className="space-y-3 pb-4">
      <div className="flex gap-2">
        {Object.entries(COINS).map(([sym, info]) => {
          const active = coin === sym;
          const p = prices[sym] || 0;
          return (
            <button key={sym} onClick={() => setCoin(sym)}
              className="btn-press flex-1 rounded-2xl p-3 text-center transition-all"
              style={{
                background: active ? info.bg : 'var(--bg-card)',
                border: `1px solid ${active ? info.border : 'var(--border-dim)'}`,
              }}>
              <div className="text-2xl leading-none">{info.emoji}</div>
              <div className="text-[11px] font-bold mt-1.5" style={{ color: active ? info.color : 'var(--text-secondary)' }}>
                {sym}
              </div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {p.toLocaleString('de-DE', { maximumFractionDigits: 2 })}€
              </div>
            </button>
          );
        })}
      </div>

      <div className="card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>
              {ci.name} Kurs
            </p>
            <p className="text-2xl font-mono font-bold mt-0.5" style={{ color: ci.color }}>
              {price.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
            </p>
          </div>
          {holding > 0 && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>Bestand</p>
              <p className="text-sm font-mono font-semibold">{holding.toFixed(6)}</p>
              <p className={`text-[11px] font-mono font-semibold ${pnl >= 0 ? 'text-neon-green glow-green' : 'text-neon-red glow-red'}`}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}€
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex rounded-2xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}>
        {['buy', 'sell'].map(a => {
          const active = action === a;
          const isBuy = a === 'buy';
          return (
            <button key={a} onClick={() => setAction(a)}
              className={`btn-press flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                active
                  ? isBuy ? 'bg-neon-green/15 text-neon-green' : 'bg-neon-red/15 text-neon-red'
                  : 'text-[var(--text-dim)]'
              }`}>
              {isBuy ? '📈 Kaufen' : '📉 Verkaufen'}
            </button>
          );
        })}
      </div>

      <div className="card p-4 space-y-3">
        {action === 'buy' ? (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold" style={{ color: 'var(--text-dim)' }}>Betrag in EUR</label>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                  Max: {balance.toLocaleString('de-DE')}€
                </span>
              </div>
              <input type="number" inputMode="decimal" value={euroIn} onChange={e => setEuroIn(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl px-4 py-3.5 text-lg font-mono font-semibold"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-dim)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map(pct => (
                <button key={pct} onClick={() => setEuroIn((balance * pct / 100).toFixed(2))}
                  className="quick-btn btn-press">{pct}%</button>
              ))}
            </div>

            {euroAmt > 0 && (
              <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.015)' }}>
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: 'var(--text-dim)' }}>Du erhältst</span>
                  <span className="font-mono font-semibold text-neon-green">{cryptoGet.toFixed(6)} {coin}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: 'var(--text-dim)' }}>Gebühr (0.5%)</span>
                  <span className="font-mono text-neon-gold">{fee.toFixed(2)}€</span>
                </div>
              </div>
            )}

            <button onClick={handleBuy}
              disabled={busy || euroAmt <= 0 || euroAmt > balance + 0.01}
              className={`btn-press w-full py-3.5 rounded-2xl text-base font-bold transition-all ${
                busy || euroAmt <= 0 || euroAmt > balance + 0.01
                  ? 'bg-white/[0.03] text-[var(--text-dim)] cursor-not-allowed'
                  : 'bg-neon-green/20 text-neon-green border border-neon-green/25 active:bg-neon-green/30'
              }`}>
              {busy ? '⏳' : `${coin} kaufen`}
            </button>
          </>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold" style={{ color: 'var(--text-dim)' }}>Menge {coin}</label>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                  Bestand: {holding.toFixed(6)}
                </span>
              </div>
              <input type="number" inputMode="decimal" value={cryptoIn} onChange={e => setCryptoIn(e.target.value)}
                placeholder="0.000000"
                className="w-full rounded-xl px-4 py-3.5 text-lg font-mono font-semibold"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-dim)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => setCryptoIn((holding * pct / 100).toFixed(8))}
                  className="quick-btn btn-press">{pct}%</button>
              ))}
            </div>

            {sellAmt > 0 && (
              <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.015)' }}>
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: 'var(--text-dim)' }}>Du erhältst</span>
                  <span className="font-mono font-semibold text-neon-green">{sellNet.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: 'var(--text-dim)' }}>Gebühr (0.5%)</span>
                  <span className="font-mono text-neon-gold">{sellFee.toFixed(2)}€</span>
                </div>
                {avgBuy > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: 'var(--text-dim)' }}>Gewinn/Verlust</span>
                    <span className={`font-mono font-semibold ${(sellNet - sellAmt * avgBuy) >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                      {(sellNet - sellAmt * avgBuy).toFixed(2)}€
                    </span>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleSell}
              disabled={busy || sellAmt <= 0 || sellAmt > holding + 0.000001}
              className={`btn-press w-full py-3.5 rounded-2xl text-base font-bold transition-all ${
                busy || sellAmt <= 0 || sellAmt > holding + 0.000001
                  ? 'bg-white/[0.03] text-[var(--text-dim)] cursor-not-allowed'
                  : 'bg-neon-red/20 text-neon-red border border-neon-red/25 active:bg-neon-red/30'
              }`}>
              {busy ? '⏳' : `${coin} verkaufen`}
            </button>
          </>
        )}
      </div>

      {assets.filter(a => Number(a.amount) > 0).length > 0 && (
        <div className="card p-4">
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: 'var(--text-dim)' }}>
            Portfolio
          </p>
          <div className="space-y-2.5">
            {assets.filter(a => Number(a.amount) > 0).map(a => {
              const p = prices[a.symbol] || 0;
              const val = Number(a.amount) * p;
              const pl = val - Number(a.amount) * Number(a.avg_buy);
              const c = COINS[a.symbol];
              return (
                <div key={a.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                         style={{ background: c?.bg, border: `1px solid ${c?.border}` }}>
                      {c?.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{a.symbol}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        {Number(a.amount).toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold">{val.toFixed(2)}€</p>
                    <p className={`text-[10px] font-mono font-semibold ${pl >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                      {pl >= 0 ? '+' : ''}{pl.toFixed(2)}€
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
