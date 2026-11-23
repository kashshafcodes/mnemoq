// Sound for the Daily: short effects and a quiet generative night-time track,
// all synthesised with the Web Audio API (no files to download, nothing to
// license). Everything is soft, warm and pentatonic so it never grates.
//
// Browsers only allow audio after a tap, so the context is created lazily on
// the first sound, which always follows a user gesture.

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let reverb = null;

// D major pentatonic, a calm "night by the river" colour.
const SCALE = [0, 2, 4, 7, 9];
const ROOT = 62; // D4
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const note = (step, octave = 0) => ROOT + 12 * (octave + Math.floor(step / 5)) + SCALE[((step % 5) + 5) % 5];

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  const AC = window.AudioContext || window.webkitAudioContext;

  if (!AC) return null;

  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // A cheap, pleasant "room": a feedback delay through a low-pass filter.
  reverb = ctx.createDelay(1);
  reverb.delayTime.value = 0.23;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2400;
  reverb.connect(tone);
  tone.connect(feedback);
  feedback.connect(reverb);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  tone.connect(wet);
  wet.connect(master);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.55;
  sfxBus.connect(master);
  sfxBus.connect(reverb);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  musicBus.connect(reverb);

  return ctx;
}

// One enveloped oscillator voice.
function voice({ freq, type = 'sine', at = 0, attack = 0.005, decay = 0.25, peak = 0.3, bus, detune = 0, glideTo }) {
  const c = ensure();

  if (!c) return;

  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + attack + decay);
  osc.detune.value = detune;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  osc.connect(env);
  env.connect(bus || sfxBus);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

// A soft bell: a sine plus a quiet overtone.
function bell(midi, at = 0, peak = 0.22, decay = 0.9) {
  voice({ freq: hz(midi), at, peak, decay });
  voice({ freq: hz(midi) * 2.01, at, peak: peak * 0.25, decay: decay * 0.5 });
}

// ── Settings ──────────────────────────────────────────────────
const KEY = 'mnemoq-daily-sound';
const DEFAULTS = { sound: true, music: false, haptics: true };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not remembered; fine.
  }
}

let soundOn = loadSettings().sound;

export function setSoundOn(on) {
  soundOn = on;
}

const play = (fn) => (...args) => {
  if (!soundOn) return;

  try {
    fn(...args);
  } catch {
    // Audio is a nicety; never let it break the game.
  }
};

// ── Effects ───────────────────────────────────────────────────
export const sfx = {
  tap: play(() => voice({ freq: 1400, type: 'triangle', peak: 0.08, decay: 0.05 })),
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
  }),
  wrong: play((stake = 1) => {
    voice({ freq: 196, type: 'sine', peak: 0.22, decay: 0.35, glideTo: 130 });
    voice({ freq: 233, type: 'triangle', peak: 0.06 + stake * 0.02, decay: 0.3, at: 0.04, glideTo: 150 });
  }),
  next: play(() => voice({ freq: hz(note(7)), type: 'sine', peak: 0.09, decay: 0.18, glideTo: hz(note(9)) })),
  tick: play(() => voice({ freq: 2200, type: 'square', peak: 0.025, decay: 0.02 })),
  // One note per question on the result screen, so every round has a tune.
  melody: play((i, correct) => bell(correct ? note(5 + [0, 2, 4, 3, 5][i % 5]) : note(i % 5, -1), 0, correct ? 0.2 : 0.1, correct ? 1.1 : 0.5)),
  fanfare: play((share = 1) => {
    const run = share >= 0.99 ? [5, 7, 9, 10, 12, 14] : share >= 0.6 ? [5, 7, 9, 10] : [5, 7, 9];
    run.forEach((s, i) => bell(note(s), i * 0.09, 0.18, 1.2));
  }),
  start: play(() => [0, 2, 4, 5].forEach((s, i) => bell(note(s + 3), i * 0.08, 0.15, 0.9))),
};

// ── Music: a slow pad and sparse "firefly" plucks ─────────────
let musicTimer = null;
let musicStep = 0;
const CHORDS = [
  [0, 2, 4],
  [3, 5, 7],
  [1, 4, 6],
  [2, 4, 7],
];

function padChord(chord, at, length) {
  for (const s of chord) {
    const f = hz(note(s, -1));
    voice({ freq: f, type: 'sine', at, attack: 1.4, decay: length, peak: 0.07, bus: musicBus });
    voice({ freq: f, type: 'triangle', at, attack: 1.8, decay: length, peak: 0.025, bus: musicBus, detune: 7 });
  }

  voice({ freq: hz(note(chord[0], -2)), type: 'sine', at, attack: 1, decay: length, peak: 0.06, bus: musicBus });
}

function bar() {
  const c = ensure();

  if (!c) return;

  const chord = CHORDS[musicStep % CHORDS.length];

  padChord(chord, 0, 6.5);

  // Two to four quiet plucks at random moments, like fireflies blinking.
  const plucks = 2 + Math.floor(Math.random() * 3);

  for (let i = 0; i < plucks; i += 1) {
    const s = chord[Math.floor(Math.random() * 3)] + 5 * (1 + Math.floor(Math.random() * 2));
    const at = 0.6 + Math.random() * 5;
    voice({ freq: hz(note(s)), type: 'sine', at, attack: 0.01, decay: 1.6, peak: 0.05, bus: musicBus });
  }

  musicStep += 1;
}

export function setMusicOn(on) {
  const c = ensure();

  if (!c) return;

  const now = c.currentTime;

  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(musicBus.gain.value, now);

  if (on) {
    musicBus.gain.linearRampToValueAtTime(0.8, now + 2);

    if (!musicTimer) {
      bar();
      musicTimer = setInterval(bar, 6000);
    }
  } else {
    musicBus.gain.linearRampToValueAtTime(0, now + 0.8);
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

// Pause music while the tab is hidden, resume when it comes back.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}
