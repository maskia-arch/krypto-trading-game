import React, { useState, useEffect } from 'react';
import useStore from '../../lib/store';

export default function Header() {
  const { profile, version, setTab } = useStore();
  const balance = Number(profile?.balance || 0);
  
  const [timeLeft, setTimeLeft] = useState('');
  const [isMonday, setIsMonday] = useState(false);

  useEffect(() => {
    const checkEvent = () => {
      const now = new Date();
      const day = now.getDay(); 
      setIsMonday(day === 1);

      if (day === 1) {
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const diff = midnight - now;

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };

    checkEvent();
    const timer = setInterval(checkEvent, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col">
      {isMonday && (
        <div className="bg-gradient-to-r from-neon-blue/20 via-neon-purple/30 to-neon-blue/20 py-1.5 border-b border-white/5 animate-pulse-slow">
          <p className="text-[9px] text-center font-black tracking-[0.15em] text-white uppercase italic">
            🚀 Hebel-Montag: 10x Max-Hebel aktiv — noch {timeLeft} 🚀
          </p>
        </div>
      )}

      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer active:opacity-70 transition-opacity"
            onClick={() => setTab('profile')}
          >
            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center shrink-0 shadow-lg">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">👤</span>
              )}
            </div>

            <div>
              <h1 className="text-sm font-bold tracking-tight flex items-center">
                ValueTradeGame
                <span className="text-[10px] font-mono font-normal text-[var(--text-dim)] ml-1.5">
                  {version ? `v${version}` : 'v1.0'}
                </span>
              </h1>
              <p className="text-[11px] text-[var(--text-dim)] font-medium">
                {profile?.username || profile?.first_name || 'Trader'}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className={`text-base font-mono font-bold transition-all duration-500 ${
              balance >= 10000 
                ? 'text-neon-green glow-green' 
                : balance > 0 
                  ? 'text-white' 
                  : 'text-neon-red glow-red'
            }`}>
              {balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
            </p>
            <p className="text-[10px] uppercase tracking-tighter font-semibold text-[var(--text-dim)]">
              Kontostand
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
