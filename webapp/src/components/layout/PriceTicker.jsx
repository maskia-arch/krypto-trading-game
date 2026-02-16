import React, { useEffect, useRef } from 'react';

const COIN_META = {
  BTC: { emoji: '₿', name: 'Bitcoin' },
  ETH: { emoji: 'Ξ', name: 'Ethereum' },
  LTC: { emoji: 'Ł', name: 'Litecoin' },
};

export default function PriceTicker({ symbol, price, prevPrice }) {
  const ref = useRef(null);
  const prev = useRef(price);

  useEffect(() => {
    if (!ref.current || price === undefined) return;
    
    if (price > prev.current) {
      ref.current.classList.remove('tick-down');
      ref.current.classList.add('tick-up');
    } else if (price < prev.current) {
      ref.current.classList.remove('tick-up');
      ref.current.classList.add('tick-down');
    }
    
    prev.current = price;
    
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.classList.remove('tick-up', 'tick-down');
      }
    }, 600);
    
    return () => clearTimeout(t);
  }, [price]);

  const displayPrice = price || 0;

  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
         style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[10px] opacity-50">{COIN_META[symbol]?.emoji || '🪙'}</span>
      <span className="text-[10px] font-medium opacity-40">{symbol}</span>
      <span ref={ref} className="text-[11px] font-mono font-semibold">
        {displayPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
      </span>
    </div>
  );
}
