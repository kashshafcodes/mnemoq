// The event map (spec phase2-sensory 1.3): for each moment, the sound (a
// palette id), the haptic (a pattern name, or null: no haptic is a decision),
// the motion class added to the element, and Jonaki's mood.
// A test fails if an event misses any of the four.

export const EVENTS = {
  'tap.primary': { sound: 'tap.primary', haptic: 'tap', motion: 'fx-press', mood: 'idle' },
  'tap.secondary': { sound: 'tap.secondary', haptic: null, motion: 'fx-press', mood: 'idle' },
  select: { sound: 'select', haptic: 'select', motion: 'fx-press', mood: 'idle' },
  'card.flip': { sound: 'card.flip', haptic: 'flip', motion: 'fx-flip', mood: 'think' },
  'card.reveal': { sound: 'card.reveal', haptic: 'reveal', motion: 'fx-flip', mood: 'think' },
  correct: { sound: 'correct', haptic: 'correct', motion: 'fx-pop', mood: 'happy' },
  almost: { sound: 'almost', haptic: 'almost', motion: 'fx-hold', mood: 'think' },
  // The shipped double buzz stays until the owner's phone test (D5); then
  // the pattern becomes a single 30 ms pulse in haptics.js.
  wrong: { sound: 'wrong', haptic: 'wrong', motion: 'fx-soft-shake', mood: 'oops' },
  'step.done': { sound: 'step.done', haptic: 'stepDone', motion: 'fx-ring', mood: 'happy' },
  'round.done': { sound: 'round.done', haptic: 'roundDone', motion: 'fx-celebrate', mood: 'wow' },
  'streak.kept': { sound: 'streak.kept', haptic: 'ember', motion: 'fx-ember', mood: 'happy' },
  'glow.gain': { sound: 'glow.gain', haptic: null, motion: 'fx-spark1', mood: 'idle' },
  'level.up': { sound: 'level.up', haptic: 'levelUp', motion: 'fx-celebrate', mood: 'wow' },
  milestone: { sound: 'milestone', haptic: 'milestone', motion: 'fx-celebrate', mood: 'wow' },
  'snap.shutter': { sound: 'snap.shutter', haptic: 'snapShutter', motion: 'fx-press', mood: 'think' },
  'snap.made': { sound: 'snap.made', haptic: 'snapMade', motion: 'fx-pop', mood: 'happy' },
  error: { sound: 'error', haptic: 'error', motion: 'fx-soft-shake', mood: 'oops' },
  'toggle.on': { sound: 'toggle.on', haptic: 'toggle', motion: 'fx-press', mood: 'idle' },
  'toggle.off': { sound: 'toggle.off', haptic: 'toggle', motion: 'fx-press', mood: 'idle' },
  'count.tick': { sound: 'count.tick', haptic: null, motion: null, mood: 'idle' },
};

// Reduced motion (D7) keeps the sound but shrinks a celebration to the first
// two notes of round.done.
export const REDUCED_SOUND = { 'round.done': 'round.short', 'level.up': 'round.short', milestone: 'round.short' };
