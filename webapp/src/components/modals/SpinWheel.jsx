import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import useStore from '../../lib/store';

// Krypto-Symbol-Mapping
const CRYPTO_SYMBOLS = {
  BTC: '₿', ETH: 'Ξ', LTC: 'Ł', SOL: '◎', XRP: '✕', BNB: '◆', ADA: '₳', DOT: '●'
};

function getCryptoDisplay(label) {
  for (const [code, sym] of Object.entries(CRYPTO_SYMBOLS)) {
    if (label.toUpperCase().includes(code)) {
      return label.replace(new RegExp(code, 'i'), sym);
    }
  }
  return label;
}

function shadeColor(hex, percent) {
  const h = hex.startsWith('#') ? hex : '#38bdf8';
  let r = parseInt(h.slice(1, 3), 16) || 0;
  let g = parseInt(h.slice(3, 5), 16) || 0;
  let b = parseInt(h.slice(5, 7), 16) || 0;
  r = Math.min(255, Math.max(0, r + percent));
  g = Math.min(255, Math.max(0, g + percent));
  b = Math.min(255, Math.max(0, b + percent));
  return `rgb(${r},${g},${b})`;
}

export default function SpinWheel({ onClose }) {
  const { profile, showToast, fetchProfile, isPremiumUser } = useStore();
  const [config, setConfig] = useState(null);
  const [canSpin, setCanSpin] = useState(false);
  const [tier, setTier] = useState('free');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [proPreview, setProPreview] = useState(null);
  const [lightPhase, setLightPhase] = useState(0);
  const canvasRef = useRef(null);
  const wheelRef = useRef(null);
  const rotationRef = useRef(0);
  const isPro = isPremiumUser();

  useEffect(() => { loadConfig(); }, []);

  // Lichterkette-Animation
  useEffect(() => {
    const iv = setInterval(() => setLightPhase(p => (p + 1) % 3), 400);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (config && config.length > 0) drawWheel();
  }, [config, isPro]);

  const loadConfig = async () => {
    try {
      const data = await api.getSpinConfig();
      setConfig(data.config || []);
      setCanSpin(data.can_spin);
      setTier(data.tier);
      setProPreview(data.pro_preview);
    } catch (err) {
      console.error('Spin config error:', err);
    }
  };

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config || config.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const displaySize = 280;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const center = displaySize / 2;
    const outerRadius = center - 4;
    const innerRadius = 28;
    const sliceAngle = (2 * Math.PI) / config.length;

    ctx.clearRect(0, 0, displaySize, displaySize);

    // ---- Clip zum Kreis (kein Quadrat-Hintergrund!) ----
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, 2 * Math.PI);
    ctx.clip();

    // ---- Slices zeichnen ----
    config.forEach((item, i) => {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, outerRadius, startAngle, endAngle);
      ctx.closePath();

      const baseColor = item.color || '#38bdf8';
      const grad = ctx.createLinearGradient(
        center + Math.cos(midAngle) * innerRadius,
        center + Math.sin(midAngle) * innerRadius,
        center + Math.cos(midAngle) * outerRadius,
        center + Math.sin(midAngle) * outerRadius
      );
      grad.addColorStop(0, shadeColor(baseColor, i % 2 === 0 ? 25 : -5));
      grad.addColorStop(1, shadeColor(baseColor, i % 2 === 0 ? -20 : -40));

      ctx.fillStyle = grad;
      ctx.fill();

      // Trennlinie
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(
        center + Math.cos(startAngle) * outerRadius,
        center + Math.sin(startAngle) * outerRadius
      );
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ---- Label ----
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(midAngle);

      const displayLabel = getCryptoDisplay(item.label);
      const labelDist = outerRadius * 0.62;
      const fontSize = Math.max(11, Math.min(14, outerRadius / config.length * 1.4));

      ctx.font = `800 ${fontSize}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(displayLabel, labelDist, 0);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    ctx.restore(); // Clip aufheben

    // ---- Äußerer Ring (dünn, auf dem Kreis) ----
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = isPro ? 'rgba(251,191,36,0.35)' : 'rgba(56,189,248,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ---- Hub (Mitte) ----
    ctx.beginPath();
    ctx.arc(center, center, innerRadius + 3, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    const hubGrad = ctx.createRadialGradient(center - 3, center - 3, 2, center, center, innerRadius);
    if (isPro) {
      hubGrad.addColorStop(0, '#fde68a');
      hubGrad.addColorStop(0.6, '#fbbf24');
      hubGrad.addColorStop(1, '#78350f');
    } else {
      hubGrad.addColorStop(0, '#bae6fd');
      hubGrad.addColorStop(0.6, '#38bdf8');
      hubGrad.addColorStop(1, '#0c4a6e');
    }
    ctx.beginPath();
    ctx.arc(center, center, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = isPro ? 'rgba(254,243,199,0.5)' : 'rgba(186,230,253,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "800 10px 'Outfit', sans-serif";
    ctx.fillStyle = isPro ? '#451a03' : '#0c4a6e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', center, center);
  }, [config, isPro]);

  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setShowResult(false);
    setResult(null);

    try {
      const data = await api.spinWheel();
      const winnerIndex = config.findIndex(c => c.id === data.winner.id);
      const sliceAngle = 360 / config.length;
      const targetAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2);
      const totalSpin = 6 * 360 + targetAngle + (Math.random() * sliceAngle * 0.3 - sliceAngle * 0.15);
      const newRotation = rotationRef.current + totalSpin;
      rotationRef.current = newRotation;
      setCanSpin(false);

      if (wheelRef.current) {
        wheelRef.current.style.transition = 'transform 5.5s cubic-bezier(0.12, 0.60, 0.08, 1.00)';
        wheelRef.current.style.transform = `rotate(${newRotation}deg)`;
      }

      setTimeout(() => {
        setResult(data);
        setShowResult(true);
        setSpinning(false);
        fetchProfile();

        let emoji = '🎰';
        if (data.winner.reward_type === 'cash') emoji = '💰';
        if (data.winner.reward_type === 'crypto') emoji = '🪙';
        if (data.winner.reward_type === 'feature') emoji = '⚡';
        showToast(`${emoji} ${data.description}`, 'success');
      }, 5800);
    } catch (err) {
      setSpinning(false);
      showToast(err.message || 'Fehler beim Drehen', 'error');
    }
  };

  if (!config) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: '#06080f' }}>
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
      </div>
    );
  }

  // Lichterkette Positionen
  const lightCount = 32;
  const lightRad = 155;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto" style={{ background: '#06080f' }}>

      {/* Pro: Goldene Akzentlinien oben & unten (Fenster-Design) */}
      {isPro && <>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        <div className="absolute top-[2px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
        {/* Seitliche goldene Akzente */}
        <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-amber-400/20 to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-amber-400/20 to-transparent" />
      </>}

      {/* Close */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center text-lg active:scale-95 transition-all ${
          isPro ? 'bg-amber-950/50 border border-amber-600/25 text-amber-300' : 'bg-white/5 border border-white/10 text-white'
        }`}
      >✕</button>

      {/* Header */}
      <div className="pt-6 pb-3 text-center relative z-10">
        {isPro ? (
          <h2 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200">
            ⭐ PRO GLÜCKSRAD
          </h2>
        ) : (
          <h2 className="text-xl font-black tracking-tight text-white">
            🎰 DAILY LOGIN BONUS
          </h2>
        )}
        <p className={`text-[10px] uppercase tracking-[0.2em] mt-1 font-bold ${isPro ? 'text-amber-600/50' : 'text-[var(--text-dim)]'}`}>
          {canSpin && !spinning ? 'Tippe zum Drehen!' : spinning ? 'Viel Glück...' : 'Nächster Spin: 0:00 Uhr'}
        </p>
      </div>

      {/* ---- WHEEL AREA ---- */}
      <div className="relative flex items-center justify-center" style={{ width: 320, height: 330 }}>

        {/* Äußerer Dekor-Ring (dreht sich NICHT) */}
        {isPro ? (
          <div className="absolute rounded-full pointer-events-none"
            style={{
              width: 304, height: 304,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'conic-gradient(from 0deg, #78350f, #fbbf24, #fef3c7, #fbbf24, #78350f, #fbbf24, #fef3c7, #fbbf24, #78350f)',
              borderRadius: '50%',
              padding: 4,
            }}
          >
            <div className="w-full h-full rounded-full" style={{ background: '#06080f' }} />
          </div>
        ) : (
          <div className="absolute rounded-full pointer-events-none"
            style={{
              width: 300, height: 300,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              border: '2px solid rgba(56,189,248,0.2)',
              borderRadius: '50%',
            }}
          />
        )}

        {/* Lichterkette (dreht sich NICHT) */}
        <svg className="absolute pointer-events-none z-10"
          style={{ width: 310, height: 310, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          viewBox="0 0 310 310"
        >
          {Array.from({ length: lightCount }, (_, i) => {
            const angle = (i / lightCount) * 2 * Math.PI - Math.PI / 2;
            const cx = 155 + Math.cos(angle) * lightRad;
            const cy = 155 + Math.sin(angle) * lightRad;
            const isOn = (i % 3) === lightPhase;
            return (
              <circle key={i} cx={cx} cy={cy} r={isPro ? 3.5 : 2.8}
                fill={isOn
                  ? (isPro ? '#fbbf24' : '#38bdf8')
                  : (isPro ? 'rgba(120,53,15,0.4)' : 'rgba(14,55,80,0.4)')
                }
                style={{
                  filter: isOn ? `drop-shadow(0 0 ${isPro ? 4 : 3}px ${isPro ? 'rgba(251,191,36,0.7)' : 'rgba(56,189,248,0.6)'})` : 'none',
                  transition: 'fill 0.25s ease, filter 0.25s ease'
                }}
              />
            );
          })}
        </svg>

        {/* Nadel (dreht sich NICHT) */}
        <div className="absolute z-30" style={{ top: 6, left: '50%', transform: 'translateX(-50%)' }}>
          <svg width="30" height="34" viewBox="0 0 30 34">
            <defs>
              <linearGradient id="ng" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPro ? '#fde68a' : '#bae6fd'} />
                <stop offset="100%" stopColor={isPro ? '#92400e' : '#0369a1'} />
              </linearGradient>
              <filter id="ns"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={isPro ? '#fbbf24' : '#38bdf8'} floodOpacity="0.6" /></filter>
            </defs>
            <polygon points="15,30 3,3 27,3" fill="url(#ng)" stroke={isPro ? '#fde68a' : '#93c5fd'} strokeWidth="1.2" filter="url(#ns)" />
            <circle cx="15" cy="8" r="2.5" fill={isPro ? '#fef3c7' : '#dbeafe'} opacity="0.7" />
          </svg>
        </div>

        {/* ---- RAD (NUR dieses Element dreht sich) ---- */}
        <div ref={wheelRef} className="absolute" style={{ width: 280, height: 280, top: '50%', left: '50%', marginTop: -140, marginLeft: -140, borderRadius: '50%' }}>
          <canvas ref={canvasRef}
            style={{ width: 280, height: 280, display: 'block', borderRadius: '50%' }}
            onClick={!spinning && canSpin ? handleSpin : undefined}
            className={!spinning && canSpin ? 'cursor-pointer' : ''}
          />
        </div>
      </div>

      {/* Spin Button */}
      <button onClick={handleSpin} disabled={spinning || !canSpin}
        className={`mt-3 px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 ${
          spinning || !canSpin
            ? 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
            : isPro
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 text-amber-950 border border-amber-300/50 shadow-[0_0_25px_rgba(251,191,36,0.2)]'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border border-cyan-400/30 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
        }`}
      >
        {spinning ? '🎰 Dreht...' : canSpin ? '🎰 DREHEN!' : '✅ Morgen wieder'}
      </button>

      {/* Ergebnis */}
      {showResult && result && (
        <div className={`mt-4 mx-6 p-4 rounded-2xl border text-center tab-enter ${
          isPro ? 'bg-amber-950/25 border-amber-500/25' : 'bg-neon-green/10 border-neon-green/30'
        }`}>
          <p className="text-3xl mb-1.5">
            {result.winner.reward_type === 'crypto' ? '🪙' : '💰'}
          </p>
          <p className={`text-base font-black ${isPro ? 'text-amber-300' : 'text-neon-green'}`}>
            {getCryptoDisplay(result.winner.label)}
          </p>
          <p className="text-[10px] text-[var(--text-dim)] mt-1.5">{result.description}</p>
        </div>
      )}

      {/* Free: Pro Teaser */}
      {!isPro && (
        <div className="mt-4 mx-6 p-3 rounded-2xl bg-amber-950/15 border border-amber-600/15 text-center">
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">⭐ Daily Login PRO — Bis zu 5x mehr Gewinn</p>
          <p className="text-[9px] text-[var(--text-dim)] mt-1">Pro-Spieler erhalten ein goldenes Glücksrad mit bis zu 5-fachen Gewinnen!</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
