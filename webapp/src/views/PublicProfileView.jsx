import React, { useEffect, useState } from 'react';
import useStore from '../lib/store';

export default function PublicProfileView({ userId, onClose }) {
  const { loadPublicProfile } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    loadPublicProfile(userId)
      .then((res) => {
        if (res) setData(res);
        else setData(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId, loadPublicProfile]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 h-full">
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Lade Profil...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20 px-6 text-center gap-4">
        <span className="text-4xl opacity-50 drop-shadow-md">⚠️</span>
        <div>
          <p className="text-sm font-black text-white">Profil nicht gefunden</p>
          <p className="text-[10px] text-[var(--text-dim)] mt-1 uppercase tracking-wider">Der Spieler existiert nicht oder ist privat.</p>
        </div>
        <button 
          onClick={onClose} 
          className="mt-4 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95"
        >
          Zurück
        </button>
      </div>
    );
  }

  const profileInfo = data.profile || data;
  const collectiblesList = data.collectibles || profileInfo.collectibles || [];
  const achievementsList = profileInfo.achievements || [];

  const joinYear = profileInfo.created_at 
    ? new Date(profileInfo.created_at).getFullYear() 
    : new Date().getFullYear();

  const getStatusColor = () => {
    if (profileInfo.status === 'Admin') return 'bg-neon-red/10 text-neon-red border-neon-red/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
    if (profileInfo.status === 'Pro') return 'bg-neon-gold/10 text-neon-gold border-neon-gold/30 shadow-[0_0_10px_rgba(251,191,36,0.2)]';
    return 'bg-white/5 text-[var(--text-dim)] border-white/10';
  };

  return (
    <div className="space-y-4 tab-enter pb-8 px-2 relative pt-2">
      
      {/* Schließen Button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-lg active:scale-95 transition-all hover:bg-white/10 shadow-lg backdrop-blur-md"
      >
        ✕
      </button>

      {/* Profil Header */}
      <section className="card p-0 flex flex-col items-center relative overflow-hidden min-h-[240px] border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/80 shadow-xl">
        <div className="absolute top-0 left-0 w-full h-36 bg-black/60 overflow-hidden">
          {profileInfo.background_url ? (
            <>
              <img src={profileInfo.background_url} alt="Background" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c14] to-transparent"></div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-neon-blue/10 to-transparent"></div>
          )}
        </div>

        <div className="relative z-10 flex flex-col items-center mt-14 pb-6 w-full">
          <div className="w-24 h-24 rounded-2xl border border-white/10 overflow-hidden relative bg-black/80 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] rotate-3 transition-all duration-300">
            {profileInfo.avatar_url ? (
              <img src={profileInfo.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl opacity-50">👤</span>
            )}
          </div>
          
          <h2 className="text-2xl font-black mt-4 text-white drop-shadow-lg tracking-tight">
            {profileInfo.username || 'Unbekannter Trader'}
          </h2>
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${getStatusColor()}`}>
              {profileInfo.status || 'Trader'}
            </span>
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
              Seit {joinYear}
            </span>
          </div>
        </div>
      </section>

      {/* Besitztümer */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Besitztümer</h3>
        </div>

        <div className="card p-4 border border-white/5 bg-black/40 backdrop-blur-sm min-h-[80px]">
          {collectiblesList.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {collectiblesList.map((item, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center justify-center text-2xl relative group hover:bg-white/[0.06] hover:border-neon-purple/30 transition-all shadow-inner">
                  <span className="drop-shadow-md transition-transform group-hover:scale-110">{item.collectibles?.icon || '💎'}</span>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 pointer-events-none shadow-xl backdrop-blur-md">
                    {item.collectibles?.name || 'Unbekannt'}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/10 rotate-45"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full opacity-40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)]">Keine öffentlichen Besitztümer</p>
            </div>
          )}
        </div>
      </section>

      {/* Abzeichen / Erfolge */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-gold shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Abzeichen</h3>
        </div>

        <div className="card p-4 border border-white/5 bg-black/40 backdrop-blur-sm min-h-[80px]">
          {achievementsList.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {achievementsList.map((ach) => (
                <div key={ach.id || Math.random()} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neon-gold/20 to-neon-gold/5 border border-neon-gold/30 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(251,191,36,0.15)] relative group transition-all hover:scale-105">
                  <span className="drop-shadow-md">{ach.icon || '🎖️'}</span>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 pointer-events-none shadow-xl backdrop-blur-md">
                    {ach.name || 'Geheimnis'}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/10 rotate-45"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full opacity-40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)]">Noch keine Abzeichen</p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
