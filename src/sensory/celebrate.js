// Celebrations (sensory spec 4.2): lantern sparks and number count-ups.
// Wave 3 (Glow, levels, milestones, streaks) only calls these and feel().
//
//   sparks(ringEl)                      // 14 gold dots fly out, then remove themselves
//   sparks(ringEl, { hero: true })      // plus a ring bloom (level.up, milestone)
//   <CountUp value={12} />              // 0 -> 12, with at most 12 count.tick sounds
//
// Sparks are CSS only (no per-frame JS): each dot gets its flight in CSS
// variables. At most 16, 8 on low-end phones, one celebration at a time.
// Reduced motion: no sparks, one soft opacity pulse; count-ups show the final
// number at once.

import { createElement, useEffect, useRef, useState } from 'react';
import { feel } from './index.js';

export const SPARK_MAX = 16;
export const SPARK_MAX_LOW = 8;
export const TICK_MAX = 12;

// Rewards never stack (spec 1.4): when several land on one action, play the
// biggest once and show every line.
const REWARD_ORDER = ['milestone', 'level.up', 'round.done', 'streak.kept', 'glow.gain'];

export function pickReward(ids = []) {
  return REWARD_ORDER.find((id) => ids.includes(id)) || null;
}

// The flight of each dot: angle, distance 40 to 100 px, size 6 to 8 px,
// 700 to 1100 ms, delay 0 to 120 ms.
export function sparkPlan(count = 14, { lowEnd = false, rand = Math.random } = {}) {
  const n = Math.max(0, Math.min(count, lowEnd ? SPARK_MAX_LOW : SPARK_MAX));

  return Array.from({ length: n }, (_, i) => {
    const angle = ((i + rand() * 0.6) / n) * Math.PI * 2;
    const dist = 40 + rand() * 60;

    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      size: 6 + Math.round(rand() * 2),
      dur: 700 + Math.round(rand() * 400),
      delay: Math.round(rand() * 120),
    };
  });
}

// 400 ms for 10 or fewer, up to 700 ms (--dur-4) for larger numbers.
export function countDuration(from, to) {
  const span = Math.abs(to - from);

  return span <= 10 ? 400 : Math.min(700, 400 + span * 10);
}

// Which values get a count.tick: every one for small numbers, else 12
// spread evenly, always ending on the final number.
export function tickValues(from, to) {
  const span = Math.abs(to - from);

  if (span === 0) return [];
  const n = Math.min(TICK_MAX, span);
  const dir = to > from ? 1 : -1;

  return Array.from({ length: n }, (_, i) => from + dir * Math.round(((i + 1) * span) / n));
}

const easeOutCubic = (x) => 1 - (1 - x) ** 3;

let busy = false;

function lowEndDevice() {
  const nav = typeof navigator === 'undefined' ? null : navigator;

  return (Number(nav?.hardwareConcurrency) || 8) <= 4 || (Number(nav?.deviceMemory) || 8) <= 2;
}

function reducedMotion() {
  try {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

// Lantern sparks around an element. Returns false if nothing was added
// (another celebration running, reduced motion, no element).
export function sparks(el, { count = 14, hero = false, reduced = reducedMotion(), lowEnd = lowEndDevice() } = {}) {
  if (!el?.appendChild || typeof document === 'undefined') return false;
  if (reduced) {
    el.classList.remove('fx-pulse-once');
    el.classList.add('fx-pulse-once');
    el.addEventListener('animationend', () => el.classList.remove('fx-pulse-once'), { once: true });
    return false;
  }
  if (busy) return false;
  busy = true;

  const layer = document.createElement('span');
  const plan = sparkPlan(count, { lowEnd });
  let left = plan.length + (hero ? 1 : 0);
  const done = () => {
    left -= 1;
    if (left <= 0) finish();
  };
  const finish = () => {
    if (!busy) return;
    busy = false;
    layer.remove();
  };

  layer.className = 'fx-sparks';
  layer.setAttribute('aria-hidden', 'true');
  for (const dot of plan) {
    const i = document.createElement('i');

    i.style.cssText = `--dx:${dot.dx}px;--dy:${dot.dy}px;--size:${dot.size}px;--dur:${dot.dur}ms;--delay:${dot.delay}ms`;
    i.addEventListener('animationend', done, { once: true });
    layer.appendChild(i);
  }
  if (hero) {
    const bloom = document.createElement('b');

    bloom.addEventListener('animationend', done, { once: true });
    layer.appendChild(bloom);
  }
  el.appendChild(layer);
  // A hidden tab never fires animationend; clean up anyway.
  setTimeout(finish, 1600);
  return true;
}

// Count a number up with requestAnimationFrame into a fixed-width box.
// onTick(step, value) fires at most 12 times (the caller plays count.tick).
export function countUp({ from = 0, to, onFrame, onTick, reduced = false, raf, now } = {}) {
  const frame = raf || ((fn) => requestAnimationFrame(fn));
  const clock = now || (() => performance.now());

  if (reduced || from === to) {
    onFrame?.(to);
    return () => {};
  }
  const dur = countDuration(from, to);
  const ticks = tickValues(from, to);
  const start = clock();
  let next = 0;
  let stopped = false;
  const step = () => {
    if (stopped) return;
    const x = Math.min(1, (clock() - start) / dur);
    const value = Math.round(from + (to - from) * easeOutCubic(x));

    onFrame?.(value);
    while (next < ticks.length && (to > from ? value >= ticks[next] : value <= ticks[next])) {
      onTick?.(next, ticks[next]);
      next += 1;
    }
    if (x < 1) frame(step);
  };

  frame(step);
  return () => {
    stopped = true;
  };
}

// <CountUp value={n} from={0} sound /> counts once when it first shows.
// The box is tabular-nums and sized to the final number, so nothing shifts.
export function CountUp({ value, from = 0, sound = true, onTick, format = (n) => n, className = '' }) {
  const [shown, setShown] = useState(from);
  const tick = useRef(onTick);

  tick.current = onTick || ((step) => feel('count.tick', { step }));
  useEffect(
    () =>
      countUp({
        from,
        to: value,
        reduced: reducedMotion(),
        onFrame: setShown,
        onTick: sound ? (step) => tick.current?.(step) : undefined,
      }),
    [from, value, sound],
  );

  return createElement(
    'span',
    { className: `fx-count ${className}`.trim(), style: { minWidth: `${String(value).length}ch` } },
    format(shown),
  );
}
