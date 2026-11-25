// The sensory system: feel('correct') fires the sound, the haptic and the
// motion class of one moment together (spec phase2-sensory 6.1).
//
//   import { feel } from '../sensory';
//   feel('correct', { el: cardRef.current });
//
// Call it first in the tap handler, before any setState or await (iPhones
// only tick inside the tap). It never throws. Nothing plays before the first
// tap on the page, or while the page is hidden.
//
// Music (roundMusic) plays only inside Today's round and the Daily.

import { useSyncExternalStore } from 'react';
import { EVENTS, REDUCED_SOUND } from './events.js';
import { playHaptic } from './haptics.js';
import { createEngine } from './sound/engine.js';
import { createMusic } from './sound/music.js';
import { settings } from './settings.js';

export { EVENTS } from './events.js';
export { settings } from './settings.js';

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];

export function prefersReducedMotion(win) {
  try {
    return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

function isLowEnd(nav) {
  return (Number(nav?.hardwareConcurrency) || 8) <= 4 || (Number(nav?.deviceMemory) || 8) <= 2;
}

// Add a motion class and take it off when its animation ends, so the same
// moment can play again on the next tap.
function addMotion(el, cls, win) {
  if (!el?.classList) return;
  el.classList.remove(cls);
  const add = () => {
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  };
  if (win?.requestAnimationFrame) win.requestAnimationFrame(add);
  else add();
}

// One sensory system. The app uses the default below; tests build their own
// with a fake AudioContext, window and document.
export function createSensory({ win, doc, nav, store = settings, haptic = playHaptic, now, schedule, every, cancel, dev = false } = {}) {
  const AC = win ? win.AudioContext || win.webkitAudioContext : null;
  const engine = createEngine({ AC, isOn: () => store.get().sound, now, schedule, nav });
  const lowEnd = isLowEnd(nav);
  const music = createMusic({
    engine,
    isOn: () => store.get().sound && store.get().music,
    lowEnd,
    seed: dayNumber(),
    every,
    cancel,
  });
  const log = [];

  function feel(id, opts = {}) {
    try {
      const event = EVENTS[id];

      if (!event) {
        if (dev) console.warn(`feel: unknown event "${id}"`);
        return;
      }
      if (doc?.hidden) return;

      const reduced = prefersReducedMotion(win);
      const played = engine.play((reduced && REDUCED_SOUND[id]) || event.sound, opts);

      if (event.haptic) haptic(event.haptic, { reduced });
      if (event.motion && opts.el && !reduced) addMotion(opts.el, event.motion, win);
      opts.onMood?.(event.mood);
      if (dev) {
        log.push({ id, at: Date.now(), sound: played > 0 });
        if (log.length > 200) log.shift();
      }
    } catch {
      // Sound, haptics and motion are niceties; never break a tap.
    }
  }

  function onGesture() {
    engine.unlock();
    music.onUnlock();
  }

  function onVisibility() {
    const hidden = Boolean(doc?.hidden);

    engine.setHidden(hidden);
    if (hidden) music.pause();
    else music.resume();
  }

  if (win?.addEventListener) {
    for (const type of GESTURES) win.addEventListener(type, onGesture, { capture: true, passive: true });
    win.addEventListener('pagehide', () => {
      engine.setHidden(true);
      music.pause();
    });
    win.addEventListener('pageshow', onVisibility);
  }
  doc?.addEventListener?.('visibilitychange', onVisibility);
  store.subscribe?.(() => music.refresh());

  return { feel, engine, music, log, onGesture, onVisibility };
}

// Dhaka day number: seeds the music, so each day sounds a little different.
function dayNumber() {
  return Math.floor((Date.now() + 6 * 3600e3) / 864e5);
}

const browser = typeof window !== 'undefined';
const DEV = Boolean(import.meta.env?.DEV);
const system = createSensory({
  win: browser ? window : null,
  doc: typeof document === 'undefined' ? null : document,
  nav: typeof navigator === 'undefined' ? null : navigator,
  dev: DEV,
});

// In development, the last feel() calls are on window.__feel (the brief's
// "log feel calls" check in the preview).
if (browser && DEV) window.__feel = system.log;

export const feel = system.feel;
export const sound = system.engine;

// Today's round and the Daily call these; nothing else plays music.
export const roundMusic = {
  start: (opts) => system.music.start(opts),
  setMode: (mode) => system.music.setMode(mode),
  resolve: () => system.music.resolve(),
  stop: () => system.music.stop(),
  isPlaying: () => system.music.isPlaying(),
};

// [{ sound, music, vibration }, set(patch)] for a React switch.
export function useSensorySettings() {
  const state = useSyncExternalStore(settings.subscribe, settings.get, settings.get);

  return [state, settings.set];
}
