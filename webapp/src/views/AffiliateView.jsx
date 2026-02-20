import React, { useState, useEffect } from 'react';
import useStore from '../lib/store';
import { api } from '../lib/api';

export default function AffiliateView() {
  const { profile, setTab, showToast } = useStore();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'DeinBotName'; 
  const inviteLink = `https://t.me/${botUsername}?start=ref_${profile?.telegram_id}`;

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    try {
      const data = await api.getReferrals();
      setReferrals(data.referrals || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showToast('✅ Link in die Zwischenablage kopiert!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast('❌ Kopieren fehlgeschlagen.', 'error');
    }
  };

  return (
    <div className="space-y-5 tab-enter pb-8 px-2">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={() => setTab('settings')}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg active:scale-95 transition-all hover:bg-white/10 shadow-sm"
        >
          🔙
        </button>
        <div>
          <h2 className="text-xl font-black text-white drop-shadow-md tracking-tight">Affiliate Programm</h2>
          <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest mt-0.5">Lade Freunde ein und verdiene</p>
        </div>
      </div>

      <section className="card p-6 border border-neon-gold/20 bg-gradient-to-br from-[#0a0c14] to-black/80 backdrop-blur-xl relative overflow-hidden text-center shadow-[0_8px_32px_rgba(251,191,36,0.1)]">
        <div className="absolute top-0 right-0 w-40 h-40 bg-neon-gold/20 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-neon-gold/10 rounded-full blur-[50px] pointer-events-none" />
        
        <div className="w-16 h-16 mx-auto bg-black/60 border border-neon-gold/40 rounded-full flex items-center justify-center text-3xl mb-4 shadow-[0_0_20px_rgba(251,191,36,0.3)] relative z-10">
          🎁
        </div>
        
        <h3 className="text-xl font-black text-neon-gold drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] relative z-10 tracking-tight">500€ Bonus sichern</h3>
        <p className="text-[11px] text-white/70 mt-3 max-w-[260px] mx-auto leading-relaxed relative z-10 font-medium">
          Für jeden Freund, der sich über deinen Link anmeldet, erhalten <b className="text-white drop-shadow-sm">du und dein Freund</b> sofort jeweils 500,00€ Start-Bonus geschenkt!
        </p>

        <div className="mt-6 p-1.5 bg-black/60 border border-white/10 rounded-2xl flex items-center relative z-10 backdrop-blur-sm shadow-inner focus-within:border-neon-gold/50 transition-colors">
          <input 
            type="text" 
            readOnly 
            value={inviteLink}
            className="bg-transparent flex-1 text-[11px] font-mono font-bold text-white/80 px-3 outline-none select-all"
          />
          <button 
            onClick={handleCopy}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              copied 
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 shadow-[0_0_15px_rgba(34,214,138,0.2)]' 
                : 'bg-neon-gold/90 text-black border border-neon-gold shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:bg-neon-gold hover:scale-105 active:scale-95'
            }`}
          >
            {copied ? 'Kopiert!' : 'Kopieren'}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-black pl-1 flex items-center justify-between uppercase tracking-widest text-[var(--text-dim)]">
          <span>👥 Geworbene Freunde</span>
          <span className="text-[10px] bg-white/10 px-2.5 py-1 rounded-md text-white border border-white/5">{referrals.length}</span>
        </h3>

        {loading ? (
          <div className="card p-8 flex items-center justify-center border border-white/5 bg-black/20">
            <div className="w-6 h-6 border-2 border-neon-gold/30 border-t-neon-gold rounded-full animate-spin"></div>
          </div>
        ) : referrals.length === 0 ? (
          <div className="card p-8 border border-dashed border-white/10 bg-black/20 text-center flex flex-col items-center justify-center gap-2">
            <p className="text-4xl opacity-40 drop-shadow-md">🏜️</p>
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mt-2">Keine Einladungen</p>
            <p className="text-[9px] text-white/30 uppercase tracking-wider">Teile deinen Link, um das zu ändern!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {referrals.map((ref, idx) => (
              <div key={idx} className="card p-3 flex items-center gap-3 border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
                <div className="absolute inset-0 bg-neon-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="w-11 h-11 rounded-full border border-white/10 overflow-hidden bg-black/60 flex items-center justify-center shrink-0 shadow-inner relative z-10">
                  {ref.avatar_url ? (
                    <img src={ref.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg opacity-50">👤</span>
                  )}
                </div>
                
                <div className="flex-1 relative z-10">
                  <p className="text-[13px] font-black text-white tracking-tight drop-shadow-sm">{ref.username || ref.first_name}</p>
                  <p className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-wider mt-0.5">Beigetreten: {new Date(ref.created_at).toLocaleDateString('de-DE')}</p>
                </div>
                
                <div className="text-right relative z-10">
                  <p className="text-sm font-mono font-black text-neon-green drop-shadow-[0_0_5px_rgba(34,214,138,0.4)]">+500€</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
