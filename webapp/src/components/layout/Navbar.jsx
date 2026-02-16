import React from 'react';

export default function Navbar({ tabs, currentTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t pb-safe"
         style={{ 
           background: 'rgba(6,8,15,0.92)', 
           borderColor: 'rgba(255,255,255,0.06)',
           paddingBottom: 'max(env(safe-area-inset-bottom), 0.6rem)' 
         }}>
      <div className="flex justify-around items-center pt-2">
        {tabs.map(t => {
          const active = currentTab === t.id;
          return (
            <button 
              key={t.id} 
              onClick={() => onTabChange(t.id)}
              className="relative flex flex-col items-center px-4 py-1 group"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Aktiver Hintergrund-Glow */}
              {active && (
                <div className="absolute -inset-y-1 inset-x-2 bg-neon-blue/10 blur-md rounded-full animate-pulse" />
              )}
              
              <span className={`text-[22px] z-10 transition-all duration-300 ${
                active ? 'scale-110' : 'grayscale opacity-30 group-active:scale-90'
              }`}>
                {t.icon}
              </span>
              
              <span className={`text-[9px] z-10 mt-1 font-bold uppercase tracking-tighter transition-colors duration-300 ${
                active ? 'text-neon-blue' : 'text-[var(--text-dim)]'
              }`}>
                {t.label}
              </span>

              {/* Kleiner Indikator-Punkt */}
              <div className={`mt-1 h-1 w-1 rounded-full transition-all duration-300 ${
                active ? 'bg-neon-blue scale-100' : 'bg-transparent scale-0'
              }`} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
