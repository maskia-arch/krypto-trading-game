import React from 'react';

export default function Navbar({ tabs, currentTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t bottom-safe"
         style={{ background: 'rgba(6,8,15,0.92)', borderColor: 'var(--border-dim)' }}>
      <div className="flex justify-around pt-1.5 pb-1">
        {tabs.map(t => {
          const active = currentTab === t.id;
          return (
            <button 
              key={t.id} 
              onClick={() => onTabChange(t.id)}
              className={`btn-press flex flex-col items-center px-4 py-1.5 rounded-xl transition-all ${
                active ? 'bg-white/[0.04]' : ''
              }`}
            >
              <span className={`text-[20px] transition-transform ${
                active ? 'scale-110' : 'grayscale opacity-40'
              }`}>
                {t.icon}
              </span>
              <span className={`text-[10px] mt-0.5 font-semibold tracking-wide ${
                active ? 'text-neon-blue' : 'text-[var(--text-dim)]'
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
