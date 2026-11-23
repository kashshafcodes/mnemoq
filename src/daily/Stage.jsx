import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

// The Daily's world: a night sky over a river, drifting fireflies, and a
// canvas for spark bursts when a lantern lights. Purely decorative.

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function NightSky({ glow = 0 }) {
  // Fixed pseudo-random positions so the scene is the same on every render.
  const flies = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;

        return {
          left: `${r(1) * 100}%`,
          top: `${30 + r(2) * 62}%`,
          size: 2 + r(3) * 3,
          delay: `${-r(4) * 12}s`,
          duration: `${9 + r(5) * 10}s`,
          blink: `${2 + r(6) * 3}s`,
        };
      }),
    []
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const r = (n) => ((Math.sin(i * 91.17 + n * 13.7) * 24634.6345) % 1 + 1) % 1;

        return { left: `${r(1) * 100}%`, top: `${r(2) * 45}%`, size: r(3) > 0.85 ? 2 : 1, delay: `${-r(4) * 6}s` };
      }),
    []
  );

  return (
    <div className="dly-sky" aria-hidden="true" style={{ '--glow': glow }}>
      <div className="dly-moon" />
      {stars.map((s, i) => (
        <span key={i} className="dly-star" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }} />
      ))}
      {flies.map((f, i) => (
        <span
          key={i}
          className="dly-fly"
          style={{ left: f.left, top: f.top, width: f.size, height: f.size, animationDelay: `${f.delay}, ${f.delay}`, animationDuration: `${f.duration}, ${f.blink}` }}
        />
      ))}
      <svg className="dly-horizon" viewBox="0 0 1440 260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dly-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d1842" />
            <stop offset="1" stopColor="#0c0a1e" />
          </linearGradient>
        </defs>
        <path
          d="M0 120c60-8 110-30 170-26s90 22 150 18 110-34 180-30 120 30 190 26 100-28 170-24 120 26 190 22 90-20 150-18 70 14 160 12V260H0z"
          fill="#151233"
        />
        <path d="M0 150h1440v110H0z" fill="url(#dly-water)" />
        {/* Reeds */}
        <g stroke="#0b0a1c" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M60 160q4-40-6-70M74 162q-2-34 10-58M88 160q6-30-2-50" />
          <path d="M1330 160q-4-46 8-76M1346 162q2-30-10-54M1362 160q-6-36 4-60M1378 161q3-22-6-40" />
        </g>
        {/* Moon reflection */}
        <g className="dly-shimmer" stroke="#ffe7a3" strokeLinecap="round" opacity="0.5">
          <path d="M1080 172h60" strokeWidth="2" />
          <path d="M1092 186h36" strokeWidth="2" />
          <path d="M1100 200h22" strokeWidth="1.6" />
        </g>
      </svg>
    </div>
  );
}

// Full-screen canvas; call ref.current.burst(x, y, { color, count }).
export const Sparks = forwardRef(function Sparks(_, ref) {
  const canvas = useRef(null);
  const parts = useRef([]);
  const frame = useRef(0);

  useImperativeHandle(ref, () => ({
    burst(x, y, { color = '#ffd54a', count = 28, spread = 1 } = {}) {
      if (reducedMotion() || !canvas.current) return;

      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1.5 + Math.random() * 4.5) * spread;

        parts.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          life: 1,
          decay: 0.012 + Math.random() * 0.02,
          size: 1.5 + Math.random() * 2.8,
          color,
        });
      }

      if (!frame.current) frame.current = requestAnimationFrame(tick);
    },
  }));

  function tick() {
    const c = canvas.current;

    if (!c) return;

    const dpr = window.devicePixelRatio || 1;

    if (c.width !== innerWidth * dpr) {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
    }

    const g = c.getContext('2d');

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalCompositeOperation = 'lighter';

    parts.current = parts.current.filter((p) => p.life > 0);

    for (const p of parts.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy = p.vy * 0.97 + 0.06;
      p.life -= p.decay;

      const r = p.size * (0.6 + p.life * 0.6);
      const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);

      grad.addColorStop(0, p.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
      g.fill();
    }

    frame.current = parts.current.length ? requestAnimationFrame(tick) : 0;

    if (!frame.current) g.clearRect(0, 0, innerWidth, innerHeight);
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return <canvas ref={canvas} className="dly-sparks" aria-hidden="true" />;
});
