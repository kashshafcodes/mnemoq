import { useEffect, useRef, useState } from 'react';
import { BETS } from './puzzle';
import { sfx } from './audio';
import { haptic } from '../haptics';
import { bnDigits } from './strings';

// Say how sure you are by holding the lantern: it charges through Guessing,
// I think so and Certain, with a rising note and a buzz at each step. Release
// to lock in. The three chips underneath do the same with a single tap, for
// anyone who prefers it (and for screen readers). Space works as "hold" too.

const STEP_MS = 520;
const STAKES = ['+1 / 0', '+2 / −1', '+3 / −2'];

export default function ChargeLantern({ disabled, t, lang, onCharge, onLock }) {
  const [level, setLevel] = useState(0);
  const timer = useRef(null);
  const levelRef = useRef(0);

  function setBoth(next) {
    levelRef.current = next;
    setLevel(next);
    onCharge?.(next);
  }

  function begin() {
    if (disabled || timer.current) return;

    setBoth(1);
    sfx.charge(1);
    haptic.charge(1);

    timer.current = setInterval(() => {
      const next = Math.min(3, levelRef.current + 1);

      if (next !== levelRef.current) {
        setBoth(next);
        sfx.charge(next);
        haptic.charge(next);
      }
    }, STEP_MS);
  }

  function end() {
    if (!timer.current) return;

    clearInterval(timer.current);
    timer.current = null;

    const chosen = levelRef.current;

    setBoth(0);
    if (chosen > 0) onLock(BETS[chosen - 1].id);
  }

  useEffect(() => () => clearInterval(timer.current), []);

  // Space bar = hold the lantern.
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !e.repeat && !disabled) {
        e.preventDefault();
        begin();
      }
    };
    const up = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        end();
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const label = level === 0 ? (disabled ? t('pickFirst') : t('holdToLight')) : t(`bet_${BETS[level - 1].id}`);
  const ring = 2 * Math.PI * 52;

  return (
    <div className={`dly-charge ${disabled ? 'is-disabled' : ''} lvl-${level}`}>
      <button
        type="button"
        className="dly-lantern-btn"
        disabled={disabled}
        aria-label={`${t('holdToLight')}: ${t('bet_guess')}, ${t('bet_think')}, ${t('bet_sure')}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          begin();
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.repeat) begin();
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter') end();
        }}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" className="dly-ring-track" />
          <circle
            cx="60"
            cy="60"
            r="52"
            className="dly-ring-fill"
            style={{ strokeDasharray: ring, strokeDashoffset: ring * (1 - level / 3) }}
          />
          {[0, 1, 2].map((i) => (
            <circle key={i} className={`dly-ring-pip ${level > i ? 'on' : ''}`} cx={60 + 52 * Math.sin((i + 1) * ((2 * Math.PI) / 3))} cy={60 - 52 * Math.cos((i + 1) * ((2 * Math.PI) / 3))} r="5" />
          ))}
        </svg>
        <span className="dly-lantern-core" />
        <span className="dly-lantern-label">{label}</span>
      </button>

      <p className="dly-charge-hint">{t('holdHint')}</p>
      <div className="dly-chips">
        {BETS.map((b, i) => (
          <button
            key={b.id}
            type="button"
            className={`dly-chip lvl-${i + 1}`}
            disabled={disabled}
            onClick={() => {
              sfx.charge(i + 1);
              // No buzz here: locking in plays correct/wrong straight away.
              onLock(b.id);
            }}
          >
            {t(`bet_${b.id}`)}
            <small>{lang === 'bn' ? bnDigits(STAKES[i]) : STAKES[i]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
