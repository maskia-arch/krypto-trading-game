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
      const currentlyMonday = day === 1;
      
      if (currentlyMonday !== isMonday) setIsMonday(currentlyMonday);

      if (currentlyMonday) {
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
  }, [isMonday]);

  return (
    <div className="flex flex-col w-full select-none">
      {/* Event Banner */}
      {isMonday && (
        <div className="bg-gradient-to-r from-neon-blue/20 via-neon-purple/30 to-neon-blue/20 py-1.5 border-b border-white/5 animate-pulse-slow shrink-0">
          <p className="text-[9px] text-center font-black tracking-[0.15em] text-white uppercase italic">
            🚀 Hebel-Montag: 10x Max-Hebel aktiv — noch {timeLeft} 🚀
          </p>
        </div>
      )}

      {/* Main Header Area */}
      <div className="px-4 py-3 bg-[#06080f]/40 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          
          {/* Left: Profile Trigger */}
          <div 
            className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform overflow-hidden"
            onClick={() => setTab('profile')}
          >
            <div className="w-10 h-10 rounded-full border-2 border-white/5 overflow-hidden bg-black/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">👤</span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight flex items-center whitespace-nowrap">
                ValueTradeGame
                <span className="text-[10px] font-mono font-medium text-[var(--text-dim)] ml-1.5 opacity-60">
                  {version ? `v${version}` : 'v...'}
                </span>
              </h1>
              <p className="text-[11px] text-[var(--text-dim)] font-medium truncate">
                {profile?.username || profile?.first_name || 'Trader'}
              </p>
            </div>
          </div>
          
          {/* Right: Balance Display */}
          <div className="text-right shrink-0">
            <p className={`text-base font-mono font-bold tabular-nums transition-all duration-500 ${
              balance >= 10000 
                ? 'text-neon-green glow-green' 
                : balance > 0 
                  ? 'text-white' 
                  : 'text-neon-red glow-red'
            }`}>
              {balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </p>
            <p className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-dim)] opacity-80">
              Kontostand
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
