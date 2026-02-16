import React, { useEffect, useState } from 'react';
import useStore from '../lib/store';
import { api, getTelegramId } from '../lib/api';

export default function RankView() {
  const { leaderboard, season, feePool, fetchProfile, loadLeaderboard } = useStore();
  const [txs, setTxs] = useState([]);
  const [sub, setSub] = useState('rank');
  const [loading, setLoading] = useState(true);
  
  const myId = getTelegramId();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    await Promise.all([
      fetchProfile(),
      loadLeaderboard()
    ]);
    
    try {
      const data = await api.getTransactions();
      setTxs(data.transactions || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const daysLeft = season
    ? Math.max(0, Math.ceil((new Date(season.end_date) - Date.now()) / 86400000))
    : null;

  const TX_META = {
    buy:      { label: 'Kauf',     emoji: '📈', color: 'text-neon-red' },
    sell:     { label: 'Verkauf',  emoji: '📉', color: 'text-neon-green' },
    fee:      { label: 'Gebühr',   emoji: '💸', color: 'text-neon-gold' },
    rent:     { label: 'Miete',    emoji: '🏠', color: 'text-neon-green' },
    bailout:  { label: 'Rettung',  emoji: '🆘', color: 'text-neon-blue' },
    leverage: { label: 'Hebel',    emoji: '🔥', color: 'text-neon-gold' },
  };

  return (
    <div className="space-y-3 pb-4 tab-enter">
      <div className="flex gap-1.5">
        {[
          { id: 'rank', label: '🏆 ValueTrade Rangliste' },
          { id: 'history', label: '📜 Meine History' },
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

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="shimmer h-2 w-16 rounded-full" />
          <div className="shimmer h-12 w-full rounded-xl" />
          <div className="shimmer h-12 w-full rounded-xl" />
          <div className="shimmer h-12 w-full rounded-xl" />
        </div>
      ) : sub === 'rank' ? (
        <>
          {season && (
            <div className="card p-4 relative overflow-hidden ring-1 ring-neon-gold/20"
                 style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(6,8,15,1) 100%)' }}>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-neon-gold glow-gold">
                    Season Pool
                  </p>
                  <p className="text-sm font-bold mt-0.5 text-white">{season.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-neon-red">
                    Noch {daysLeft} Tage
                  </p>
                  <p className="text-xl font-mono font-bold text-neon-gold glow-gold mt-0.5">
                    {(feePool || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 relative z-10">
                {[
                  { m: '🥇', pct: 40 },
                  { m: '🥈', pct: 25 },
                  { m: '🥉', pct: 15 },
                  { m: '🎖️', pct: 20 },
                ].map((p, i) => (
                  <div key={i} className="text-center py-2 rounded-xl border border-white/5" 
                       style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
                    <span className="text-sm drop-shadow-md">{p.m}</span>
                    <p className="text-[10px] font-mono font-bold text-neon-gold mt-1">
                      {((feePool || 0) * p.pct / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}€
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 mt-2">
            {leaderboard?.map((p, i) => {
              const medal = ['🥇', '🥈', '🥉'][i];
              const isMe = Number(p.telegram_id) === Number(myId);
              
              return (
                <div key={p.id}
                  className={`card p-3 flex items-center justify-between transition-all duration-300 ${
                    isMe ? 'ring-1 ring-neon-blue bg-neon-blue/5' : ''
                  }`}>
                  <div className="flex items-center gap-3">
                    {medal ? (
                      <span className="text-2xl w-8 text-center drop-shadow-md">{medal}</span>
                    ) : (
                      <span className="text-xs font-mono font-bold w-8 text-center opacity-40">
                        {i + 1}
                      </span>
                    )}
                    <div>
                      <p className={`text-sm font-bold ${isMe ? 'text-neon-blue' : 'text-white'}`}>
                        {p.username || p.first_name}
                        {isMe && <span className="text-[9px] uppercase tracking-wider ml-1.5 opacity-70">(Du)</span>}
                      </p>
                      <p className="text-[10px] font-mono font-medium opacity-50 mt-0.5">
                        Vol: {Number(p.total_volume || 0).toLocaleString('de-DE')}€
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono font-bold ${isMe ? 'text-white' : 'text-neon-gold'}`}>
                      {Number(p.net_worth || 0).toLocaleString('de-DE')}€
                    </p>
                    <p className="text-[9px] uppercase tracking-wider font-semibold opacity-40 mt-0.5">
                      Net Worth
                    </p>
                  </div>
                </div>
              );
            })}
            
            {(!leaderboard || leaderboard.length === 0) && (
              <div className="card p-8 text-center">
                <span className="text-4xl opacity-50">🏆</span>
                <p className="text-xs mt-3 font-semibold text-[var(--text-dim)]">Noch keine ValueTrader aktiv</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2 mt-2">
            {txs.map(tx => {
              const m = TX_META[tx.type] || { label: tx.type, emoji: '📝', color: 'text-white' };
              const isPositive = ['sell', 'rent', 'bailout'].includes(tx.type);
              
              return (
                <div key={tx.id} className="card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5">
                      <span className="text-sm">{m.emoji}</span>
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${m.color}`}>{m.label}</p>
                      <p className="text-[10px] font-mono opacity-50 mt-0.5">
                        {tx.symbol && <span className="text-white font-semibold">{tx.symbol} · </span>}
                        {new Date(tx.created_at).toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {tx.amount > 0 && (
                      <p className="text-[10px] font-mono opacity-60 mb-0.5">
                        {Number(tx.amount).toLocaleString('de-DE', { maximumFractionDigits: 6 })} {tx.symbol}
                      </p>
                    )}
                    <p className={`text-sm font-mono font-bold ${
                      isPositive ? 'text-neon-green glow-green' : 'text-neon-red'
                    }`}>
                      {isPositive ? '+' : '-'}{Number(tx.total_eur || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                </div>
              );
            })}
            
            {txs.length === 0 && (
              <div className="card p-8 text-center">
                <span className="text-4xl opacity-50">📜</span>
                <p className="text-xs mt-3 font-semibold text-[var(--text-dim)]">Transaktions-Log ist leer</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
