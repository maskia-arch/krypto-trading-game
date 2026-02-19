import React, { useState, useEffect } from 'react';
import useStore from '../lib/store';
import { api } from '../lib/api';

export default function AffiliateView() {
  const { profile, setTab, showToast } = useStore();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // WICHTIG: Ersetze "DeinBotName" durch den echten Telegram-Namen deines Bots (ohne @)
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
      console.error("Fehler beim Laden der Referrals:", e);
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
    <div className="space-y-4 tab-enter pb-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setTab('settings')}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg active:scale-95 transition-transform"
        >
          🔙
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Affiliate Programm</h2>
          <p className="text-[11px] text-[var(--text-dim)]">Lade Freunde ein und verdiene mit.</p>
        </div>
      </div>

      <section className="card p-5 border-neon-gold/30 bg-neon-gold/5 relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon-gold/10 rounded-full blur-3xl -mr-10 -mt-10" />
        
        <div className="w-16 h-16 mx-auto bg-black/40 border border-neon-gold/40 rounded-full flex items-center justify-center text-3xl mb-3 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
          🎁
        </div>
        
        <h3 className="text-lg font-black text-neon-gold glow-gold">500€ Bonus sichern</h3>
        <p className="text-xs text-white/70 mt-2 max-w-[250px] mx-auto leading-relaxed">
          Für jeden Freund, der sich über deinen Link anmeldet, erhalten <b className="text-white">du und dein Freund</b> sofort jeweils 500,00€ Start-Bonus geschenkt!
        </p>

        <div className="mt-5 p-1 bg-black/50 border border-white/10 rounded-xl flex items-center">
          <input 
            type="text" 
            readOnly 
            value={inviteLink}
            className="bg-transparent flex-1 text-[11px] font-mono text-white/60 px-3 outline-none select-all"
          />
          <button 
            onClick={handleCopy}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              copied ? 'bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/30' : 'bg-neon-gold text-black shadow-[0_0_10px_rgba(251,191,36,0.3)]'
            }`}
          >
            {copied ? 'Kopiert!' : 'Kopieren'}
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold pl-1 flex items-center justify-between">
          <span>👥 Geworbene Freunde</span>
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{referrals.length}</span>
        </h3>

        {loading ? (
          <div className="card p-6 text-center text-xs text-white/40 animate-pulse">
            Lade Daten...
          </div>
        ) : referrals.length === 0 ? (
          <div className="card p-6 border-dashed border-white/20 bg-transparent text-center">
            <p className="text-3xl opacity-50 mb-2">🏜️</p>
            <p className="text-xs text-white/50">Du hast noch niemanden eingeladen.</p>
            <p className="text-[10px] text-white/30 mt-1">Teile deinen Link, um das zu ändern!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref, idx) => (
              <div key={idx} className="card p-3 flex items-center gap-3 border-white/5 bg-white/[0.02]">
                <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center shrink-0">
                  {ref.avatar_url ? (
                    <img src={ref.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{ref.username || ref.first_name}</p>
                  <p className="text-[10px] text-white/40">Beigetreten am {new Date(ref.created_at).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-[#4ade80]">+500€</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
