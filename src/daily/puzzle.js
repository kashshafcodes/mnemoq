// The Daily puzzle: which questions today, how a round is scored, the
// shareable result, and this device's play history. No React in here, so it
// is easy to test (tests/daily.test.js).

import { CATEGORIES, QUESTIONS } from './questions';

// Puzzle #1 is 23 November 2026, Bangladesh time. A new one starts at midnight in Dhaka.
const FIRST_DAY = '2026-11-23';
const ZONE = 'Asia/Dhaka';
const DAY_MS = 24 * 60 * 60 * 1000;
export const ROUND_SIZE = 5;

// "2026-11-23" for a moment, in Dhaka time.
export function dhakaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function puzzleNumber(now = new Date()) {
  const days = Math.round((Date.parse(dhakaDate(now)) - Date.parse(FIRST_DAY)) / DAY_MS);

  return Math.max(1, days + 1);
}

// Milliseconds until the next puzzle (midnight in Dhaka, UTC+6, no daylight saving).
export function msUntilNext(now = new Date()) {
  const next = Date.parse(`${dhakaDate(now)}T00:00:00+06:00`) + DAY_MS;

  return Math.max(0, next - now.getTime());
}

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
const PER_SLOT = QUESTIONS.length / (CATEGORIES.length * 5);
export const CYCLE_DAYS = 5 * PER_SLOT;

export function questionsFor(number) {
  const index = number - 1;
  const cycle = Math.floor(index / CYCLE_DAYS);
  const day = index % CYCLE_DAYS;
  const cats = shuffled(CATEGORIES, seeded(hash(`cycle-${cycle}`)));
  const variant = (Math.floor(day / 5) + cycle) % PER_SLOT;

  return [1, 2, 3, 4, 5].map((level) => {
    const category = cats[(level + day) % CATEGORIES.length];
    const slot = QUESTIONS.filter((item) => item.level === level && item.category === category);

    return withShuffledOptions(slot[variant]);
  });
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

export const MAX_SCORE = ROUND_SIZE * 3;

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

// ── This device's history ─────────────────────────────────────
const KEY = 'mnemoq-daily';

export function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');

    return saved && typeof saved === 'object' && saved.plays ? saved : { plays: {} };
  } catch {
    return { plays: {} };
  }
}

export function saveRound(number, marks) {
  const history = loadHistory();

  history.plays[number] = { marks, score: scoreOf(marks), at: new Date().toISOString() };

  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    // Private mode: the round still shows, it just is not remembered.
  }

  return history;
}

// Days in a row ending today (or yesterday, if today is not played yet).
export function streakOf(history, today) {
  const played = (n) => Boolean(history.plays?.[n]);
  let day = played(today) ? today : today - 1;
  let streak = 0;

  while (day >= 1 && played(day)) {
    streak += 1;
    day -= 1;
  }

  return streak;
}
