// Sound for the Daily, now a thin wrapper over the shared sensory engine
// (src/sensory/): same exports, so Daily.jsx, Result.jsx, ChargeLantern.jsx
// and the sample round keep working.
//
// D8 (owner): correct, fanfare, start and melody (and charge, select and
// lock) stay exactly as they were; tap, tick, wrong and next are retuned to
// the shared lantern-bell palette. Everything now runs through the shared
// master, limiter and generated reverb, and nothing plays before the first
// tap or while the page is hidden. The music is the shared generative bed.

import { roundMusic, settings, sound } from '../sensory/index.js';

// D major pentatonic, a calm "night by the river" colour.
const SCALE = [0, 2, 4, 7, 9];
const ROOT = 62; // D4
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const note = (step, octave = 0) => ROOT + 12 * (octave + Math.floor(step / 5)) + SCALE[((step % 5) + 5) % 5];

const voice = (opts) => sound.voice(opts);

// A soft bell: a sine plus a quiet overtone.
function bell(midi, at = 0, peak = 0.22, decay = 0.9) {
  voice({ freq: hz(midi), at, peak, decay });
  voice({ freq: hz(midi) * 2.01, at, peak: peak * 0.25, decay: decay * 0.5 });
}

// ── Settings: the one sensory store ───────────────────────────
// { sound, music, haptics } for the Daily's settings panel.
export function loadSettings() {
  const s = settings.get();

  return { sound: s.sound, music: s.music, haptics: s.vibration };
}

export function saveSettings(next) {
  settings.set({ sound: next.sound, music: next.music });
}

export function setSoundOn(on) {
  settings.set({ sound: Boolean(on) });
}

const play = (fn) => (...args) => {
  if (!settings.get().sound) return;

  try {
    fn(...args);
  } catch {
    // Audio is a nicety; never let it break the game.
  }
};

// ── Effects ───────────────────────────────────────────────────
export const sfx = {
  tap: play(() => sound.play('daily.tap')),
  select: play((i = 0) => voice({ freq: hz(note(i + 5)), type: 'triangle', peak: 0.12, decay: 0.12 })),
  // Rising blips while the confidence lantern charges (level 1, 2, 3).
  charge: play((level) => {
    bell(note(4 + level * 2), 0, 0.14, 0.35);
    voice({ freq: hz(note(4 + level * 2)) / 2, type: 'triangle', peak: 0.06, decay: 0.2 });
  }),
  lock: play(() => voice({ freq: 320, type: 'sine', peak: 0.2, decay: 0.12, glideTo: 180 })),
  // Brighter and longer the more you bet.
  correct: play((stake = 1) => {
    const steps = [5, 7, 9, 10].slice(0, stake + 1);
    steps.forEach((s, i) => bell(note(s), i * 0.07, 0.2, 0.8));
    if (stake === 3) bell(note(12), 0.3, 0.16, 1.4);
    sound.duckMusic(2, 900);
  }),
  wrong: play(() => sound.play('daily.wrong')),
  next: play(() => sound.play('daily.next')),
  tick: play(() => sound.play('daily.tick')),
  // One note per question on the result screen, so every round has a tune.
  melody: play((i, correct) => bell(correct ? note(5 + [0, 2, 4, 3, 5][i % 5]) : note(i % 5, -1), 0, correct ? 0.2 : 0.1, correct ? 1.1 : 0.5)),
  fanfare: play((share = 1) => {
    const run = share >= 0.99 ? [5, 7, 9, 10, 12, 14] : share >= 0.6 ? [5, 7, 9, 10] : [5, 7, 9];
    run.forEach((s, i) => bell(note(s), i * 0.09, 0.18, 1.2));
    sound.duckMusic(3, 1600);
  }),
  start: play(() => [0, 2, 4, 5].forEach((s, i) => bell(note(s + 3), i * 0.08, 0.15, 0.9))),
};

// ── Music: the shared generative bed ──────────────────────────
// On: the Daily's round is playing and the person wants music.
export function setMusicOn(on) {
  if (on) roundMusic.start({ mode: 'play' });
  else roundMusic.stop();
}

// The round is over: resolve to the home chord and fade.
export const resolveMusic = () => roundMusic.resolve();
