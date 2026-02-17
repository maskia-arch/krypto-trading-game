import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import useStore from '../lib/store';
import TradeView from './TradeView';

export default function AssetsView() {
  const { profile, fetchProfile, showToast } = useStore();
  const [sub, setSub] = useState('wallet');
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
      console.error(e);
    }
    setLoading(false);
  };

  const buyRE = async (id) => {
    try {
      const r = await api.buyRealEstate(id);
      showToast(`🏠 ${r.property || 'Immobilie'} gekauft!`);
      await fetchProfile(); 
      await loadData();
    } catch (e) { 
      showToast(`❌ ${e.message}`, 'error'); 
    }
  };

  const collectRent = async () => {
    try {
      const r = await api.collectRent();
      if (r && r.rent_collected > 0) {
        showToast(`💰 ${r.rent_collected.toFixed(2)}€ Miete!`);
        await fetchProfile();
      } else {
        showToast('⏳ Noch keine Miete (24h Zyklus)', 'error');
      }
    } catch (e) { 
      showToast(`❌ ${e.message}`, 'error'); 
    }
  };

  const buyColl = async (id) => {
    try {
      const r = await api.buyCollectible(id);
      showToast(`💎 ${r.item || 'Item'} gekauft!`);
      await fetchProfile(); 
      await loadData();
    } catch (e) { 
      showToast(`❌ ${e.message}`, 'error'); 
    }
  };

  const totalRent = myRE.reduce((s, p) => s + Number(p.real_estate_types?.daily_rent || 0), 0);

  return (
    <div className="space-y-3 pb-4 tab-enter">
      <div className="flex gap-1.5">
        {[
          { id: 'wallet', label: '💳 Wallet', color: 'text-neon-gold', bg: 'bg-neon-gold/10', border: 'border-neon-gold/25' },
          { id: 'realestate', label: '🏠 Immobilien', color: 'text-neon-blue', bg: 'bg-neon-blue/10', border: 'border-neon-blue/25' },
          { id: 'collectibles', label: '💎 Besitztümer', color: 'text-neon-purple', bg: 'bg-neon-purple/10', border: 'border-neon-purple/25' },
        ].map(t => {
          const act = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)}
              className={`btn-press flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                act ? `${t.bg} ${t.color} ${t.border}` : 'bg-[var(--bg-card)] text-[var(--text-dim)] border-[var(--border-dim)]'
              }`}>
              {t.label}
            </button>
          );
        })}
      </div>

      {sub === 'wallet' ? (
        <div className="mt-2">
          <TradeView />
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-3 mt-4">
          <div className="shimmer h-16 w-full rounded-xl" />
          <div className="shimmer h-24 w-full rounded-xl" />
          <div className="shimmer h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="card p-3 ring-1 ring-white/5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-dim)]">Umsatz</p>
                <p className="text-sm font-mono font-bold text-white">{vol.toLocaleString('de-DE')}€</p>
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
            <div className="space-y-3">
              {myRE.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 pt-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)]">Meine Immobilien ({myRE.length})</p>
                    <button onClick={collectRent}
                      className="btn-press px-3 py-1.5 rounded-lg text-[10px] font-bold bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20">
                      💰 Miete einsammeln
                    </button>
                  </div>
                  {myRE.map(p => (
                    <div key={p.id} className="card p-3 flex items-center justify-between border-l-2 border-neon-blue bg-gradient-to-r from-neon-blue/5 to-transparent">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl drop-shadow-md">{p.real_estate_types?.emoji}</span>
                        <div>
                          <p className="text-sm font-bold text-white">{p.real_estate_types?.name}</p>
                          <p className="text-[10px] text-neon-green font-mono font-semibold">+{Number(p.real_estate_types?.daily_rent).toLocaleString('de-DE')}€ / Tag</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)] px-1 pt-2">Immobilien-Shop</p>
              <div className="space-y-2">
                {reTypes.map(t => {
                  const minVol = Number(t.min_volume || 0);
                  const price = Number(t.price_eur || 0);
                  const isLocked = vol < minVol;
                  const canAfford = bal >= price;

                  return (
                    <div key={t.id} className={`card p-4 flex items-center justify-between transition-all ${isLocked ? 'opacity-60 grayscale-[30%]' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="text-3xl drop-shadow-md">{t.emoji || '🏢'}</span>
                          {isLocked && <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 text-xs">🔒</div>}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{t.name}</p>
                          <p className={`text-[11px] font-mono font-bold ${isLocked ? 'text-[var(--text-dim)]' : 'text-neon-blue'}`}>
                            {price.toLocaleString('de-DE')}€
                          </p>
                          {isLocked ? (
                            <p className="text-[9px] text-neon-gold font-bold mt-1 uppercase tracking-wide">
                              BENÖTIGT {minVol.toLocaleString('de-DE')}€ UMSATZ
                            </p>
                          ) : (
                            <p className="text-[10px] text-neon-green font-mono font-medium">+{Number(t.daily_rent).toLocaleString('de-DE')}€ / Tag</p>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => buyRE(t.id)} 
                        disabled={isLocked || !canAfford}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all btn-press shadow-sm ${
                          isLocked ? 'bg-white/5 text-[var(--text-dim)]' : 
                          canAfford ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30 shadow-neon-blue/20' : 
                          'bg-neon-red/10 text-neon-red opacity-60 border border-neon-red/20'
                        }`}
                      >
                        {isLocked ? 'Gesperrt' : canAfford ? 'Kaufen' : '💸 Zu teuer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {myColl.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)] px-1 pt-1">Meine Sammlung ({myColl.length})</p>
                  {myColl.map(p => (
                    <div key={p.id} className="card p-3 flex items-center justify-between border-l-2 border-neon-purple bg-gradient-to-r from-neon-purple/5 to-transparent">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl drop-shadow-md">{p.collectible_types?.emoji}</span>
                        <div>
                          <p className="text-sm font-bold text-white">{p.collectible_types?.name}</p>
                          <p className="text-[10px] text-[var(--text-dim)] font-mono">Gekauft am {new Date(p.purchased_at || p.created_at).toLocaleDateString('de-DE')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)] px-1 pt-2">Besitztümer-Shop</p>
              <div className="space-y-2">
                {cTypes.map(t => {
                  const minVol = Number(t.min_volume || 0);
                  const price = Number(t.price_eur || 0);
                  const isLocked = vol < minVol;
                  const canAfford = bal >= price;

                  return (
                    <div key={t.id} className={`card p-4 flex items-center justify-between transition-all ${isLocked ? 'opacity-60 grayscale-[30%]' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="text-3xl drop-shadow-md">{t.emoji || '💎'}</span>
                          {isLocked && <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 text-xs">🔒</div>}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{t.name}</p>
                          <p className={`text-[11px] font-mono font-bold ${isLocked ? 'text-[var(--text-dim)]' : 'text-neon-purple'}`}>
                            {price.toLocaleString('de-DE')}€
                          </p>
                          {isLocked ? (
                            <p className="text-[9px] text-neon-gold font-bold mt-1 uppercase tracking-wide">
                              BENÖTIGT {minVol.toLocaleString('de-DE')}€ UMSATZ
                            </p>
                          ) : (
                            <p className="text-[10px] text-[var(--text-dim)] font-medium">⏱ {t.min_hold_h}h Haltedauer</p>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => buyColl(t.id)} 
                        disabled={isLocked || !canAfford}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all btn-press shadow-sm ${
                          isLocked ? 'bg-white/5 text-[var(--text-dim)]' : 
                          canAfford ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30 shadow-neon-purple/20' : 
                          'bg-neon-red/10 text-neon-red opacity-60 border border-neon-red/20'
                        }`}
                      >
                        {isLocked ? 'Gesperrt' : canAfford ? 'Kaufen' : '💸 Zu teuer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
