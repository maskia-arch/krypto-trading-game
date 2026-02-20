import React, { useState } from 'react';
import useStore from '../lib/store';
import { api } from '../lib/api';

export default function SettingsView() {
  const { profile, fetchProfile, showToast, setTab, version } = useStore();
  const [newName, setNewName] = useState('');
  const [deleteStep, setDeleteStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const isPro = profile?.is_admin || (profile?.is_pro && new Date(profile.pro_until) > new Date());
  const canChangeName = isPro || (profile?.username_changes || 0) < 1;

  const isTyping = newName.length > 0;
  const isValidLength = newName.length >= 4 && newName.length <= 16;
  const isValidChars = /^[a-zA-Z0-9]+$/.test(newName);
  const isValidName = isValidLength && isValidChars;
  const showValidationError = isTyping && !isValidName;

  const handleUpdateName = async () => {
    if (!isValidName || !canChangeName) return;
    setBusy(true);
    try {
      await api.updateUsername(newName.trim());
      showToast('✅ Username erfolgreich geändert!');
      await fetchProfile();
      setNewName('');
    } catch (e) {
      showToast(`❌ ${e.message}`, 'error');
    }
    setBusy(false);
  };

  const requestDeletion = async () => {
    setBusy(true);
    try {
      await api.requestAccountDeletion();
      setDeleteStep(2);
      showToast('⚠️ Löschantrag gestellt.');
    } catch (e) {
      showToast('❌ Fehler beim Löschantrag.', 'error');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4 tab-enter pb-8 px-2 pt-2">
      
      {/* Profile Link Card */}
      <section className="card p-4 flex items-center justify-between border border-neon-blue/20 bg-gradient-to-br from-neon-blue/10 to-transparent backdrop-blur-md relative overflow-hidden group shadow-[0_4px_20px_rgba(59,130,246,0.05)] transition-all hover:border-neon-blue/40">
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-neon-blue/20 blur-[50px] pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl border border-neon-blue/30 overflow-hidden bg-black/60 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl opacity-80">👤</span>
            )}
          </div>
          <div>
            <h3 className="text-[14px] font-black text-white tracking-tight drop-shadow-sm">Dein Profil</h3>
            <p className="text-[10px] text-neon-blue font-bold uppercase tracking-wider mt-0.5 opacity-80">Achievements & Avatar</p>
          </div>
        </div>
        <button 
          onClick={() => setTab('profile')}
          className="relative z-10 bg-neon-blue/20 text-neon-blue border border-neon-blue/30 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-blue/30 active:scale-95 transition-all shadow-[0_0_10px_rgba(59,130,246,0.15)]"
        >
          Öffnen
        </button>
      </section>

      {/* Affiliate Link Card */}
      <section className="card p-4 flex items-center justify-between border border-neon-gold/20 bg-gradient-to-br from-neon-gold/10 to-transparent backdrop-blur-md relative overflow-hidden group shadow-[0_4px_20px_rgba(251,191,36,0.05)] transition-all hover:border-neon-gold/40">
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-neon-gold/20 blur-[50px] pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl border border-neon-gold/30 overflow-hidden bg-black/60 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <span className="text-2xl drop-shadow-md">🤝</span>
          </div>
          <div>
            <h3 className="text-[14px] font-black text-neon-gold tracking-tight drop-shadow-sm">Affiliate</h3>
            <p className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-wider mt-0.5">500€ Bonus sichern</p>
          </div>
        </div>
        <button 
          onClick={() => setTab('affiliate')}
          className="relative z-10 bg-neon-gold/20 text-neon-gold border border-neon-gold/30 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-gold/30 active:scale-95 transition-all shadow-[0_0_10px_rgba(251,191,36,0.15)]"
        >
          Öffnen
        </button>
      </section>

      {/* Name Settings */}
      <section className="card p-5 border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/80 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)]"></div>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)] flex items-center gap-2">
            Namens-Einstellungen 
            {isPro && <span className="bg-neon-gold/10 border border-neon-gold/20 text-neon-gold px-1.5 py-0.5 rounded text-[8px] tracking-widest shadow-[0_0_8px_rgba(251,191,36,0.2)]">PRO</span>}
          </h3>
        </div>
        
        <div>
          <label className="text-[9px] text-[var(--text-dim)] uppercase font-bold tracking-wider ml-1">Anzeigename ändern</label>
          <div className="flex gap-2 mt-1.5">
            <div className={`flex-1 flex items-center bg-black/60 rounded-xl px-3 py-1.5 transition-all border ${
              isTyping 
                ? isValidName 
                  ? 'border-neon-green/50 shadow-[0_0_10px_rgba(34,214,138,0.1)]' 
                  : 'border-neon-red/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]'
                : 'border-white/10 focus-within:border-white/30'
            }`}>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                placeholder={profile?.username || 'Neuer Name...'}
                disabled={!canChangeName || busy}
                className="bg-transparent w-full outline-none text-white font-mono font-bold text-sm py-2 placeholder:text-white/20 disabled:opacity-50"
              />
            </div>
            
            <button 
              onClick={handleUpdateName}
              disabled={!canChangeName || busy || !isValidName}
              className={`px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isValidName && canChangeName
                  ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20 active:scale-95 shadow-md'
                  : 'bg-white/5 text-white/30 border border-transparent cursor-not-allowed'
              }`}
            >
              {busy ? '⏳' : 'Update'}
            </button>
          </div>
          
          <div className="mt-3 space-y-2">
            <p className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${showValidationError ? 'text-neon-red drop-shadow-[0_0_5px_rgba(244,63,94,0.4)]' : 'text-[var(--text-dim)]'}`}>
              ✏️ 4-16 Zeichen, nur Buchstaben & Zahlen.
            </p>

            <div className="bg-white/[0.02] border border-white/5 p-2 rounded-lg inline-block">
              <p className="text-[9px] font-medium text-white/60 leading-relaxed">
                {isPro 
                  ? '✨ Als Pro-User kannst du deinen Namen unbegrenzt oft ändern.' 
                  : 'ℹ️ In der Standard-Version ist nur eine Namensänderung möglich.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="card p-5 border border-neon-red/20 bg-gradient-to-br from-[#0a0c14] to-neon-red/5 relative overflow-hidden shadow-lg">
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-neon-red/5 blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <h3 className="text-[12px] font-black text-neon-red uppercase tracking-widest drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]">Gefahrenzone</h3>
          <p className="text-[10px] text-white/60 mt-1.5 leading-relaxed font-medium">
            Nach der Löschung werden alle deine Assets, Immobilien und Transaktionen unwiderruflich entfernt.
          </p>

          {deleteStep === 1 ? (
            <button 
              onClick={requestDeletion}
              disabled={busy}
              className="w-full mt-4 py-3.5 rounded-xl border border-neon-red/30 text-neon-red text-[10px] font-black uppercase tracking-widest bg-neon-red/10 hover:bg-neon-red/20 active:scale-95 transition-all shadow-[0_0_15px_rgba(244,63,94,0.1)]"
            >
              Account Löschung beantragen
            </button>
          ) : (
            <div className="mt-4 p-4 bg-black/60 rounded-xl border border-neon-red/50 shadow-inner backdrop-blur-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-white text-center text-neon-red drop-shadow-sm">
                Bestätigung erforderlich!
              </p>
              <p className="text-[10px] text-center mt-1.5 text-white/70 font-medium">
                Sende folgende Nachricht an den Bot:
              </p>
              <div className="bg-neon-red/10 p-3 rounded-lg mt-3 font-mono text-center text-xs select-all border border-dashed border-neon-red/30 text-white font-bold">
                Delete ({profile?.telegram_id})
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer Info */}
      <div className="text-center pt-2 pb-4">
        <p className="opacity-30 text-[9px] font-mono font-bold uppercase tracking-widest text-white">
          ValueTrade Engine v{version || profile?.version || '0.2.7'} • ID: {profile?.telegram_id}
        </p>
      </div>
    </div>
  );
}
