import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import useStore from '../../lib/store';

export default function SpinWheel({ onClose }) {
  const { profile, showToast, fetchProfile, isPremiumUser } = useStore();
  const [config, setConfig] = useState(null);
  const [canSpin, setCanSpin] = useState(false);
  const [tier, setTier] = useState('free');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [proPreview, setProPreview] = useState(null);
  const canvasRef = useRef(null);
  const wheelRef = useRef(null);
  const isPro = isPremiumUser();

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config && config.length > 0) {
      drawWheel(rotation);
    }
  }, [config, rotation]);

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

  const drawWheel = (currentRotation) => {
    const canvas = canvasRef.current;
    if (!canvas || !config || config.length === 0) return;

    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const sliceAngle = (2 * Math.PI) / config.length;

    ctx.clearRect(0, 0, size, size);

    // Outer glow
    if (isPro) {
      const glow = ctx.createRadialGradient(center, center, radius - 20, center, center, radius + 15);
      glow.addColorStop(0, 'rgba(251, 191, 36, 0)');
      glow.addColorStop(0.8, 'rgba(251, 191, 36, 0.15)');
      glow.addColorStop(1, 'rgba(251, 191, 36, 0.3)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
    }

    // Outer ring
    ctx.beginPath();
    ctx.arc(center, center, radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = isPro ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw slices
    config.forEach((item, i) => {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();

      // Gradient fill per slice
      const midAngle = startAngle + sliceAngle / 2;
      const gx = center + Math.cos(midAngle) * radius * 0.5;
      const gy = center + Math.sin(midAngle) * radius * 0.5;
      const grad = ctx.createRadialGradient(center, center, 0, gx, gy, radius);
      
      const baseColor = item.color || (isPro ? '#fbbf24' : '#38bdf8');
      grad.addColorStop(0, adjustBrightness(baseColor, i % 2 === 0 ? 0 : -30));
      grad.addColorStop(1, adjustBrightness(baseColor, i % 2 === 0 ? -20 : -50));
      
      ctx.fillStyle = grad;
      ctx.fill();

      // Slice border
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(midAngle);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const labelDist = radius * 0.65;
      ctx.font = `bold ${Math.max(10, Math.min(13, radius / config.length * 1.2))}px 'Outfit', sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(item.label, labelDist, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Center circle
    const centerGrad = ctx.createRadialGradient(center, center, 0, center, center, 28);
    centerGrad.addColorStop(0, isPro ? '#fbbf24' : '#38bdf8');
    centerGrad.addColorStop(1, isPro ? '#b45309' : '#0369a1');
    ctx.beginPath();
    ctx.arc(center, center, 26, 0, 2 * Math.PI);
    ctx.fillStyle = centerGrad;
    ctx.fill();
    ctx.strokeStyle = isPro ? '#fde68a' : '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center text
    ctx.font = "bold 10px 'Outfit', sans-serif";
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', center, center);

    // Decorative dots around the wheel
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * 2 * Math.PI;
      const x = center + Math.cos(angle) * (radius + 8);
      const y = center + Math.sin(angle) * (radius + 8);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = i % 2 === 0 
        ? (isPro ? 'rgba(251,191,36,0.8)' : 'rgba(56,189,248,0.8)') 
        : 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
  };

  const adjustBrightness = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
    const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
    return `rgb(${r},${g},${b})`;
  };

  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setShowResult(false);
    setResult(null);

    try {
      const data = await api.spinWheel();
      
      // Finde den Index des Gewinners
      const winnerIndex = config.findIndex(c => c.id === data.winner.id);
      const sliceAngle = 360 / config.length;
      
      // Berechne Zielwinkel: Das Gewinnfeld soll oben (bei der Nadel) landen
      const targetAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2);
      
      // Mindestens 5 volle Umdrehungen + Zielwinkel + etwas Random
      const extraSpins = 5 * 360 + targetAngle + (Math.random() * 10 - 5);
      const finalRotation = rotation + extraSpins;
      
      setRotation(finalRotation);
      setCanSpin(false);

      // Animation: Rad dreht sich über CSS transform
      if (wheelRef.current) {
        wheelRef.current.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;
      }

      // Nach Animation: Ergebnis anzeigen
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
      }, 5200);

    } catch (err) {
      setSpinning(false);
      showToast(err.message || 'Fehler beim Drehen', 'error');
    }
  };

  if (!config) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-start overflow-y-auto">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg active:scale-95 transition-all"
      >
        ✕
      </button>

      {/* Header */}
      <div className="pt-6 pb-2 text-center">
        <h2 className={`text-xl font-black tracking-tight ${isPro ? 'text-neon-gold glow-gold' : 'text-white'}`}>
          {isPro ? '⭐ PRO GLÜCKSRAD' : '🎰 DAILY LOGIN BONUS'}
        </h2>
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] mt-1">
          {canSpin && !spinning ? 'Tippe zum Drehen!' : spinning ? 'Viel Glück...' : 'Nächster Spin: 0:00 Uhr'}
        </p>
      </div>

      {/* Pointer / Needle */}
      <div className="relative flex items-center justify-center" style={{ width: 300, height: 310 }}>
        {/* Needle at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ marginTop: -2 }}>
          <div className={`w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] ${
            isPro 
              ? 'border-l-transparent border-r-transparent border-t-neon-gold drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]' 
              : 'border-l-transparent border-r-transparent border-t-neon-blue drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]'
          }`} />
        </div>

        {/* Wheel Container (rotates) */}
        <div 
          ref={wheelRef}
          className="relative"
          style={{ 
            width: 280, 
            height: 280
          }}
        >
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            onClick={!spinning && canSpin ? handleSpin : undefined}
            className={`cursor-pointer ${!spinning && canSpin ? 'active:scale-95' : ''} transition-transform`}
          />
        </div>
      </div>

      {/* Spin Button */}
      <button
        onClick={handleSpin}
        disabled={spinning || !canSpin}
        className={`mt-2 px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 ${
          spinning || !canSpin
            ? 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
            : isPro
              ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black border border-yellow-400/50 shadow-[0_0_30px_rgba(251,191,36,0.3)]'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border border-cyan-400/30 shadow-[0_0_30px_rgba(56,189,248,0.3)]'
        }`}
      >
        {spinning ? '🎰 Dreht...' : canSpin ? '🎰 DREHEN!' : '✅ Morgen wieder'}
      </button>

      {/* Result Display */}
      {showResult && result && (
        <div className={`mt-4 mx-6 p-4 rounded-2xl border text-center tab-enter ${
          isPro 
            ? 'bg-neon-gold/10 border-neon-gold/30' 
            : 'bg-neon-green/10 border-neon-green/30'
        }`}>
          <p className="text-2xl mb-1">
            {result.winner.reward_type === 'cash' ? '💰' : result.winner.reward_type === 'crypto' ? '🪙' : '⚡'}
          </p>
          <p className={`text-sm font-black ${isPro ? 'text-neon-gold' : 'text-neon-green'}`}>
            {result.winner.label}
          </p>
          <p className="text-[10px] text-[var(--text-dim)] mt-1">
            {result.description}
          </p>
        </div>
      )}

      {/* Free User: Pro Teaser */}
      {!isPro && (
        <div className="mt-4 mx-6 p-3 rounded-2xl bg-neon-gold/5 border border-neon-gold/20 text-center">
          <p className="text-[10px] font-black text-neon-gold uppercase tracking-widest">
            ⭐ Daily Login PRO — x2 Gewinn
          </p>
          <p className="text-[9px] text-[var(--text-dim)] mt-1">
            Pro-Spieler erhalten ein goldenes Glücksrad mit doppelten Gewinnen!
          </p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
