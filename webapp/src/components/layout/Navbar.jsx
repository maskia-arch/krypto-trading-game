import React from 'react';

export default function Navbar({ tabs, currentTab, onTabChange }) {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl border-t border-white/5 bg-gradient-to-t from-[#06080f] to-[#0a0c14]/90"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.8rem)' }}
    >
      <div className="flex justify-around items-end pt-2 px-2 pb-1 relative">
        {tabs.map(t => {
          const active = currentTab === t.id;
          return (
            <button 
              key={t.id} 
              onClick={() => onTabChange(t.id)}
              className="relative flex flex-col items-center justify-center p-2 group flex-1 transition-transform"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-neon-blue rounded-b-full shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
              )}
              
              {active && (
                <div className="absolute inset-0 bg-neon-blue/10 blur-xl rounded-full opacity-60 pointer-events-none" />
              )}
              
              <div className={`relative z-10 p-2 rounded-2xl transition-all duration-500 ${
                active ? 'bg-white/5 scale-110 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' : 'grayscale opacity-40 group-active:scale-90 group-hover:opacity-60'
              }`}>
                <span className="text-[22px] block drop-shadow-lg">
                  {t.icon}
                </span>
              </div>
              
              <span className={`text-[9px] z-10 mt-1 font-black uppercase tracking-[0.1em] transition-all duration-500 ${
                active ? 'text-neon-blue drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]' : 'text-[var(--text-dim)]'
              }`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
