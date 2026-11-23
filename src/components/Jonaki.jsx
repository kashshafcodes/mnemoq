import { useId } from 'react';
import './Jonaki.css';

// Jonaki (জোনাকি, "firefly"): Mnemoq's mascot. A small light that helps you
// remember in the dark. Its lantern glows brighter as you learn.
//
//   <Jonaki mood="happy" glow={0.8} size={96} />
//
// mood: idle | think | charge | happy | oops | wow | sleep
// glow: 0 (dim) to 1 (blazing); defaults depend on the mood.

const DEFAULT_GLOW = { idle: 0.55, think: 0.45, charge: 0.7, happy: 0.9, oops: 0.2, wow: 1, sleep: 0.15 };

function Eyes({ mood }) {
  if (mood === 'happy') {
    return (
      <g className="jk-eyes" fill="none" stroke="#fff7e0" strokeWidth="3.2" strokeLinecap="round">
        <path d="M44 47q5-6 10 0" />
        <path d="M66 47q5-6 10 0" />
      </g>
    );
  }

  if (mood === 'sleep') {
    return (
      <g className="jk-eyes" fill="none" stroke="#fff7e0" strokeWidth="2.6" strokeLinecap="round">
        <path d="M44 48q5 4 10 0" />
        <path d="M66 48q5 4 10 0" />
      </g>
    );
  }

  const look = { think: [2, -3], oops: [0, 2.5], charge: [0, -1] }[mood] || [0, 0];
  const big = mood === 'wow' ? 1.18 : 1;

  return (
    <g className="jk-eyes jk-blink">
      {[49, 71].map((cx) => (
        <g key={cx} transform={`translate(${cx} 47) scale(${big})`}>
          <ellipse rx="7.2" ry="8.4" fill="#fffaf0" />
          <circle cx={look[0]} cy={look[1] + 0.5} r="4.4" fill="#1b1533" />
          <circle cx={look[0] + 1.6} cy={look[1] - 1.6} r="1.6" fill="#fff" />
          {mood === 'wow' && <path d="M-2.6 3.6l.9 1.8 1.9.3-1.4 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.4-1.3 1.9-.3z" fill="#ffd54a" />}
        </g>
      ))}
      {mood === 'oops' && (
        <g stroke="#fff7e0" strokeWidth="2.4" strokeLinecap="round">
          <path d="M42 38l11-4" />
          <path d="M78 38l-11-4" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood }) {
  const d = {
    idle: 'M55 60q5 4 10 0',
    think: 'M57 61h6',
    charge: 'M56 60q4 3 8 0',
    happy: 'M52 58q8 10 16 0z',
    oops: 'M54 63q3-3 6 0t6 0',
    wow: 'M60 57a4 5 0 1 0 .01 0z',
    sleep: 'M57 61q3 2 6 0',
  }[mood];
  const filled = mood === 'happy' || mood === 'wow';

  return (
    <path
      className="jk-mouth"
      d={d}
      fill={filled ? '#3a1d2e' : 'none'}
      stroke="#3a1d2e"
      strokeWidth={filled ? 1.6 : 2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export default function Jonaki({ mood = 'idle', glow, size = 96, className = '', title }) {
  const id = useId().replace(/:/g, '');
  const level = Math.max(0, Math.min(1, glow ?? DEFAULT_GLOW[mood] ?? 0.5));

  return (
    <svg
      className={`jonaki jk-${mood} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      style={{ '--jk-glow': level }}
    >
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ffd54a" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#ffb321" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ff9f1c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-lantern`} cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.35" stopColor="#ffe27a" />
          <stop offset="0.8" stopColor="#ffb321" />
          <stop offset="1" stopColor="#f08a00" />
        </radialGradient>
        <radialGradient id={`${id}-body`} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#5b4a9e" />
          <stop offset="0.6" stopColor="#35295f" />
          <stop offset="1" stopColor="#211a40" />
        </radialGradient>
        <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8f1ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#a9c4ff" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      <g className="jk-float">
        <circle className="jk-halo" cx="60" cy="84" r="44" fill={`url(#${id}-halo)`} />

        <g className="jk-wings" fill={`url(#${id}-wing)`} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1">
          <g transform="rotate(-28 34 62)">
            <ellipse className="jk-wing jk-wing-l" cx="34" cy="62" rx="17" ry="10" />
          </g>
          <g transform="rotate(28 86 62)">
            <ellipse className="jk-wing jk-wing-r" cx="86" cy="62" rx="17" ry="10" />
          </g>
        </g>

        <ellipse className="jk-lantern" cx="60" cy="86" rx="19" ry="17" fill={`url(#${id}-lantern)`} />
        <path d="M43 80q17 7 34 0" fill="none" stroke="#c96f00" strokeOpacity="0.35" strokeWidth="1.6" />
        <path d="M45 90q15 6 30 0" fill="none" stroke="#c96f00" strokeOpacity="0.25" strokeWidth="1.4" />

        <g className="jk-antennae" fill="none" stroke="#2a2150" strokeWidth="2.6" strokeLinecap="round">
          <path d="M51 30q-6-12-14-14" />
          <path d="M69 30q6-12 14-14" />
        </g>
        <circle className="jk-tip" cx="37" cy="16" r="3.2" fill="#ffd54a" />
        <circle className="jk-tip" cx="83" cy="16" r="3.2" fill="#ffd54a" />

        <circle cx="60" cy="50" r="25" fill={`url(#${id}-body)`} />
        <ellipse cx="51" cy="37" rx="9" ry="5" fill="#ffffff" opacity="0.12" />
        <ellipse cx="42" cy="57" rx="4.2" ry="2.6" fill="#ff7aa8" opacity="0.45" />
        <ellipse cx="78" cy="57" rx="4.2" ry="2.6" fill="#ff7aa8" opacity="0.45" />

        <Eyes mood={mood} />
        <Mouth mood={mood} />

        {mood === 'sleep' && (
          <text x="86" y="30" className="jk-z" fill="#fff7e0" fontSize="12" fontWeight="700">
            z
          </text>
        )}
      </g>
    </svg>
  );
}
