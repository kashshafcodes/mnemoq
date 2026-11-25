import { streakFromNumbers } from '../glow/streak';

// The Daily's calendar and this device's play history, without the question
// pool. Home, the Play button and the streak need only this, so the 150
// questions stay out of the app's first download (puzzle.js re-exports it all).

// Puzzle #1 is 23 November 2026, Bangladesh time. A new one starts at midnight in Dhaka.
const FIRST_DAY = '2026-11-23';
const ZONE = 'Asia/Dhaka';
const DAY_MS = 24 * 60 * 60 * 1000;
export const ROUND_SIZE = 5;
export const MAX_SCORE = ROUND_SIZE * 3;

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

// ── This device's history ─────────────────────────────────────
export const HISTORY_KEY = 'mnemoq-daily';

export function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');

    return saved && typeof saved === 'object' && saved.plays ? saved : { plays: {} };
  } catch {
    return { plays: {} };
  }
}

// The Daily's streak on /daily (no account there): the one streak rule
// (src/glow/streak.js, 2 free rest days in any 7) on puzzle numbers, which are
// Dhaka days. Inside the app the Daily shows computeStreaks, the same rule
// with every kind of learning.
export function streakOf(history, today) {
  const played = Object.keys(history.plays || {}).filter((n) => history.plays[n]).map(Number);

  return streakFromNumbers(played, today).current;
}

// When each Daily round was finished (ISO times), for the shared streak.
export function playTimes(history = loadHistory()) {
  return Object.values(history.plays || {})
    .map((play) => play?.at)
    .filter(Boolean);
}
