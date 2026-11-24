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

// When each Daily round was finished (ISO times), for the shared streak.
export function playTimes(history = loadHistory()) {
  return Object.values(history.plays || {})
    .map((play) => play?.at)
    .filter(Boolean);
}
