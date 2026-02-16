import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import useStore from '../lib/store';

export default function AssetsView() {
  const { profile, fetchProfile, showToast } = useStore();
  const [sub, setSub] = useState('realestate');
  const [reTypes, setReTypes] = useState([]);
  const [myRE, setMyRE] = useState([]);
  const [cTypes, setCTypes] = useState([]);
  const [myColl, setMyColl] = useState([]);
  const [loading, setLoading] = useState(true);

  const vol = Number(profile?.total_volume || 0);
  const bal = Number(profile?.balance || 0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        api.getRealEstateTypes(),
        api.getMyRealEstate(),
        api.getCollectibleTypes().catch(() => ({ types: [] })),
        api.getMyCollectibles().catch(() => ({ collectibles: [] })),
      ]);
      setReTypes(a.types || []); 
      setMyRE(b.properties || []);
      setCTypes(c.types || []); 
      setMyColl(d.collectibles || []);
    } catch (e) {
      console.error("Failed to load assets data", e);
    }
    setLoading(false);
  };

  const buyRE = async (id) => {
    try {
      const r = await api.buyRealEstate(id);
      showToast(`🏠 ${r.property} gekauft!`);
      await fetchProfile(); 
      await loadData();
    } catch (e) { 
      showToast(`❌ ${e.message}`, 'error'); 
    }
  };

  const collectRent = async () => {
    try {
      const r = await api.collectRent();
      r.rent_collected > 0
        ? showToast(`💰 ${r.rent_collected.toFixed(2)}€ Miete!`)
        : showToast('⏳ Noch keine Miete (24h)', 'error');
      if (r.rent_collected > 0) await fetchProfile();
    } catch (e) { 
      showToast(`❌ ${e.message}`, 'error'); 
    }
  };

  const buyColl = async (id) => {
    try {
      const r = await api.buyCollectible(id);
      showToast(`💎 ${r.item} gekauft!`);
      await fetchProfile(); 
      await loadData();
    } catch (e) { 
      showToast(`❌ ${e.message}`, 'error'); 
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="shimmer h-3 w-28 rounded" />
      </div>
    );
  }

  const totalRent = myRE.reduce((s, p) => s + Number(p.real_estate_types?.daily_rent || 0), 0);

  return (
    <div className="space-y-3 pb-4">
      {/* Tabs */}
      <div className="flex gap-1.5">
        {[
          { id: 'realestate', label: '🏠 Immobilien', c: 'neon-blue' },
          { id: 'collectibles', label: '💎 Besitztümer', c: 'neon-purple' },
        ].map(t => {
          const act = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)}
              className="btn-press flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: act ? `var(--${t.c})10` : 'var(--bg-card)',
                border: `1px solid ${act ? `var(--${t.c})25` : 'var(--border-dim)'}`,
                color: act ? `var(--${t.c})` : 'var(--text-dim)',
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Stats Board */}
      <div className="card p-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-dim)]">Umsatz</p>
            <p className="text-sm font-mono font-bold">{vol.toLocaleString('de-DE')}€</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-dim)]">Guthaben</p>
            <p className="text-sm font-mono font-bold text-neon-green">{bal.toLocaleString('de-DE')}€</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-dim)]">Miete/Tag</p>
            <p className="text-sm font-mono font-bold text-neon-gold">+{totalRent.toLocaleString('de-DE')}€</p>
          </div>
        </div>
      </div>

      {sub === 'realestate' ? (
        <>
          {/* Portfolio */}
          {myRE.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)]">Meine Immobilien ({myRE.length})</p>
                <button onClick={collectRent}
                  className="btn-press px-3 py-1.5 rounded-lg text-[10px] font-bold bg-neon-green/10 text-neon-green border border-neon-green/20">
                  💰 Miete einsammeln
                </button>
              </div>
              {myRE.map(p => (
                <div key={p.id} className="card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.real_estate_types?.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold">{p.real_estate_types?.name}</p>
                      <p className="text-[10px] text-neon-green font-mono">+{Number(p.real_estate_types?.daily_rent)}€ / Tag</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Shop */}
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)] px-1 pt-2">Immobilien-Shop</p>
          <div className="space-y-2">
            {reTypes.map(t => {
              const minVol = Number(t.min_volume || 0);
              const price = Number(t.price_eur || 0);
              const isLocked = vol < minVol;
              const canAfford = bal >= price;

              return (
                <div key={t.id} className={`card p-4 flex items-center justify-between transition-opacity ${isLocked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{isLocked ? '🔒' : t.emoji}</span>
                    <div>
                      <p className="text-sm font-bold">{t.name}</p>
                      <p className="text-[11px] font-mono text-neon-blue">{price.toLocaleString('de-DE')}€</p>
                      {isLocked ? (
                        <p className="text-[9px] text-neon-gold font-bold mt-1 uppercase">Benötigt {minVol.toLocaleString('de-DE')}€ Umsatz</p>
                      ) : (
                        <p className="text-[10px] text-neon-green font-mono">+{Number(t.daily_rent)}€ / Tag</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => buyRE(t.id)} 
                    disabled={isLocked || !canAfford}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all btn-press ${
                      isLocked ? 'bg-white/5 text-[var(--text-dim)]' : 
                      canAfford ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30' : 
                      'bg-neon-red/10 text-neon-red opacity-60'
                    }`}
                  >
                    {isLocked ? 'Gesperrt' : canAfford ? 'Kaufen' : '💸'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Collectibles Portfolio & Shop ähnlich aufgebaut... */}
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)] px-1 pt-2">Besitztümer-Shop</p>
          <div className="space-y-2">
            {cTypes.map(t => {
              const minVol = Number(t.min_volume || 0);
              const price = Number(t.price_eur || 0);
              const isLocked = vol < minVol;
              const canAfford = bal >= price;

              return (
                <div key={t.id} className={`card p-4 flex items-center justify-between transition-opacity ${isLocked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{isLocked ? '🔒' : t.emoji}</span>
                    <div>
                      <p className="text-sm font-bold">{t.name}</p>
                      <p className="text-[11px] font-mono text-neon-purple">{price.toLocaleString('de-DE')}€</p>
                      {isLocked ? (
                        <p className="text-[9px] text-neon-gold font-bold mt-1 uppercase">Benötigt {minVol.toLocaleString('de-DE')}€ Umsatz</p>
                      ) : (
                        <p className="text-[10px] text-[var(--text-dim)]">⏱ {t.min_hold_h}h Haltedauer</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => buyColl(t.id)} 
                    disabled={isLocked || !canAfford}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all btn-press ${
                      isLocked ? 'bg-white/5 text-[var(--text-dim)]' : 
                      canAfford ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' : 
                      'bg-neon-red/10 text-neon-red opacity-60'
                    }`}
                  >
                    {isLocked ? 'Gesperrt' : canAfford ? 'Kaufen' : '💸'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
