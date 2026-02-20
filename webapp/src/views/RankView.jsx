import React, { useEffect, useState, useMemo } from 'react';
import useStore from '../lib/store';
import { api, getTelegramId } from '../lib/api';
import PublicProfileView from './PublicProfileView';

export default function RankView() {
  const { leaderboard, season, feePool, fetchProfile, loadLeaderboard, setTab } = useStore();
  const [txs, setTxs] = useState([]);
  const [sub, setSub] = useState('rank');
  const [filter, setFilter] = useState('profit_season');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState(null);

  const myId = getTelegramId();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProfile(),
      loadLeaderboard(filter)
    ]);
    
    try {
      const data = await api.getTransactions();
      setTxs(data.transactions || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const timeLeft = useMemo(() => {
    if (!season || !season.end_date) return null;
    const diff = new Date(season.end_date) - now;
    if (diff <= 0) return "Beendet";
    
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${d}d ${h}h ${m}m ${s}s`;
  }, [season, now]);

  const displayList = useMemo(() => {
    if (!leaderboard) return [];
    
    const top10 = leaderboard.slice(0, 10);
    const myIndex = leaderboard.findIndex(p => String(p.telegram_id) === String(myId));
    
    if (myIndex >= 10) {
      return [...top10, { ...leaderboard[myIndex], rank: myIndex + 1 }];
    }
    return top10;
  }, [leaderboard, myId]);

  const TX_META = {
    buy:      { label: 'Kauf',     emoji: '📈', color: 'text-neon-red' },
    sell:     { label: 'Verkauf',  emoji: '📉', color: 'text-neon-green' },
    fee:      { label: 'Gebühr',   emoji: '💸', color: 'text-neon-gold' },
    rent:     { label: 'Miete',    emoji: '🏠', color: 'text-neon-green' },
    bailout:  { label: 'Rettung',  emoji: '🆘', color: 'text-neon-blue' },
    leverage: { label: 'Hebel',    emoji: '🔥', color: 'text-neon-gold' },
    prize:    { label: 'Gewinn',   emoji: '🎁', color: 'text-neon-gold' },
    achievement_reward: { label: 'Erfolg', emoji: '🏆', color: 'text-neon-gold' },
  };

  const handleUserClick = (tgId) => {
    if (String(tgId) === String(myId)) {
      setTab('profile');
    } else {
      setSelectedUserId(tgId);
    }
  };

  return (
    <div className="space-y-4 tab-enter relative pb-6">
      
      {selectedUserId && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl overflow-y-auto px-2 py-4">
           <PublicProfileView 
              userId={selectedUserId} 
              onClose={() => setSelectedUserId(null)} 
           />
        </div>
      )}

      {/* Main Toggle */}
      <div className="flex bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-inner mb-4">
        {[{ id: 'rank', label: '🏆 Rangliste' }, { id: 'history', label: '📜 History' }].map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl transition-all duration-300 ${
              sub === t.id 
                ? 'bg-neon-gold/20 text-neon-gold shadow-[0_0_15px_rgba(251,191,36,0.2)] border border-neon-gold/30' 
                : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'rank' ? (
        <div className="space-y-4 tab-enter">
          
          {/* Filters */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1 px-1">
            {[
              { id: 'profit_season', label: '🔥 Season Win' },
              { id: 'profit_24h', label: '⚡ 24h Win' },
              { id: 'loss_season', label: '💀 Season Loss' },
              { id: 'loss_24h', label: '📉 24h Loss' },
            ].map(f => {
              const active = filter === f.id;
              const isWin = f.id.includes('profit');
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border ${
                    active 
                      ? isWin ? 'bg-neon-green/10 text-neon-green border-neon-green/30 shadow-[0_0_10px_rgba(34,214,138,0.2)]' : 'bg-neon-red/10 text-neon-red border-neon-red/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                      : 'bg-black/40 text-[var(--text-dim)] border-white/5 hover:text-white/80'
                  }`}>
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Season Pool Card */}
          <div className="card p-5 border border-neon-gold/20 bg-gradient-to-br from-[#0a0c14] to-black/80 shadow-[0_8px_32px_rgba(251,191,36,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-neon-gold/20 rounded-full blur-[60px] pointer-events-none" />
            
            <div className="flex items-start justify-between relative z-10 mb-5">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-gold animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-neon-gold drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]">Season Pool</p>
                </div>
                <p className="text-lg font-black mt-1 text-white tracking-tight">{season?.name || 'Lade Season...'}</p>
                {timeLeft && (
                  <div className="mt-2 flex items-center gap-2 bg-neon-red/10 border border-neon-red/20 px-2.5 py-1 rounded-md w-fit">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-neon-red animate-ping" />
                    <p className="text-[9px] font-mono font-bold text-neon-red uppercase tracking-widest">{timeLeft}</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--text-dim)] mb-1">Jackpot</p>
                <p className="text-2xl font-mono font-black text-neon-gold drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">
                  {(feePool || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </p>
              </div>
            </div>

            {filter.startsWith('profit') && (
              <div className="grid grid-cols-4 gap-2 relative z-10 border-t border-white/5 pt-4">
                {[{ m: '🥇', p: 40 }, { m: '🥈', p: 25 }, { m: '🥉', p: 15 }, { m: '🎖️', p: 20 }].map((p, i) => (
                  <div key={i} className="text-center py-2.5 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm hover:bg-white/[0.06] transition-colors">
                    <span className="text-lg drop-shadow-md">{p.m}</span>
                    <p className="text-[10px] font-mono font-black text-neon-gold mt-1 drop-shadow-sm">
                      {((feePool || 0) * p.p / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}€
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 opacity-50">
                 <div className="w-8 h-8 border-2 border-neon-gold/30 border-t-neon-gold rounded-full animate-spin"></div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Lade Rangliste...</p>
              </div>
            ) : displayList.map((p, i) => {
              const actualRank = p.rank || (i + 1);
              const medal = actualRank <= 3 ? ['🥇', '🥈', '🥉'][actualRank - 1] : null;
              const isMe = String(p.telegram_id) === String(myId);
              
              const isLoss = filter.includes('loss');
              const perfEuro = p.performance_euro || 0;
              const perfPercent = p.performance_percent || 0;
              
              return (
                <div 
                  key={i} 
                  onClick={() => handleUserClick(p.telegram_id)}
                  className={`card p-3 flex items-center justify-between transition-all duration-300 cursor-pointer group relative overflow-hidden ${
                    isMe 
                      ? 'border border-neon-blue/50 bg-gradient-to-r from-neon-blue/10 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                      : 'border border-white/5 bg-black/40 hover:bg-white/[0.04]'
                  }`}
                >
                  {isMe && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-blue shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>}
                  
                  <div className="flex items-center gap-3 pl-1">
                    <div className="w-8 flex justify-center text-center">
                      {medal ? (
                        <span className="text-2xl drop-shadow-md group-hover:scale-110 transition-transform">{medal}</span>
                      ) : (
                        <span className={`text-[13px] font-black font-mono ${isMe ? 'text-neon-blue' : 'text-white/30'}`}>#{actualRank}</span>
                      )}
                    </div>
                    
                    <div className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner ${
                      isMe ? 'bg-neon-blue/10 border border-neon-blue/30' : 'bg-white/5 border border-white/10'
                    }`}>
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl opacity-60">👤</span>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <p className={`text-[13px] font-black tracking-tight flex items-center gap-1.5 ${isMe ? 'text-neon-blue drop-shadow-sm' : 'text-white'}`}>
                        {p.username || p.first_name || 'Unbekannt'}
                        {isMe && <span className="bg-neon-blue/20 text-neon-blue text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase">DU</span>}
                      </p>
                      <p className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-wider mt-0.5">Umsatz: {Number(p.total_volume || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}€</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-[14px] font-mono font-black tracking-tighter ${
                      isLoss 
                        ? 'text-neon-red drop-shadow-[0_0_5px_rgba(244,63,94,0.4)]' 
                        : 'text-neon-green drop-shadow-[0_0_5px_rgba(34,214,138,0.4)]'
                    }`}>
                      {perfEuro > 0 ? '+' : ''}{Number(perfEuro).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                    <p className={`text-[10px] font-mono font-bold mt-0.5 ${isLoss ? 'text-neon-red/70' : 'text-neon-green/70'}`}>
                      ({perfEuro > 0 ? '+' : ''}{Number(perfPercent).toFixed(2)}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 tab-enter">
          <div className="flex items-center gap-2 px-1 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
            <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Letzte Transaktionen</p>
          </div>
          
          {txs.length === 0 && !loading ? (
             <div className="card p-8 border border-white/5 bg-black/40 flex flex-col items-center justify-center text-center opacity-50">
               <span className="text-3xl mb-2 grayscale">📜</span>
               <p className="text-[10px] font-black uppercase tracking-widest">Keine Historie vorhanden</p>
             </div>
          ) : txs.map((tx, idx) => {
            const m = TX_META[tx.type] || { label: tx.type, emoji: '📝', color: 'text-white' };
            const isPos = ['sell', 'rent', 'bailout', 'prize', 'achievement_reward'].includes(tx.type);
            
            return (
              <div key={idx} className="card p-3 flex items-center justify-between border border-white/5 bg-black/40 backdrop-blur-sm hover:bg-white/[0.03] transition-colors relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-1 opacity-50 ${isPos ? 'bg-neon-green' : 'bg-neon-red'}`}></div>
                
                <div className="flex items-center gap-4 pl-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-black/60 border border-white/10 text-xl shadow-inner group-hover:scale-105 transition-transform">
                    {m.emoji}
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest drop-shadow-sm ${m.color}`}>{m.label}</p>
                    <p className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-wider mt-0.5">{new Date(tx.created_at).toLocaleString('de-DE')}</p>
                  </div>
                </div>
                
                <p className={`text-[14px] font-mono font-black tracking-tighter ${isPos ? 'text-neon-green drop-shadow-[0_0_5px_rgba(34,214,138,0.4)]' : 'text-neon-red drop-shadow-[0_0_5px_rgba(244,63,94,0.4)]'}`}>
                  {isPos ? '+' : ''}{Number(tx.total_eur || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
