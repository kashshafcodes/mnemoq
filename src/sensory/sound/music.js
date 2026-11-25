// Generative music: a quiet "night by the river" bed made of the same lantern
// bell in the same key (spec phase2-sensory section 2). Code, not files.
//
// - Six chords built only from D E F# A B, chosen by a weighted random walk
//   (stay 10%, a neighbour 60%, anywhere 30%), never the same chord three
//   bars running. Bars are 8 s, no beat.
// - A lookahead scheduler: a 1 s timer that books bars up to 4 s ahead on the
//   audio clock, so a busy main thread never makes it drift or stutter.
// - The day number seeds the random walk: every day sounds a little different.
// - Every 8th bar is a "breath" (pad only). In review, plucks are off.
// - It plays only during Today's round and the Daily, fades in 1.5 s, fades
//   out 0.8 s, and on round end resolves to the home chord and fades over 3 s.

import { dbToGain, hz } from './palette.js';

export const BAR = 8; // seconds
export const LOOKAHEAD = 4; // seconds booked ahead
export const TICK_MS = 1000;
export const FADE_IN = 1.5;
export const FADE_OUT = 0.8;
export const RESOLVE = 3;
// Owner: on by default, "quietly". The bed sits about 12 dB under feedback.
export const MUSIC_LEVEL = 0.8;

// D-F#-A, B-D-F#, E-A-B, A-B-D, F#-A-D, E-F#-B (MIDI, around D4).
export const CHORDS = [
  [62, 66, 69],
  [59, 62, 66],
  [64, 69, 71],
  [57, 59, 62],
  [66, 69, 74],
  [64, 66, 71],
];
const HOME = 0;

const PAD_DB = -36;
const PLUCK_DB = -42;
const SUB_DB = PAD_DB - 8;

export function seeded(seed) {
  let a = (Number(seed) || 0) >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The next chord index, given the last two.
export function nextChord(prev, prev2, rand) {
  const n = CHORDS.length;

  for (let tries = 0; tries < 8; tries += 1) {
    const r = rand();
    let next;

    if (prev == null) next = HOME;
    else if (r < 0.1) next = prev;
    else if (r < 0.7) next = (prev + (rand() < 0.5 ? n - 1 : 1)) % n;
    else next = Math.floor(rand() * n);
    if (!(next === prev && next === prev2)) return next;
  }

  return (prev + 1) % n;
}

// What one bar holds. i counts from 0.
export function barPlan(i, prev, prev2, rand, { review = false, lowEnd = false } = {}) {
  const chord = nextChord(prev, prev2, rand);
  const breath = i % 8 === 7;
  const plucks = [];
  const count = breath || review ? 0 : Math.min(Math.floor(rand() * 4), lowEnd ? 2 : 3);

  for (let k = 0; k < count; k += 1) {
    const tones = CHORDS[chord];
    const m = tones[Math.floor(rand() * tones.length)] + (rand() < 0.5 ? 12 : 24);

    plucks.push({ m: Math.min(m, 86), t: 0.6 + rand() * 6 });
  }

  return { chord, breath, plucks };
}

export function createMusic({
  engine,
  isOn = () => true,
  seed = 0,
  lowEnd = false,
  every = (fn, ms) => setInterval(fn, ms),
  cancel = (id) => clearInterval(id),
} = {}) {
  let timer = null;
  let playing = false; // inside a round, music running
  let wanted = false; // inside a round (even if not yet unlocked or hidden)
  let review = false;
  let nextAt = 0;
  let bar = 0;
  let history = [null, null];
  let rand = seeded(seed);
  let sources = [];

  const ctx = () => engine.context();

  function tone(m, t0, { type = 'sine', attack, decay, db, detune = 0 }) {
    const c = ctx();
    const osc = c.createOscillator();
    const env = c.createGain();
    const end = t0 + attack + decay;

    osc.type = type;
    osc.frequency.setValueAtTime(hz(m), t0);
    osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(dbToGain(db), t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(env);
    env.connect(engine.musicBus());
    osc.start(t0);
    osc.stop(end + 0.05);
    sources.push({ osc, start: t0, end: end + 0.05 });
  }

  function pad(chord, t0, length) {
    for (const m of CHORDS[chord]) {
      tone(m, t0, { attack: 1.4, decay: length - 1.4, db: PAD_DB });
      if (!lowEnd) tone(m, t0, { type: 'triangle', attack: 1.4, decay: length - 1.4, db: PAD_DB - 12, detune: 7 });
    }
    tone(CHORDS[chord][0] - 12, t0, { attack: 1, decay: length - 1, db: SUB_DB });
  }

  function scheduleBar(t0) {
    const plan = barPlan(bar, history[0], history[1], rand, { review, lowEnd });

    history = [plan.chord, history[0]];
    pad(plan.chord, t0, BAR);
    for (const p of plan.plucks) {
      tone(p.m, t0 + p.t, { attack: 0.01, decay: 1.6, db: PLUCK_DB });
      tone(p.m, t0 + p.t, { attack: 0.01, decay: 0.8, db: PLUCK_DB - 12 }); // the bell's 2.01x partial, simplified
    }
    bar += 1;
  }

  function tick() {
    const c = ctx();

    if (!playing || !c || engine.isHidden()) return;
    sources = sources.filter((s) => s.end > c.currentTime);
    while (nextAt < c.currentTime + LOOKAHEAD) {
      scheduleBar(nextAt);
      nextAt += BAR;
    }
  }

  function stopTimer() {
    if (timer != null) cancel(timer);
    timer = null;
  }

  function cutFuture(t) {
    for (const s of sources) {
      try {
        if (s.start > t) s.osc.stop(t);
      } catch {
        // Already stopped.
      }
    }
    sources = sources.filter((s) => s.start <= t && s.end > t);
  }

  function fadeTo(value, seconds) {
    const g = engine.musicBus()?.gain;
    const t = ctx().currentTime;

    if (!g) return;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(value, t + seconds);
  }

  function begin() {
    if (playing || !wanted || !isOn() || !engine.ready()) return;

    const c = ctx();

    playing = true;
    cutFuture(c.currentTime);
    nextAt = c.currentTime + 0.05;
    fadeTo(MUSIC_LEVEL, FADE_IN);
    tick();
    timer = every(tick, TICK_MS);
  }

  function halt(seconds) {
    stopTimer();
    if (!playing) return;
    playing = false;
    const c = ctx();

    if (!c) return;
    cutFuture(c.currentTime);
    fadeTo(0, seconds);
  }

  return {
    // Enter a round (Play pressed, or the Daily started). Starts at once if
    // the page has been tapped; otherwise on the first tap (onUnlock).
    start({ mode = 'play', seed: day } = {}) {
      if (day != null && !playing) {
        rand = seeded(day);
        bar = 0;
        history = [null, null];
      }
      review = mode === 'review';
      wanted = true;
      begin();
    },
    setMode(mode) {
      review = mode === 'review';
    },
    onUnlock: () => begin(),
    // Round finished: resolve to the home chord and fade over 3 s.
    resolve() {
      wanted = false;
      if (!playing) return;
      stopTimer();
      playing = false;
      const c = ctx();
      cutFuture(c.currentTime);
      pad(HOME, c.currentTime + 0.05, RESOLVE + 1);
      fadeTo(0, RESOLVE);
    },
    // Left the round (a tab, Back, the switch turned off).
    stop() {
      wanted = false;
      halt(FADE_OUT);
    },
    // The page was hidden: stop booking bars and fade; come back only if
    // still inside the round.
    pause() {
      halt(0.05);
    },
    resume() {
      if (wanted) begin();
    },
    // The Music switch changed.
    refresh() {
      if (!isOn()) halt(FADE_OUT);
      else begin();
    },
    isPlaying: () => playing,
    isWanted: () => wanted,
    _timer: () => timer,
  };
}
