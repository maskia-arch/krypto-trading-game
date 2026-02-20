import React, { useEffect, useRef } from 'react';

const COIN_META = {
  BTC: { emoji: '₿', name: 'Bitcoin', color: '#f7931a' },
  ETH: { emoji: 'Ξ', name: 'Ethereum', color: '#627eea' },
  LTC: { emoji: 'Ł', name: 'Litecoin', color: '#bfbbbb' },
};

export default function PriceTicker({ symbol, price, prevPrice }) {
  const ref = useRef(null);
  const lastPrice = useRef(price);

  useEffect(() => {
    if (!ref.current || price === undefined || price === lastPrice.current) return;
    
    const isUp = price > lastPrice.current;
    
    ref.current.classList.remove('tick-up', 'tick-down', 'glow-green', 'glow-red');
    
    void ref.current.offsetWidth; 

    if (isUp) {
      ref.current.classList.add('tick-up', 'glow-green');
    } else {
      ref.current.classList.add('tick-down', 'glow-red');
    }
    
    lastPrice.current = price;
    
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.classList.remove('tick-up', 'tick-down', 'glow-green', 'glow-red');
      }
    }, 800);
    
    return () => clearTimeout(t);
  }, [price]);

  const displayPrice = price || 0;
  const meta = COIN_META[symbol] || { emoji: '🪙', name: symbol, color: 'var(--text-dim)' };

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 ml-2 first:ml-4 last:mr-4"
         style={{ 
           background: 'rgba(255,255,255,0.03)', 
           border: '1px solid rgba(255,255,255,0.06)',
           backdropFilter: 'blur(4px)'
         }}>
      
      <span className="text-[11px] leading-none" style={{ color: meta.color }}>
        {meta.emoji}
      </span>
      
      <div className="flex flex-col">
        <span className="text-[8px] font-bold uppercase tracking-tighter opacity-30 leading-tight">
          {symbol}
        </span>
        <span 
          ref={ref} 
          className="text-[11px] font-mono font-bold transition-colors duration-300"
          style={{ letterSpacing: '-0.02em' }}
        >
          {displayPrice.toLocaleString('de-DE', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}€
        </span>
      </div>
    </div>
  );
}
