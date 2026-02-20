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
      <div className="p-4 text-center text-white/50 animate-pulse flex flex-col items-center justify-center h-full pt-20">
        Lade Profil...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-neon-red pt-20">
        Profil konnte nicht geladen werden.
        <button onClick={onClose} className="block mt-4 text-white/50 mx-auto underline text-xs">Zurück</button>
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
    if (profileInfo.status === 'Admin') return 'bg-neon-red/20 text-neon-red border-neon-red/30';
    if (profileInfo.status === 'Pro') return 'bg-neon-gold/20 text-neon-gold border-neon-gold/30';
    return 'bg-white/10 text-white/70 border-white/20';
  };

  return (
    <div className="space-y-4 tab-enter pb-20 relative pt-2">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-50 bg-black/60 border border-white/10 w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors shadow-lg"
      >
        ✕
      </button>

      <section className="card p-0 flex flex-col items-center relative overflow-hidden min-h-[220px]">
        {/* Background Bild Bereich */}
        <div className="absolute top-0 left-0 w-full h-32 bg-black/40 overflow-hidden">
          {profileInfo.background_url ? (
            <img 
              src={profileInfo.background_url} 
              alt="Background" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-neon-blue/20 to-transparent"></div>
          )}
        </div>
        
        <div className="relative z-10 flex flex-col items-center mt-12 pb-6">
          <div className="w-24 h-24 rounded-full border-4 border-[#0c1019] overflow-hidden bg-black/50 flex items-center justify-center shadow-2xl">
            {profileInfo.avatar_url ? (
              <img 
                src={profileInfo.avatar_url} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">👤</span>
            )}
          </div>
          
          <h2 className="text-xl font-bold mt-3 text-white drop-shadow-md">
            {profileInfo.username || 'Unbekannter Trader'}
          </h2>
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusColor()}`}>
              {profileInfo.status || 'Trader'}
            </span>
            <span className="text-[10px] text-white/40 font-medium">
              Seit {joinYear}
            </span>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-bold text-white/90 mb-4 text-center">
          💎 Besitztümer
        </h3>
        
        {collectiblesList.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3">
            {collectiblesList.map((item, idx) => (
              <div 
                key={idx} 
                className="w-12 h-12 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center text-2xl shadow-inner relative group cursor-default"
              >
                {item.collectibles?.icon || '💎'}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 border border-white/10 text-[9px] text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10">
                  {item.collectibles?.name || 'Unbekannt'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[10px] text-white/40 italic">
            Keine öffentlichen Besitztümer.
          </p>
        )}
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-bold text-white/90 mb-4 text-center">
          🏆 Abzeichen
        </h3>
        
        {achievementsList.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-4">
            {achievementsList.map((ach) => (
              <div 
                key={ach.id || Math.random()} 
                className="w-14 h-14 rounded-full bg-neon-gold/10 border border-neon-gold/30 flex items-center justify-center text-2xl shadow-[0_0_12px_rgba(255,215,0,0.15)] relative group cursor-default"
              >
                {ach.icon || '🎖️'}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 border border-white/10 text-[10px] text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10">
                  {ach.name || 'Geheimnis'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[10px] text-white/40 italic">
            Noch keine Abzeichen gesammelt.
          </p>
        )}
      </section>
    </div>
  );
}
