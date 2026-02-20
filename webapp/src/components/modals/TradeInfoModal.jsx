import React from 'react';

const INFO_CONTENT = {
  stop_loss: {
    title: 'Stop Loss (SL)',
    icon: '🛡️',
    color: 'text-neon-red',
    desc: 'Ein Sicherheitsnetz für dein Kapital. Erreicht der Kurs diesen Preis, wird die Position sofort geschlossen, um weitere Verluste zu verhindern.',
    tip: 'Pro-Tipp: Setze den SL immer knapp unter/über wichtige Unterstützungszonen.'
  },
  take_profit: {
    title: 'Take Profit (TP)',
    icon: '💰',
    color: 'text-neon-green',
    desc: 'Deine Zielgerade. Wenn der Kurs dein Ziel erreicht, wird der Trade automatisch verkauft und der Gewinn gesichert.',
    tip: 'Sichere Gewinne lieber früher als zu spät!'
  },
  limit_order: {
    title: 'Limit Order',
    icon: '⏳',
    color: 'text-neon-blue',
    desc: 'Kaufe nicht zum aktuellen Marktpreis, sondern erst, wenn der Kurs genau dein Wunsch-Niveau erreicht.',
    tip: 'Ideal für Trader, die nicht den ganzen Tag auf den Chart schauen wollen.'
  },
  trailing_stop: {
    title: 'Trailing Stop',
    icon: '📈',
    color: 'text-neon-purple',
    desc: 'Ein intelligenter Stop-Loss, der mitwandert. Steigt dein Gewinn, zieht der Stop-Loss automatisch im selben Abstand nach.',
    tip: 'Perfekt, um Gewinne bei starken Trends maximal laufen zu lassen.'
  },
  partial_close: {
    title: 'Partial Close (50%)',
    icon: '✂️',
    color: 'text-white',
    desc: 'Verkaufe nur die Hälfte deiner Position. Du nimmst erste Gewinne mit, bleibst aber mit dem Rest im Spiel.',
    tip: 'Reduziert das Risiko, ohne das Gewinnpotenzial komplett aufzugeben.'
  }
};

export default function TradeInfoModal({ type, isOpen, onClose }) {
  if (!isOpen || !type || !INFO_CONTENT[type]) return null;

  const content = INFO_CONTENT[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose} 
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-[320px] card border border-white/10 bg-gradient-to-b from-[#1a1c26] to-black p-6 shadow-2xl tab-enter">
        <div className="flex flex-col items-center text-center">
          <div className="text-4xl mb-4 p-4 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
            {content.icon}
          </div>
          
          <h3 className={`text-lg font-black uppercase tracking-widest mb-3 ${content.color}`}>
            {content.title}
          </h3>
          
          <p className="text-xs text-white/70 leading-relaxed mb-4">
            {content.desc}
          </p>

          <div className="w-full p-3 bg-white/5 rounded-xl border border-white/5 mb-6">
            <p className="text-[10px] text-white/40 italic">
              💡 {content.tip}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
