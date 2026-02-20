import React, { useState, useRef } from 'react';
import useStore from '../lib/store';
import { api } from '../lib/api';

export default function ProfileView() {
  const { profile, achievements, fetchProfile, showToast } = useStore();
  const [uploading, setUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null);

  if (!profile) return <div className="p-4 text-center text-white/50 animate-pulse">Lade Profil...</div>;

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
        showToast('Bild erfolgreich aktualisiert!');
      } catch (err) {
        showToast('Fehler beim Upload.', 'error');
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
      showToast('Bild gelöscht.');
    } catch (err) {
      showToast('Fehler beim Löschen.', 'error');
    }
  };

  const getStatusColor = () => {
    if (isAdmin) return 'bg-neon-red/20 text-neon-red border-neon-red/30';
    if (isPro) return 'bg-neon-gold/20 text-neon-gold border-neon-gold/30';
    return 'bg-white/10 text-white/70 border-white/20';
  };

  const earnedIds = achievements.map(a => a.id || a.achievement_id);
  const potentialAchievements = [
    { id: 1, name: 'Jung-Investor', icon: '💰', description: 'Erreiche dein erstes Guthaben von 15.000€', reward: '+500€' },
    { id: 2, name: 'Daytrader', icon: '📊', description: 'Erreiche ein Handelsvolumen von 50.000€', reward: '+1.000€' },
    { id: 3, name: 'Krypto-Wal', icon: '🐋', description: 'Besitze mehr als 100.000€ Guthaben', reward: '+5.000€' },
    { id: 4, name: 'Marktmacher', icon: '🦈', description: 'Erreiche ein Handelsvolumen von 1.000.000€', reward: '+10.000€' }
  ];

  return (
    <div className="space-y-4 tab-enter pb-20">
      <section className="card p-0 flex flex-col items-center relative overflow-hidden min-h-[220px]">
        <div className="absolute top-0 left-0 w-full h-32 bg-black/40 overflow-hidden">
          {profile.background_url ? (
            <img src={profile.background_url} alt="Background" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-neon-blue/20 to-transparent"></div>
          )}
          {bgUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col items-center mt-12 pb-6">
          <div 
            className="w-24 h-24 rounded-full border-4 border-[#0c1019] overflow-hidden cursor-pointer relative group bg-black/50 flex items-center justify-center shadow-2xl"
            onClick={handleAvatarClick}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-50 transition-all" />
            ) : (
              <span className="text-4xl">👤</span>
            )}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest">Ändern</span>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
                <div className="w-5 h-5 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          <h2 className="text-xl font-bold mt-3 text-white drop-shadow-md">{profile.username}</h2>
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusColor()}`}>
              {status}
            </span>
            <span className="text-[10px] text-white/40 font-medium">
              Seit {joinYear}
            </span>
          </div>

          {(isPro || isAdmin) && (
            <div className="flex gap-2 mt-4">
              <button 
                onClick={handleBgClick}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white/80 transition-all flex items-center gap-2"
              >
                🖼️ BG ändern
              </button>
              {profile.background_url && (
                <button 
                  onClick={(e) => handleDeleteImage(e, 'background')}
                  className="bg-neon-red/10 hover:bg-neon-red/20 border border-neon-red/20 px-3 py-1.5 rounded-lg text-[10px] font-bold text-neon-red transition-all"
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

      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">💎 Besitztümer</h3>
          <button 
            onClick={async () => {
              try {
                const newState = !profile.hide_collectibles;
                await api.updatePrivacy(newState);
                await fetchProfile();
                showToast(newState ? '🙈 Verborgen' : '👁️ Öffentlich');
              } catch (e) { showToast('Fehler', 'error'); }
            }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
              profile?.hide_collectibles ? 'bg-neon-red/10 text-neon-red border-neon-red/20' : 'bg-neon-green/10 text-neon-green border-neon-green/20'
            }`}
          >
            {profile?.hide_collectibles ? '🙈 Verborgen' : '👁️ Sichtbar'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {profile?.collectibles?.length > 0 ? profile.collectibles.map((item, idx) => (
            <div key={idx} className="bg-black/40 border border-white/5 rounded-lg p-2 flex items-center justify-center text-xl relative group">
              {item.collectibles?.icon || '💎'}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-10">
                {item.collectibles?.name}
              </div>
            </div>
          )) : <p className="text-[10px] text-[var(--text-dim)]">Keine Besitztümer vorhanden.</p>}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-bold text-white/90 mb-3">🏆 Erfolge</h3>
        <div className="space-y-2">
          {potentialAchievements.map((ach) => {
            const earned = earnedIds.includes(ach.id);
            return (
              <div key={ach.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${earned ? 'bg-neon-gold/10 border-neon-gold/30' : 'bg-white/5 border-white/5 opacity-40 grayscale'}`}>
                <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-xl shrink-0">{ach.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className={`text-xs font-bold truncate ${earned ? 'text-neon-gold' : 'text-white/70'}`}>{ach.name}</h4>
                    {ach.reward && <span className="text-[9px] font-bold text-neon-green bg-neon-green/10 px-1.5 py-0.5 rounded ml-2">{ach.reward}</span>}
                  </div>
                  <p className="text-[10px] text-white/50 truncate mt-0.5">{ach.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
