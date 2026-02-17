import React, { useState } from 'react';
import useStore from '../lib/store';
import { api } from '../lib/api';

export default function SettingsView() {
  const { profile, fetchProfile, showToast } = useStore();
  const [newName, setNewName] = useState('');
  const [deleteStep, setDeleteStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const isPro = profile?.is_pro && new Date(profile.pro_until) > new Date();
  const canChangeName = isPro || (profile?.username_changes || 0) < 1;

  const handleUpdateName = async () => {
    if (!newName.trim() || !canChangeName) return;
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
    <div className="space-y-4 tab-enter">
      <section className="card p-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          👤 Profil-Einstellungen {isPro && <span className="text-[10px] bg-neon-gold/20 text-neon-gold px-2 py-0.5 rounded-full uppercase">Pro</span>}
        </h3>
        
        <div>
          <label className="text-[10px] text-[var(--text-dim)] uppercase font-bold">Anzeigename</label>
          <div className="flex gap-2 mt-1">
            <input 
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              placeholder={profile?.username || 'Neuer Name...'}
              disabled={!canChangeName || busy}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
            />
            <button 
              onClick={handleUpdateName}
              disabled={!canChangeName || busy || !newName.trim()}
              className="bg-neon-blue/20 text-neon-blue border border-neon-blue/30 px-4 rounded-xl text-xs font-bold disabled:opacity-30"
            >
              Update
            </button>
          </div>
          <p className="text-[9px] mt-1.5 text-[var(--text-dim)]">
            {isPro 
              ? '✨ Als Pro-User kannst du deinen Namen alle 30 Tage ändern.' 
              : 'ℹ️ In der Standard-Version ist nur eine Namensänderung möglich.'}
          </p>
        </div>
      </section>

      <section className="card p-4 border-neon-red/20 bg-neon-red/5">
        <h3 className="text-sm font-bold text-neon-red">Gefahrenzone</h3>
        <p className="text-[11px] text-[var(--text-dim)] mt-1">
          Nach der Löschung werden alle deine Assets, Immobilien und Transaktionen unwiderruflich entfernt.
        </p>

        {deleteStep === 1 ? (
          <button 
            onClick={requestDeletion}
            disabled={busy}
            className="w-full mt-3 py-2.5 rounded-xl border border-neon-red/30 text-neon-red text-xs font-bold bg-neon-red/10"
          >
            Account Löschung beantragen
          </button>
        ) : (
          <div className="mt-3 p-3 bg-black/40 rounded-xl border border-neon-red/50">
            <p className="text-[11px] font-bold text-white text-center">
              Bestätigung erforderlich!
            </p>
            <p className="text-[10px] text-center mt-1 text-[var(--text-dim)]">
              Sende folgende Nachricht an den Bot:
            </p>
            <div className="bg-white/5 p-2 rounded mt-2 font-mono text-center text-xs select-all border border-dashed border-white/20">
              Delete ({profile?.telegram_id})
            </div>
            <p className="text-[9px] text-center mt-2 opacity-60">
              Nach deiner Nachricht wird der Admin zur endgültigen Löschung benachrichtigt.
            </p>
          </div>
        )}
      </section>

      <div className="text-center opacity-30 text-[10px] pt-4">
        ValueTrade Game v{profile?.version || '1.0'} • ID: {profile?.telegram_id}
      </div>
    </div>
  );
}
