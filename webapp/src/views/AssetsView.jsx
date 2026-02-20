import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import useStore from '../lib/store';

export default function AssetsView() {
  const { profile, fetchProfile, showToast } = useStore();
  const [sub, setSub] = useState('collectibles');
  
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
      showToast(`💎 Gekauft! 5% Steuer wandern in den Pool.`);
      await fetchProfile(); 
      await loadData();
    } catch (e) { 
      showToast(`❌ ${e.message}`, 'error'); 
    }
  };

  const sellColl = async (userCollectibleId) => {
    if (!window.confirm("Bist du sicher? Du erhältst 95% des Kaufpreises zurück.")) return;
    try {
      const r = await api.sellCollectible(userCollectibleId);
      showToast(`💰 Verkauft für ${Number(r.received).toLocaleString('de-DE')}€`);
      await fetchProfile();
      await loadData();
    } catch (e) {
      showToast(`❌ ${e.message}`, 'error');
    }
  };

  const totalRent = myRE.reduce((s, p) => s + Number(p.real_estate_types?.daily_rent || 0), 0);

  return (
    <div className="space-y-4 pb-6 tab-enter">
      
      <div className="flex bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-inner">
        <button
          onClick={() => setSub('collectibles')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl transition-all duration-300 ${
            sub === 'collectibles' 
              ? 'bg-neon-purple/20 text-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-neon-purple/30' 
              : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
          }`}
        >
          💎 Besitztümer
        </button>
        <button
          onClick={() => setSub('realestate')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl transition-all duration-300 ${
            sub === 'realestate' 
              ? 'bg-neon-blue/20 text-neon-blue shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-neon-blue/30' 
              : 'text-[var(--text-dim)] hover:text-white/80 border border-transparent'
          }`}
        >
          🏠 Immobilien
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4 mt-4">
          <div className="shimmer h-20 w-full rounded-2xl border border-white/5" />
          <div className="shimmer h-28 w-full rounded-2xl border border-white/5" />
          <div className="shimmer h-28 w-full rounded-2xl border border-white/5" />
        </div>
      ) : (
        <>
          <div className="card p-4 border border-white/5 bg-gradient-to-br from-[#0a0c14] to-black/60 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-green/10 rounded-full blur-[60px] pointer-events-none transition-all duration-500"></div>
            
            <div className="grid grid-cols-3 gap-3 text-center relative z-10">
              <div className="bg-white/[0.02] rounded-xl p-2 border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors">
                <p className="text-[8px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Umsatz</p>
                <p className="text-[13px] font-mono font-black text-white mt-1">{vol.toLocaleString('de-DE')}€</p>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-2 border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors">
                <p className="text-[8px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Guthaben</p>
                <p className="text-[13px] font-mono font-black text-neon-green mt-1 drop-shadow-sm">{bal.toLocaleString('de-DE')}€</p>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-2 border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors">
                <p className="text-[8px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Miete/Tag</p>
                <p className="text-[13px] font-mono font-black text-neon-gold mt-1 drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]">+{totalRent.toLocaleString('de-DE')}€</p>
              </div>
            </div>
          </div>

          {sub === 'realestate' ? (
            <div className="space-y-4 tab-enter">
              {myRE.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1 pt-1 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                      <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Meine Immobilien ({myRE.length})</p>
                    </div>
                    <button onClick={collectRent}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20 active:scale-95 transition-all shadow-[0_0_10px_rgba(34,214,138,0.1)]">
                      💰 Miete abholen
                    </button>
                  </div>
                  {myRE.map(p => (
                    <div key={p.id} className="card p-3 flex items-center justify-between border border-white/5 bg-white/[0.02] backdrop-blur-sm relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-blue shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                      <div className="absolute inset-0 bg-neon-blue/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      
                      <div className="flex items-center gap-4 pl-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-2xl shadow-inner">
                          {p.real_estate_types?.emoji}
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-white tracking-tight">{p.real_estate_types?.name}</p>
                          <p className="text-[10px] text-neon-green font-mono font-bold mt-0.5 drop-shadow-sm">+{Number(p.real_estate_types?.daily_rent).toLocaleString('de-DE')}€ / Tag</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)] px-1 pt-3">Immobilien Markt</p>
              <div className="grid grid-cols-1 gap-3">
                {reTypes.map(t => {
                  const minVol = Number(t.min_volume || 0);
                  const price = Number(t.price_eur || 0);
                  const isLocked = vol < minVol;
                  const canAfford = bal >= price;

                  return (
                    <div key={t.id} className={`card p-4 flex items-center justify-between transition-all border border-white/5 ${isLocked ? 'bg-black/20 opacity-70 grayscale-[50%]' : 'bg-gradient-to-br from-[#0a0c14] to-black/40 hover:border-white/10'}`}>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${isLocked ? 'bg-black/40' : 'bg-neon-blue/10 border border-neon-blue/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'}`}>
                            {t.emoji || '🏢'}
                          </div>
                          {isLocked && <div className="absolute -bottom-1 -right-1 bg-black border border-white/10 rounded-full p-1 text-xs shadow-lg">🔒</div>}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[14px] font-black text-white tracking-tight leading-none mb-1.5">{t.name}</p>
                          <p className={`text-[12px] font-mono font-black ${isLocked ? 'text-[var(--text-dim)]' : 'text-neon-blue drop-shadow-sm'}`}>
                            {price.toLocaleString('de-DE')}€
                          </p>
                          {isLocked ? (
                            <p className="text-[9px] text-neon-red font-black mt-1.5 uppercase tracking-widest bg-neon-red/10 px-1.5 py-0.5 rounded inline-block w-fit">
                              AB {minVol.toLocaleString('de-DE')}€ UMSATZ
                            </p>
                          ) : (
                            <p className="text-[10px] text-neon-green font-mono font-bold mt-1.5">+ {Number(t.daily_rent).toLocaleString('de-DE')}€ / Tag</p>
                          )}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => buyRE(t.id)} 
                        disabled={isLocked || !canAfford}
                        className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm h-fit ${
                          isLocked 
                            ? 'bg-white/5 text-white/20 border border-transparent' 
                            : canAfford 
                              ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:bg-neon-blue/20 active:scale-95' 
                              : 'bg-white/5 text-[var(--text-dim)] border border-white/10 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        {isLocked ? 'Gesperrt' : canAfford ? 'Kaufen' : 'Zu teuer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 tab-enter">
              <div className="bg-gradient-to-r from-neon-gold/10 to-transparent border border-neon-gold/20 p-4 rounded-2xl relative overflow-hidden shadow-[0_4px_20px_rgba(251,191,36,0.05)]">
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-neon-gold/5 blur-2xl"></div>
                <div className="relative z-10 flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="text-[10px] text-neon-gold font-black uppercase tracking-widest drop-shadow-sm">
                      Wertsicherung & Luxussteuer
                    </p>
                    <p className="text-[10px] text-white/70 mt-1 leading-relaxed font-medium">
                      Beim Kauf fallen 5% Luxussteuer an (wandert in den Season-Pool). Bei einem Verkauf erhältst du garantierte 95% des Kaufwerts zurück.
                    </p>
                  </div>
                </div>
              </div>

              {myColl.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1 pt-1 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)]">Meine Sammlung ({myColl.length})</p>
                  </div>
                  {myColl.map(p => {
                    const refund = Number(p.purchase_price || p.collectibles?.price || 0) * 0.95;
                    return (
                      <div key={p.id} className="card p-3 flex items-center justify-between border border-white/5 bg-white/[0.02] backdrop-blur-sm relative overflow-hidden group hover:border-neon-purple/30 transition-colors">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                        <div className="absolute inset-0 bg-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        
                        <div className="flex items-center gap-4 pl-3 relative z-10">
                          <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-2xl shadow-inner">
                            {p.collectibles?.icon || '💎'}
                          </div>
                          <div>
                            <p className="text-[13px] font-black text-white tracking-tight">{p.collectibles?.name}</p>
                            <p className="text-[10px] text-[var(--text-dim)] font-mono font-bold mt-0.5">Wert: <span className="text-white/80">{refund.toLocaleString('de-DE')}€</span></p>
                          </div>
                        </div>
                        <button 
                          onClick={() => sellColl(p.id)}
                          className="relative z-10 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl text-[var(--text-dim)] hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all"
                        >
                          Verkaufen
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <p className="text-[10px] uppercase tracking-[0.15em] font-black text-[var(--text-dim)] px-1 pt-3">Besitztümer Markt</p>
              <div className="grid grid-cols-1 gap-3">
                {cTypes.map(t => {
                  const minVol = Number(t.min_volume || 0);
                  const price = Number(t.price || 0);
                  const isLocked = vol < minVol;
                  const canAfford = bal >= price;

                  return (
                    <div key={t.id} className={`card p-4 flex items-center justify-between transition-all border border-white/5 ${isLocked ? 'bg-black/20 opacity-70 grayscale-[50%]' : 'bg-gradient-to-br from-[#0a0c14] to-black/40 hover:border-white/10'}`}>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${isLocked ? 'bg-black/40' : 'bg-neon-purple/10 border border-neon-purple/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]'}`}>
                            {t.icon || '💎'}
                          </div>
                          {isLocked && <div className="absolute -bottom-1 -right-1 bg-black border border-white/10 rounded-full p-1 text-xs shadow-lg">🔒</div>}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[14px] font-black text-white tracking-tight leading-none mb-1.5">{t.name}</p>
                          <p className={`text-[12px] font-mono font-black ${isLocked ? 'text-[var(--text-dim)]' : 'text-neon-purple drop-shadow-sm'}`}>
                            {price.toLocaleString('de-DE')}€
                          </p>
                          {isLocked ? (
                            <p className="text-[9px] text-neon-red font-black mt-1.5 uppercase tracking-widest bg-neon-red/10 px-1.5 py-0.5 rounded inline-block w-fit">
                              AB {minVol.toLocaleString('de-DE')}€ UMSATZ
                            </p>
                          ) : (
                            <p className="text-[10px] text-[var(--text-dim)] font-bold mt-1.5 uppercase tracking-wider">Luxussteuer: 5%</p>
                          )}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => buyColl(t.id)} 
                        disabled={isLocked || !canAfford}
                        className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm h-fit ${
                          isLocked 
                            ? 'bg-white/5 text-white/20 border border-transparent' 
                            : canAfford 
                              ? 'bg-neon-purple/10 text-neon-purple border border-neon-purple/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:bg-neon-purple/20 active:scale-95' 
                              : 'bg-white/5 text-[var(--text-dim)] border border-white/10 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        {isLocked ? 'Gesperrt' : canAfford ? 'Kaufen' : 'Zu teuer'}
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
