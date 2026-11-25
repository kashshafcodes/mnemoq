// The sound palette as data: one instrument (the "lantern bell", two sine
// partials, the second at 2.01x and 12 dB down) in one key (D major
// pentatonic). Ported from the mockup's SOUNDS table
// (company/product/phase2-sensory-mockup.html), which is the source of truth.
//
// A note: { m: MIDI, t: start ms, d: decay ms, lv: peak dBFS at the master,
//   lp: lowpass Hz (default 5000), g: glide in semitones, p2: partial-2 level
//   (default 0.25), a: attack ms (default 5), noise: a 12 ms shutter tick }

export const RANK = { micro: 0, ui: 1, feedback: 2, reward: 3, hero: 4 };

// The most the summed voice peaks of one sound may reach, per class (dBFS).
export const CLASS_CAP = { micro: -30, ui: -24, feedback: -17, reward: -13, hero: -9 };

// How much of each class goes to the shared reverb.
export const REVERB_SEND = { micro: 0, ui: 0.06, feedback: 0.12, reward: 0.2, hero: 0.28 };

// D major pentatonic pitch classes: D E F# A B.
export const PENTATONIC = new Set([2, 4, 6, 9, 11]);
export const inKey = (m) => PENTATONIC.has(((m % 12) + 12) % 12);
export const hz = (m) => 440 * 2 ** ((m - 69) / 12);
export const dbToGain = (db) => 10 ** (db / 20);

const pad = (d, a) => [
  { m: 62, t: 0, d, lv: -30, a, lp: 900 },
  { m: 69, t: 0, d, lv: -32, a, lp: 900 },
];

export const SOUNDS = {
  'tap.primary': { cls: 'ui', notes: [{ m: 86, t: 0, d: 70, lv: -30, lp: 5000 }] },
  'tap.secondary': { cls: 'micro', notes: [{ m: 81, t: 0, d: 45, lv: -36, lp: 4000 }] },
  select: { cls: 'ui', notes: [{ m: 78, t: 0, d: 110, lv: -30 }] },
  'card.flip': { cls: 'ui', notes: [{ m: 71, t: 0, d: 90, lv: -34, lp: 3500, g: 0.4 }] },
  'card.reveal': { cls: 'ui', notes: [{ m: 76, t: 0, d: 200, lv: -28 }, { m: 81, t: 50, d: 260, lv: -28 }] },
  correct: { cls: 'feedback', notes: [{ m: 74, t: 0, d: 450, lv: -22 }, { m: 78, t: 70, d: 550, lv: -21 }] },
  almost: { cls: 'feedback', notes: [{ m: 76, t: 0, d: 420, lv: -23, lp: 3500 }] },
  wrong: { cls: 'feedback', notes: [{ m: 57, t: 0, d: 320, lv: -22, lp: 1100, g: -3, p2: 0.5 }] },
  'step.done': { cls: 'feedback', notes: [{ m: 74, t: 0, d: 600, lv: -24 }, { m: 81, t: 60, d: 700, lv: -23 }] },
  'round.done': {
    cls: 'reward',
    notes: [
      { m: 74, t: 0, d: 700, lv: -21 },
      { m: 78, t: 90, d: 800, lv: -21 },
      { m: 83, t: 180, d: 900, lv: -21 },
      { m: 86, t: 270, d: 1300, lv: -20 },
      ...pad(1400, 120),
    ],
  },
  // Reduced motion (D7): a celebration keeps only its first two notes.
  'round.short': { cls: 'reward', notes: [{ m: 74, t: 0, d: 700, lv: -21 }, { m: 78, t: 90, d: 800, lv: -21 }] },
  'streak.kept': { cls: 'reward', notes: [{ m: 83, t: 0, d: 900, lv: -22 }, { m: 86, t: 130, d: 1200, lv: -23 }] },
  'glow.gain': { cls: 'ui', notes: [{ m: 81, t: 0, d: 160, lv: -34 }] },
  // "+5" or more rings a step higher (B5).
  'glow.gain.big': { cls: 'ui', notes: [{ m: 83, t: 0, d: 160, lv: -34 }] },
  'level.up': {
    cls: 'hero',
    notes: [74, 76, 78, 81, 83, 86].map((m, i) => ({ m, t: i * 80, d: i === 5 ? 1500 : 600, lv: -21 })).concat(pad(1700, 150)),
  },
  milestone: {
    cls: 'hero',
    notes: [
      { m: 74, t: 0, d: 1800, lv: -22 },
      { m: 78, t: 0, d: 1800, lv: -23 },
      { m: 81, t: 0, d: 1800, lv: -23 },
      { m: 86, t: 250, d: 2000, lv: -22 },
    ],
  },
  'snap.shutter': { cls: 'ui', notes: [{ m: 83, t: 0, d: 40, lv: -30, lp: 6000, noise: true }] },
  'snap.made': { cls: 'feedback', notes: [{ m: 76, t: 0, d: 500, lv: -23 }, { m: 81, t: 70, d: 500, lv: -23 }, { m: 86, t: 140, d: 800, lv: -23 }] },
  error: { cls: 'feedback', notes: [{ m: 69, t: 0, d: 220, lv: -24, lp: 1400 }, { m: 66, t: 130, d: 320, lv: -25, lp: 1200 }] },
  'toggle.on': { cls: 'micro', notes: [{ m: 86, t: 0, d: 60, lv: -34 }] },
  'toggle.off': { cls: 'micro', notes: [{ m: 81, t: 0, d: 60, lv: -36 }] },
  'count.tick': { cls: 'micro', notes: [{ m: 81, t: 0, d: 18, lv: -38 }] },
  // A count-up climbs the pentatonic from A5: feel('count.tick', { step }).
  ...Object.fromEntries([81, 83, 86, 88, 90].map((m, i) => [`count.tick.${i}`, { cls: 'micro', notes: [{ m, t: 0, d: 18, lv: -38 }] }])),

  // The Daily's four retuned sounds (D8). Its correct, fanfare, start and
  // melody stay exactly as they were (src/daily/audio.js).
  'daily.tap': { cls: 'ui', notes: [{ m: 86, t: 0, d: 60, lv: -31, lp: 5000 }] },
  // Was a 2.2 kHz square (the harshest sound in the app): now a soft A5 tick.
  'daily.tick': { cls: 'micro', notes: [{ m: 81, t: 0, d: 22, lv: -38, lp: 4000 }] },
  // Was a 196 Hz sine (inaudible on a phone): now the shared soft "not yet".
  'daily.wrong': { cls: 'feedback', notes: [{ m: 57, t: 0, d: 340, lv: -22, lp: 1100, g: -3, p2: 0.5 }] },
  // F#5 rising to B5, a gentle "on we go".
  'daily.next': { cls: 'ui', notes: [{ m: 78, t: 0, d: 160, lv: -31, g: 5 }] },
};

// The longest note end of a sound, in ms.
export const lengthOf = (id) => Math.max(...SOUNDS[id].notes.map((n) => n.t + (n.a || 5) + n.d));
