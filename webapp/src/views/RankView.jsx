import React, { useEffect, useState, useMemo } from 'react';
import useStore from '../lib/store';
import { api, getTelegramId } from '../lib/api';
import PublicProfileView from './PublicProfileView';

export default function RankView() {
  const { leaderboard, season, feePool, fetchProfile, loadLeaderboard, setTab, profile } = useStore();
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
    
    const startKapital = 10000;

    const calculatedBoard = leaderboard.map(p => {
      const geschenkt = Number(p.bonus_received || 0);
      const gesamtVermögen = Number(p.balance || 0) + Number(p.portfolio_value || 0);
      const nettoGewinn = gesamtVermögen - geschenkt - startKapital;
      const profitProzent = (nettoGewinn / startKapital) * 100;

      return {
        ...p,
        fair_profit_eur: nettoGewinn,
        fair_profit_percent: profitProzent
      };
    });

    const top10 = calculatedBoard.slice(0, 10);
    const myIndex = calculatedBoard.findIndex(p => String(p.telegram_id) === String(myId));
    
    if (myIndex >= 10) {
      return [...top10, { ...calculatedBoard[myIndex], rank: myIndex + 1 }];
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
    <div className="space-y-3 pb-4 tab-enter relative">
      
      {selectedUserId && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md overflow-y-auto px-4 py-8">
           <PublicProfileView 
              userId={selectedUserId} 
              onClose={() => setSelectedUserId(null)} 
           />
        </div>
      )}

      <div className="flex gap-1.5">
        {[{ id: 'rank', label: '🏆 Rangliste' }, { id: 'history', label: '📜 History' }].map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              sub === t.id ? 'bg-neon-gold/10 border border-neon-gold/30 text-neon-gold' : 'bg-white/5 border border-white/5 text-white/40'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'rank' ? (
        <>
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1">
            {[
              { id: 'profit_season', label: '🔥 Season Win' },
              { id: 'profit_24h', label: '⚡ 24h Win' },
              { id: 'loss_season', label: '💀 Season Loss' },
              { id: 'loss_24h', label: '📉 24h Loss' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                  filter === f.id ? 'bg-white text-black border-white' : 'bg-black/40 text-white/60 border-white/10'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="card p-4 relative overflow-hidden border-neon-gold/20"
               style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(6,8,15,1) 100%)' }}>
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-[10px] uppercase tracking-tighter font-bold text-neon-gold glow-gold">Season Pool</p>
                <p className="text-sm font-bold mt-0.5 text-white">{season?.name || 'Lade...'}</p>
                {timeLeft && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-neon-red animate-pulse" />
                    <p className="text-[10px] font-mono font-bold text-neon-red uppercase">{timeLeft}</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider font-bold text-white/40">Jackpot</p>
                <p className="text-xl font-mono font-bold text-neon-gold glow-gold">
                  {(feePool || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </p>
              </div>
            </div>

            {filter.startsWith('profit') && (
              <div className="grid grid-cols-4 gap-2 mt-4 relative z-10">
                {[{ m: '🥇', p: 40 }, { m: '🥈', p: 25 }, { m: '🥉', p: 15 }, { m: '🎖️', p: 20 }].map((p, i) => (
                  <div key={i} className="text-center py-2 rounded-xl bg-black/40 border border-white/5 backdrop-blur-md">
                    <span className="text-sm">{p.m}</span>
                    <p className="text-[10px] font-mono font-bold text-neon-gold mt-1">
                      {((feePool || 0) * p.p / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}€
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 mt-2">
            {displayList.map((p, i) => {
              const actualRank = p.rank || (i + 1);
              const medal = actualRank <= 3 ? ['🥇', '🥈', '🥉'][actualRank - 1] : null;
              const isMe = String(p.telegram_id) === String(myId);
              
              const isLoss = filter.includes('loss');
              const perfEuro = p.fair_profit_eur || 0;
              const perfPercent = p.fair_profit_percent || 0;
              
              return (
                <div 
                  key={i} 
                  onClick={() => handleUserClick(p.telegram_id)}
                  className={`card p-3 flex items-center justify-between border-l-2 transition-all cursor-pointer active:scale-[0.98] ${
                    isMe ? 'border-neon-blue bg-neon-blue/5 ring-1 ring-neon-blue/20' : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex justify-center">
                      {medal ? <span className="text-xl">{medal}</span> : <span className="text-xs font-mono opacity-30">{actualRank}</span>}
                    </div>
                    
                    <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">👤</span>
                      )}
                    </div>

                    <div>
                      <p className={`text-sm font-bold ${isMe ? 'text-neon-blue' : 'text-white'}`}>
                        {p.username || p.first_name || 'Unbekannt'}
                        {isMe && <span className="text-[9px] ml-1.5 opacity-50 font-normal">(DU)</span>}
                      </p>
                      <p className="text-[9px] font-mono opacity-40">Umsatz: {Number(p.total_volume || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}€</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono font-bold ${isLoss ? 'text-neon-red' : 'text-neon-green glow-green'}`}>
                      {perfEuro >= 0 ? '+' : ''}{Number(perfEuro).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                    <p className={`text-[10px] font-mono font-bold ${isLoss ? 'text-neon-red/70' : 'text-neon-green/70'}`}>
                      ({Number(perfPercent).toFixed(2)}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {txs.map((tx, idx) => {
            const m = TX_META[tx.type] || { label: tx.type, emoji: '📝', color: 'text-white' };
            const isPos = ['sell', 'rent', 'bailout', 'prize', 'achievement_reward'].includes(tx.type);
            return (
              <div key={idx} className="card p-3 flex items-center justify-between border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-sm">
                    {m.emoji}
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${m.color}`}>{m.label}</p>
                    <p className="text-[10px] font-mono opacity-40">{new Date(tx.created_at).toLocaleString('de-DE')}</p>
                  </div>
                </div>
                <p className={`text-sm font-mono font-bold ${isPos ? 'text-neon-green glow-green' : 'text-neon-red'}`}>
                  {isPos ? '+' : '-'}{Number(tx.total_eur || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
