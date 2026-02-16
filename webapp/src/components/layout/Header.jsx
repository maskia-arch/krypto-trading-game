import React from 'react';
import useStore from '../../lib/store';

export default function Header() {
  const { profile, version } = useStore();
  const balance = Number(profile?.balance || 0);

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="live-dot" />
          <div>
            <h1 className="text-sm font-bold tracking-tight">
              Krypto Game
              <span className="text-[10px] font-mono font-normal text-[var(--text-dim)] ml-1.5">
                v{version || '1.0'}
              </span>
            </h1>
            <p className="text-[11px] text-[var(--text-dim)]">
              {profile?.first_name || 'Trader'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-base font-mono font-bold ${
            balance >= 10000 
              ? 'text-neon-green glow-green' 
              : balance > 0 
                ? 'text-[var(--text-primary)]' 
                : 'text-neon-red glow-red'
          }`}>
            {balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€
          </p>
          <p className="text-[10px] text-[var(--text-dim)]">Kontostand</p>
        </div>
      </div>
    </div>
  );
}
