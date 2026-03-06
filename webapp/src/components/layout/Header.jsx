import React, { useState, useEffect } from 'react';
import useStore from '../../lib/store';

export default function Header() {
  const { profile, version, setTab } = useStore();
  const balance = Number(profile?.balance || 0);
  const canSpin = useStore(s => s.canSpin);
  
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
        <div className="bg-gradient-to-r from-red-600/30 via-orange-500/30 to-red-600/30 py-1.5 border-b border-white/5 animate-pulse-slow shrink-0">
          <p className="text-[9px] text-center font-black tracking-[0.15em] text-white uppercase italic">
            🎰 Zocker-Montag: x20 & x50 Hebel für ALLE — noch {timeLeft} 🎰
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
          
          {/* Center: Glücksrad Button */}
          <button
            onClick={() => window.__setShowSpin && window.__setShowSpin(true)}
            className="relative shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-neon-gold/20 to-neon-gold/5 border border-neon-gold/30 flex items-center justify-center active:scale-90 transition-all shadow-[0_0_15px_rgba(251,191,36,0.1)] group"
            title="Glücksrad"
          >
            <span className="text-lg group-hover:animate-spin">🎰</span>
            {/* Notification dot - shows when spin is available */}
            {canSpin && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-neon-green border border-black animate-pulse shadow-[0_0_6px_rgba(34,214,138,0.6)]"></div>
            )}
          </button>

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
