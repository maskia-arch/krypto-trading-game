import React, { useEffect, useState } from 'react';
import client from '../api/client';
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
      // Wenn die Endpunkte für Collectibles in deinem Backend existieren,
      // müssen die URLs hier ggf. angepasst werden.
      const [a, b, c, d] = await Promise.all([
        client.get('/api/economy/realestate/types'),
        client.get('/api/economy/realestate/mine'),
        client.get('/api/economy/collectibles/types').catch(() => ({ data: { types: [] } })),
        client.get('/api/economy/collectibles/mine').catch(() => ({ data: { collectibles: [] } })),
      ]);
      setReTypes(a.data.types || []); 
      setMyRE(b.data.properties || []);
      setCTypes(c.data.types || []); 
      setMyColl(d.data.collectibles || []);
    } catch (e) {
      console.error("Failed to load assets data", e);
    }
    setLoading(false);
  };

  const buyRE = async (id) => {
    try {
      const r = await client.post('/api/economy/realestate/buy', { type_id: id });
      showToast(`🏠 ${r.data.property} gekauft!`);
      await fetchProfile(); 
      await loadData();
    } catch (e) { 
      showToast(`❌ ${e.response?.data?.error || e.message}`, 'error'); 
    }
  };

  const collectRent = async () => {
    try {
      const r = await client.post('/api/profile/collect-rent');
      r.data.rent_collected > 0
        ? showToast(`💰 ${r.data.rent_collected.toFixed(2)}€ Miete!`)
        : showToast('⏳ Noch keine Miete (24h)', 'error');
      if (r.data.rent_collected > 0) await fetchProfile();
    } catch (e) { 
      showToast(`❌ ${e.response?.data?.error || e.message}`, 'error'); 
    }
  };

  const buyColl = async (id) => {
    try {
      const r = await client.post('/api/economy/collectibles/buy', { type_id: id });
      showToast(`💎 ${r.data.item} gekauft!`);
      await fetchProfile(); 
      await loadData();
    } catch (e) { 
      showToast(`❌ ${e.response?.data?.error || e.message}`, 'error'); 
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

      <div className="card p-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>Umsatz</p>
            <p className="text-sm font-mono font-bold">{vol.toLocaleString('de-DE')}€</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>Guthaben</p>
            <p className="text-sm font-mono font-bold text-neon-green">{bal.toLocaleString('de-DE')}€</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>Miete/Tag</p>
            <p className="text-sm font-mono font-bold text-neon-gold">{totalRent}€</p>
          </div>
        </div>
      </div>

      {sub === 'realestate' ? (
        <>
          {myRE.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>
                  Meine Immobilien ({myRE.length})
                </p>
                <button onClick={collectRent}
                  className="btn-press px-3 py-1.5 rounded-lg text-[10px] font-bold bg-neon-green/10 text-neon-green border border-neon-green/20">
                  💰 Miete einsammeln
                </button>
              </div>
              {myRE.map(p => (
                <div key={p.id} className="card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{p.real_estate_types?.emoji || '🏠'}</span>
                    <div>
                      <p className="text-sm font-semibold">{p.real_estate_types?.name}</p>
                      <p className="text-[10px] text-neon-green font-mono">+{Number(p.real_estate_types?.daily_rent).toFixed(0)}€/Tag</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] uppercase tracking-wider font-semibold px-1 pt-1" style={{ color: 'var(--text-dim)' }}>
            Immobilien-Shop
          </p>
          <div className="space-y-2">
            {reTypes.map(t => {
              const locked = vol < Number(t.min_volume);
              const canBuy = !locked && bal >= Number(t.price_eur);
              return (
                <div key={t.id} className={`card p-4 flex items-center justify-between ${locked ? 'opacity-45' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{t.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        {Number(t.price_eur).toLocaleString('de-DE')}€
                      </p>
                      <p className="text-[10px] text-neon-green font-mono">+{Number(t.daily_rent)}€/Tag</p>
                      {locked && (
                        <p className="text-[10px] text-neon-gold mt-0.5">🔒 {Number(t.min_volume).toLocaleString('de-DE')}€ Umsatz</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => buyRE(t.id)} disabled={!canBuy}
                    className={`btn-press px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      canBuy ? 'bg-neon-blue/15 text-neon-blue border border-neon-blue/20' : 'bg-white/[0.02] text-[var(--text-dim)] cursor-not-allowed'
                    }`}>
                    {locked ? '🔒' : canBuy ? 'Kaufen' : '💸'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {myColl.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold px-1 mb-2" style={{ color: 'var(--text-dim)' }}>
                Meine Sammlung ({myColl.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {myColl.map(c => (
                  <div key={c.id} className="card p-3 text-center">
                    <span className="text-3xl">{c.collectible_types?.emoji || '💎'}</span>
                    <p className="text-[10px] font-bold mt-1">{c.collectible_types?.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] uppercase tracking-wider font-semibold px-1 pt-1" style={{ color: 'var(--text-dim)' }}>
            Besitztümer-Shop
          </p>
          <div className="space-y-2">
            {cTypes.map(t => {
              const locked = vol < Number(t.min_volume);
              const canBuy = !locked && bal >= Number(t.price_eur);
              return (
                <div key={t.id} className={`card p-4 flex items-center justify-between ${locked ? 'opacity-45' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{t.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        {Number(t.price_eur).toLocaleString('de-DE')}€
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        ⏱ Min. {t.min_hold_h}h Haltedauer
                      </p>
                      {locked && (
                        <p className="text-[10px] text-neon-gold mt-0.5">🔒 {Number(t.min_volume).toLocaleString('de-DE')}€ Umsatz</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => buyColl(t.id)} disabled={!canBuy}
                    className={`btn-press px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      canBuy ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/20' : 'bg-white/[0.02] text-[var(--text-dim)] cursor-not-allowed'
                    }`}>
                    {locked ? '🔒' : canBuy ? 'Kaufen' : '💸'}
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
