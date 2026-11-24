// The Daily puzzle: which questions today, how a round is scored, the
// shareable result, and this device's play history. No React in here, so it
// is easy to test (tests/daily.test.js).

import { CATEGORIES, QUESTIONS } from './questions';

import { HISTORY_KEY, MAX_SCORE, ROUND_SIZE, dhakaDate, loadHistory, msUntilNext, puzzleNumber, streakOf } from './calendar';

export { MAX_SCORE, ROUND_SIZE, dhakaDate, loadHistory, msUntilNext, puzzleNumber, streakOf };

// Small seeded random numbers, so everyone gets the same order on the same day.
function seeded(seed) {
  let s = seed >>> 0;

  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;

  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);

  return h >>> 0;
}

function shuffled(list, rand) {
  const out = [...list];

  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

// One question per level (easiest first), five different categories, and every
// question used exactly once per cycle (5 days × questions per slot). The
// cycle's category order is reshuffled so the pattern does not repeat.
//
// Two rotations:
//  - Puzzles #1–#15 are FROZEN as they were with the first 75 questions
//    (3 per slot, 15-day cycle). They were live or announced before the pool
//    grew, so they must never change (tests/daily.test.js pins them).
//  - From #16 the full pool rotates: 6 per slot, a 30-day cycle. The first
//    15 days of each cycle start three questions further on, so #16–#30 show
//    the newest questions and the first 75 come back no sooner than #31.
const FROZEN_DAYS = 15;
const FROZEN_PER_SLOT = 3;
const PER_SLOT = QUESTIONS.length / (CATEGORIES.length * 5);
export const CYCLE_DAYS = 5 * PER_SLOT;
export const ROTATION_START = FROZEN_DAYS + 1;

function pick(cats, day, variant) {
  return [1, 2, 3, 4, 5].map((level) => {
    const category = cats[(level + day) % CATEGORIES.length];
    const slot = QUESTIONS.filter((item) => item.level === level && item.category === category);

    return withShuffledOptions(slot[variant]);
  });
}

export function questionsFor(number) {
  const index = Math.max(1, number) - 1;

  if (index < FROZEN_DAYS) {
    // The original rotation, cycle 0 (variant 0–2 by block of five days).
    const cats = shuffled(CATEGORIES, seeded(hash('cycle-0')));

    return pick(cats, index, Math.floor(index / 5) % FROZEN_PER_SLOT);
  }

  const rel = index - FROZEN_DAYS;
  const cycle = Math.floor(rel / CYCLE_DAYS);
  const day = rel % CYCLE_DAYS;
  const cats = shuffled(CATEGORIES, seeded(hash(`r2-cycle-${cycle}`)));
  const variant = (Math.floor(day / 5) + FROZEN_PER_SLOT + cycle) % PER_SLOT;

  return pick(cats, day, variant);
}

// The pool lists the right answer first; show the options in a fixed shuffled
// order instead (the same for every player and in both languages).
function withShuffledOptions(item) {
  const order = shuffled([0, 1, 2, 3], seeded(hash(item.id)));
  const pick = (side) => ({ ...side, options: order.map((i) => side.options[i]) });

  return { ...item, answer: order.indexOf(0), en: pick(item.en), bn: pick(item.bn) };
}

// ── Scoring ───────────────────────────────────────────────────
// Before seeing the answer you say how sure you are. Being sure and right
// earns the most; being sure and wrong costs. A guess costs nothing.
export const BETS = [
  { id: 'guess', stake: 1 },
  { id: 'think', stake: 2 },
  { id: 'sure', stake: 3 },
];

export function pointsFor(correct, betId) {
  const stake = BETS.find((b) => b.id === betId)?.stake ?? 1;

  return correct ? stake : -(stake - 1);
}

export function scoreOf(marks) {
  return marks.reduce((sum, m) => sum + pointsFor(m.correct, m.bet), 0);
}

// 🟩 right and sure, 🟨 right but unsure, 🟥 wrong and sure, ⬜ wrong, not sure.
export function squareFor({ correct, bet }) {
  if (correct) return bet === 'sure' ? '🟩' : '🟨';

  return bet === 'guess' ? '⬜' : '🟥';
}

export function shareText({ number, marks, lang = 'en', url = 'https://mnemoq-two.vercel.app/daily' }) {
  const score = scoreOf(marks);
  const grid = marks.map(squareFor).join('');
  const n = (value) => (lang === 'bn' ? value.toLocaleString('bn-BD') : String(value));
  const title = lang === 'bn' ? `Mnemoq ডেইলি #${n(number)} · ${n(score)}/${n(MAX_SCORE)}` : `Mnemoq Daily #${number} · ${score}/${MAX_SCORE}`;

  return `${title}\n${grid}\n${url}`;
}

// ── This device's history (loading it lives in calendar.js) ──
export function saveRound(number, marks) {
  const history = loadHistory();

  history.plays[number] = { marks, score: scoreOf(marks), at: new Date().toISOString() };

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Private mode: the round still shows, it just is not remembered.
  }

  return history;
}
