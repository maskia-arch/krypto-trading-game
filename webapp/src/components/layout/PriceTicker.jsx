import React, { useEffect, useRef, useState } from 'react';

const COIN_META = {
  BTC: { emoji: '₿', name: 'Bitcoin', color: '#F7931A' },
  ETH: { emoji: 'Ξ', name: 'Ethereum', color: '#627EEA' },
  LTC: { emoji: 'Ł', name: 'Litecoin', color: '#BFBBBB' },
};

export default function PriceTicker({ symbol, price, prevPrice }) {
  const priceRef = useRef(price);
  const [flashStatus, setFlashStatus] = useState(null);

  useEffect(() => {
    if (!price || price === priceRef.current) return;
    
    const isUp = price > priceRef.current;
    setFlashStatus(isUp ? 'up' : 'down');
    priceRef.current = price;
    
    const timer = setTimeout(() => setFlashStatus(null), 800);
    return () => clearTimeout(timer);
  }, [price]);

  const displayPrice = price || 0;
  const meta = COIN_META[symbol] || { emoji: '🪙', name: symbol, color: '#ffffff' };
  
  const diff = price - prevPrice;
  const isPositive = diff >= 0;

  return (
    <div 
      className={`group flex-shrink-0 flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-500 ml-2 first:ml-4 last:mr-4 border relative overflow-hidden ${
        flashStatus === 'up' 
          ? 'bg-neon-green/10 border-neon-green/50 shadow-[0_0_15px_rgba(34,214,138,0.2)]' 
          : flashStatus === 'down' 
            ? 'bg-neon-red/10 border-neon-red/50 shadow-[0_0_15px_rgba(244,63,94,0.2)]' 
            : 'bg-black/60 border-white/10 hover:border-white/20'
      }`}
      style={{ backdropFilter: 'blur(8px)' }}
    >
      <div 
        className="absolute -left-2 -top-2 w-8 h-8 rounded-full blur-[10px] opacity-20 transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: meta.color }}
      />

      <span 
        className="text-[13px] font-black relative z-10 drop-shadow-md" 
        style={{ color: meta.color }}
      >
        {meta.emoji}
      </span>
      
      <div className="flex flex-col relative z-10 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-dim)]">
            {symbol}
          </span>
          {prevPrice > 0 && Math.abs(diff) > 0 && (
            <span className={`text-[7px] ${isPositive ? 'text-neon-green' : 'text-neon-red'}`}>
              {isPositive ? '▲' : '▼'}
            </span>
          )}
        </div>
        
        <span 
          className={`text-[12px] font-mono font-bold transition-colors duration-300 leading-none mt-0.5 ${
            flashStatus === 'up' ? 'text-neon-green drop-shadow-[0_0_5px_rgba(34,214,138,0.8)]' :
            flashStatus === 'down' ? 'text-neon-red drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]' :
            'text-white'
          }`}
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
