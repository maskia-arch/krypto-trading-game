import React, { useEffect, useState } from 'react';
import useStore from '../lib/store';
import { api, getTelegramId } from '../lib/api';

export default function RankView() {
  const { leaderboard, season, feePool, fetchProfile } = useStore();
  const [txs, setTxs] = useState([]);
  const [sub, setSub] = useState('rank');
  const [loading, setLoading] = useState(true);
  
  const myId = getTelegramId();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await fetchProfile(); 
    
    try {
      const data = await api.getTransactions();
      setTxs(data.transactions || []);
    } catch (e) {
      console.error("Failed to load transactions", e);
    }
    setLoading(false);
  };

  const daysLeft = season
    ? Math.max(0, Math.ceil((new Date(season.end_date) - Date.now()) / 86400000))
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="shimmer h-3 w-28 rounded" />
      </div>
    );
  }

  const TX_META = {
    buy:      { label: 'Kauf',     emoji: '📈', sign: '-', color: 'text-neon-red' },
    sell:     { label: 'Verkauf',  emoji: '📉', sign: '+', color: 'text-neon-green' },
    fee:      { label: 'Gebühr',  emoji: '💸', sign: '-', color: 'text-neon-gold' },
    rent:     { label: 'Miete',   emoji: '🏠', sign: '+', color: 'text-neon-green' },
    bailout:  { label: 'Rettung', emoji: '🆘', sign: '+', color: 'text-neon-blue' },
    leverage: { label: 'Hebel',   emoji: '🔥', sign: '-', color: 'text-neon-gold' },
  };

  return (
    <div className="space-y-3 pb-4">
      <div className="flex gap-1.5">
        {[
          { id: 'rank', label: '🏆 Rangliste' },
          { id: 'history', label: '📜 History' },
        ].map(t => {
          const act = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)}
              className="btn-press flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: act ? 'rgba(251,191,36,0.08)' : 'var(--bg-card)',
                border: `1px solid ${act ? 'rgba(251,191,36,0.2)' : 'var(--border-dim)'}`,
                color: act ? 'var(--neon-gold)' : 'var(--text-dim)',
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {sub === 'rank' ? (
        <>
          {season && (
            <div className="card p-4 relative overflow-hidden"
                 style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(168,85,247,0.04) 100%)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-neon-gold">Aktive Season</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{season.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Noch {daysLeft} Tage</p>
                  <p className="text-xl font-mono font-bold text-neon-gold">
                    {feePool?.toFixed(2) || '0.00'}€
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {[
                  { m: '🥇', pct: 40 },
                  { m: '🥈', pct: 25 },
                  { m: '🥉', pct: 15 },
                  { m: '🎖️', pct: 20 },
                ].map((p, i) => (
                  <div key={i} className="text-center py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <span className="text-sm">{p.m}</span>
                    <p className="text-[10px] font-mono text-neon-gold">{((feePool || 0) * p.pct / 100).toFixed(0)}€</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {leaderboard?.map((p, i) => {
              const medal = ['🥇', '🥈', '🥉'][i];
              const isMe = Number(p.telegram_id) === Number(myId);
              return (
                <div key={p.id}
                  className={`card p-3 flex items-center justify-between transition-all ${
                    isMe ? 'ring-1 ring-neon-blue/25' : ''
                  }`}
                  style={isMe ? { background: 'rgba(56,189,248,0.04)' } : {}}>
                  <div className="flex items-center gap-3">
                    {medal ? (
                      <span className="text-xl w-7 text-center">{medal}</span>
                    ) : (
                      <span className="text-xs font-mono font-bold w-7 text-center" style={{ color: 'var(--text-dim)' }}>
                        {i + 1}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold">
                        {p.first_name}
                        {isMe && <span className="text-[10px] text-neon-blue ml-1.5 font-normal">(Du)</span>}
                      </p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        Vol: {Number(p.total_volume || 0).toLocaleString('de-DE')}€
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold">
                      {Number(p.net_worth || 0).toLocaleString('de-DE')}€
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--text-dim)' }}>Net Worth</p>
                  </div>
                </div>
              );
            })}
            {(!leaderboard || leaderboard.length === 0) && (
              <div className="card p-8 text-center">
                <span className="text-4xl">🏆</span>
                <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>Noch keine Spieler</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            {txs.map(tx => {
              const m = TX_META[tx.type] || { label: tx.type, emoji: '📝', sign: '', color: '' };
              return (
                <div key={tx.id} className="card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{m.emoji}</span>
                    <div>
                      <p className={`text-xs font-bold ${m.color}`}>{m.label}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        {tx.symbol && `${tx.symbol} · `}
                        {new Date(tx.created_at).toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {tx.amount > 0 && (
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        {Number(tx.amount).toFixed(6)} {tx.symbol}
                      </p>
                    )}
                    <p className={`text-xs font-mono font-bold ${
                      ['sell','rent','bailout'].includes(tx.type) ? 'text-neon-green' : 'text-neon-red'
                    }`}>
                      {['sell','rent','bailout'].includes(tx.type) ? '+' : '-'}{Number(tx.total_eur || 0).toFixed(2)}€
                    </p>
                  </div>
                </div>
              );
            })}
            {txs.length === 0 && (
              <div className="card p-8 text-center">
                <span className="text-4xl">📜</span>
                <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>Noch keine Transaktionen</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
