import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import useStore from '../../lib/store';

export default function CopyTraderModal({ targetUserId, targetUsername, onClose }) {
  const { profile, showToast, fetchProfile, isPremiumUser } = useStore();
  const [budget, setBudget] = useState('');
  const [duration, setDuration] = useState(24);
  const [loading, setLoading] = useState(false);
  const [canCopy, setCanCopy] = useState(null);
  const isPro = isPremiumUser();

  useEffect(() => {
    checkCanCopy();
  }, []);

  const checkCanCopy = async () => {
    try {
      const data = await api.getCopyCanCopy();
      setCanCopy(data);
    } catch (err) {
      console.error('Can-copy check error:', err);
    }
  };

  const handleSubmit = async () => {
    const budgetNum = Number(budget);
    if (!budgetNum || budgetNum < 100) {
      showToast('Mindestbudget: 100€', 'error');
      return;
    }
    if (budgetNum > Number(profile.balance)) {
      showToast('Nicht genügend Guthaben', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.copySubscribe(targetUserId, budgetNum, duration);
      showToast(`📋 Du kopierst jetzt ${targetUsername}!`, 'success');
      await fetchProfile();
      onClose();
    } catch (err) {
      showToast(err.message || 'Fehler beim Kopieren', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fee = budget ? (Number(budget) * 0.01).toFixed(2) : '0.00';
  const netBudget = budget ? (Number(budget) * 0.99).toFixed(2) : '0.00';

  if (canCopy === null) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-sm card p-5 space-y-4 tab-enter border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white">📋 Trader Kopieren</h3>
            <p className="text-[10px] text-neon-blue font-bold mt-0.5">{targetUsername || 'Trader'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Can't copy warning for Free Users */}
        {!canCopy.can_copy && !canCopy.is_pro && (
          <div className="p-3 rounded-xl bg-neon-red/10 border border-neon-red/20 text-center">
            <p className="text-xs font-bold text-neon-red">⏳ 30-Tage Cooldown aktiv</p>
            <p className="text-[10px] text-[var(--text-dim)] mt-1">
              Als Free User darfst du nur einmal in 30 Tagen Copy Trading nutzen. Upgrade auf Pro für unbegrenztes Copy Trading!
            </p>
          </div>
        )}

        {(canCopy.can_copy || canCopy.is_pro) && (
          <>
            {/* Info */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--text-dim)]">Dein Kontostand</span>
                <span className="text-white font-bold">{Number(profile.balance).toLocaleString('de-DE')}€</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--text-dim)]">Kopier-Gebühr</span>
                <span className="text-neon-gold font-bold">1% einmalig</span>
              </div>
            </div>

            {/* Budget Input */}
            <div>
              <label className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest block mb-1.5">
                Budget (EUR)
              </label>
              <input
                type="number"
                min="100"
                step="50"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Min. 100€"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono placeholder-white/20 focus:border-neon-blue/30"
              />
              {budget && Number(budget) >= 100 && (
                <div className="mt-1.5 flex justify-between text-[9px] text-[var(--text-dim)]">
                  <span>Gebühr: {fee}€ → an {targetUsername}</span>
                  <span>Handelsbudget: {netBudget}€</span>
                </div>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest block mb-1.5">
                Dauer
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(isPro ? [24, 72, 168, 720] : [24]).map(h => (
                  <button
                    key={h}
                    onClick={() => setDuration(h)}
                    className={`py-2 rounded-lg text-[10px] font-bold transition-all ${
                      duration === h
                        ? 'bg-neon-blue/20 border border-neon-blue/30 text-neon-blue'
                        : 'bg-white/5 border border-white/5 text-[var(--text-dim)]'
                    }`}
                  >
                    {h < 48 ? `${h}h` : h < 168 ? `${Math.round(h/24)}T` : h === 168 ? '1W' : '1M'}
                  </button>
                ))}
              </div>
              {!isPro && (
                <p className="text-[9px] text-neon-gold mt-1.5">
                  ⭐ Pro: Bis zu 30 Tage Copy Trading möglich
                </p>
              )}
            </div>

            {/* Summary */}
            {budget && Number(budget) >= 100 && (
              <div className="p-3 rounded-xl bg-neon-blue/5 border border-neon-blue/10 space-y-1">
                <p className="text-[10px] font-bold text-neon-blue">Zusammenfassung</p>
                <p className="text-[10px] text-[var(--text-dim)]">
                  Du investierst <b className="text-white">{Number(budget).toLocaleString('de-DE')}€</b> um die Trades von {targetUsername} für <b className="text-white">{duration}h</b> zu kopieren.
                  Alle Spot-Trades werden proportional mit deinem Budget nachgemacht.
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !budget || Number(budget) < 100}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                loading || !budget || Number(budget) < 100
                  ? 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border border-cyan-400/30 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
              }`}
            >
              {loading ? '⏳ Wird gestartet...' : '📋 Trader kopieren'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
