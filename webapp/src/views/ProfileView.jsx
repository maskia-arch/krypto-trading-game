import React, { useState, useRef } from 'react';
import useStore from '../lib/store';
import { api } from '../lib/api';

export default function ProfileView() {
  const { profile, achievements, fetchProfile, showToast } = useStore();
  const [uploading, setUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">Lade Profil...</p>
      </div>
    );
  }

  const isAdmin = profile.is_admin;
  const isPro = profile.is_pro && new Date(profile.pro_until) > new Date();
  const status = isAdmin ? 'Admin' : isPro ? 'Pro' : 'Trader';
  const joinYear = new Date(profile.created_at).getFullYear();

  const handleAvatarClick = () => fileInputRef.current?.click();
  const handleBgClick = () => bgInputRef.current?.click();

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast('Maximal 5MB erlaubt.', 'error');

    type === 'avatar' ? setUploading(true) : setBgUploading(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result;
        if (type === 'avatar') {
          await api.updateAvatar(base64String);
        } else {
          await api.updateBackground(base64String);
        }
        await fetchProfile();
        showToast('✅ Bild erfolgreich aktualisiert!');
      } catch (err) {
        showToast('❌ Fehler beim Upload.', 'error');
      } finally {
        type === 'avatar' ? setUploading(false) : setBgUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (e, type) => {
    e.stopPropagation();
    if (!window.confirm(`Möchtest du das ${type === 'avatar' ? 'Profilbild' : 'Hintergrundbild'} löschen?`)) return;
    
    try {
      type === 'avatar' ? await api.deleteAvatar() : await api.deleteBackground();
      await fetchProfile();
      showToast('✅ Bild gelöscht.');
    } catch (err) {
      showToast('❌ Fehler beim Löschen.', 'error');
    }
  };

  const getStatusColor = () => {
    if (isAdmin) return 'bg-neon-red/10 text-neon-red border-neon-red/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
    if (isPro) return 'bg-neon-gold/10 text-neon-gold border-neon-gold/30 shadow-[0_0_10px_rgba(251,191,36,0.2)]';
    return 'bg-white/5 text-[var(--text-dim)] border-white/10';
  };

  const earnedIds = achievements.map(a => a.id || a.achievement_id);
  const potentialAchievements = [
    { id: 1, name: 'Jung-Investor', icon: '💰', description: 'Erreiche dein erstes Guthaben von 15.000€', reward: '+500€' },
    { id: 2, name: 'Daytrader', icon: '📊', description: 'Erreiche ein Handelsvolumen von 50.000€', reward: '+1.000€' },
    { id: 3, name: 'Krypto-Wal', icon: '🐋', description: 'Besitze mehr als 100.000€ Guthaben', reward: '+5.000€' },
    { id: 4, name: 'Marktmacher', icon: '🦈', description: 'Erreiche ein Handelsvolumen von 1.000.000€', reward: '+10.000€' }
  ];

  return (
    <div className="space-y-4 tab-enter pb-8 px-2">
      <section className="card p-0 flex flex-col items-center relative overflow-hidden min-h-[240px] border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/80 shadow-xl">
        <div className="absolute top-0 left-0 w-full h-36 bg-black/60 overflow-hidden">
          {profile.background_url ? (
            <>
              <img src={profile.background_url} alt="Background" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c14] to-transparent"></div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-neon-blue/10 to-transparent"></div>
          )}
          {bgUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <div className="w-6 h-6 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col items-center mt-14 pb-6 w-full">
          <div 
            className="w-24 h-24 rounded-2xl border border-white/10 overflow-hidden cursor-pointer relative group bg-black/80 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] rotate-3 hover:rotate-0 transition-all duration-300"
            onClick={handleAvatarClick}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-40 transition-all duration-500" />
            ) : (
              <span className="text-4xl opacity-50">👤</span>
            )}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
              <span className="text-white text-[9px] font-black uppercase tracking-widest drop-shadow-md">Ändern</span>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
                <div className="w-5 h-5 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-black mt-4 text-white drop-shadow-lg tracking-tight">{profile.username}</h2>
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${getStatusColor()}`}>
              {status}
            </span>
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
              Seit {joinYear}
            </span>
          </div>

          {(isPro || isAdmin) && (
            <div className="flex gap-2 mt-5">
              <button 
                onClick={handleBgClick}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/80 transition-all flex items-center gap-2 backdrop-blur-sm shadow-sm"
              >
                🖼️ BG ändern
              </button>
              {profile.background_url && (
                <button 
                  onClick={(e) => handleDeleteImage(e, 'background')}
                  className="bg-neon-red/10 hover:bg-neon-red/20 border border-neon-red/20 px-4 py-2 rounded-xl text-[10px] font-bold text-neon-red transition-all backdrop-blur-sm shadow-sm"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>

        <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'avatar')} accept="image/*" className="hidden" />
        <input type="file" ref={bgInputRef} onChange={(e) => handleFileChange(e, 'background')} accept="image/*" className="hidden" />
      </section>

      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Besitztümer</h3>
          </div>
          <button 
            onClick={async () => {
              try {
                const newState = !profile.hide_collectibles;
                await api.updatePrivacy(newState);
                await fetchProfile();
                showToast(newState ? '🙈 Verborgen' : '👁️ Öffentlich');
              } catch (e) { showToast('Fehler', 'error'); }
            }}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
              profile?.hide_collectibles 
                ? 'bg-neon-red/10 text-neon-red border-neon-red/20 hover:bg-neon-red/20' 
                : 'bg-neon-green/10 text-neon-green border-neon-green/20 hover:bg-neon-green/20 shadow-[0_0_10px_rgba(34,214,138,0.1)]'
            }`}
          >
            {profile?.hide_collectibles ? '🙈 Verborgen' : '👁️ Sichtbar'}
          </button>
        </div>

        <div className="card p-4 border border-white/5 bg-black/40 backdrop-blur-sm min-h-[80px]">
          {profile?.collectibles?.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {profile.collectibles.map((item, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center justify-center text-2xl relative group hover:bg-white/[0.06] hover:border-neon-purple/30 transition-all shadow-inner">
                  <span className="drop-shadow-md group-hover:scale-110 transition-transform">{item.collectibles?.icon || '💎'}</span>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-20 pointer-events-none shadow-xl backdrop-blur-md">
                    {item.collectibles?.name}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/10 rotate-45"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full opacity-40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)]">Keine Besitztümer</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-gold shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Erfolge</h3>
        </div>
        
        <div className="space-y-2.5">
          {potentialAchievements.map((ach) => {
            const earned = earnedIds.includes(ach.id);
            return (
              <div key={ach.id} className={`card p-3 flex items-center gap-4 border relative overflow-hidden transition-all duration-300 ${
                earned 
                  ? 'bg-gradient-to-r from-neon-gold/10 to-transparent border-neon-gold/20 shadow-[0_4px_15px_rgba(251,191,36,0.05)]' 
                  : 'bg-black/40 border-white/5 opacity-60 grayscale-[50%]'
              }`}>
                {earned && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-gold shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>}
                
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${
                  earned ? 'bg-black/40 border border-neon-gold/30' : 'bg-white/5 border border-white/5'
                }`}>
                  <span className="drop-shadow-md">{ach.icon}</span>
                </div>
                
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className={`text-[13px] font-black tracking-tight truncate ${earned ? 'text-neon-gold drop-shadow-sm' : 'text-white/70'}`}>
                      {ach.name}
                    </h4>
                    {ach.reward && (
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ml-2 shrink-0 ${
                        earned ? 'text-neon-gold bg-neon-gold/10 border border-neon-gold/20' : 'text-neon-green bg-neon-green/10'
                      }`}>
                        {ach.reward}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-[var(--text-dim)] truncate leading-relaxed">
                    {ach.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
