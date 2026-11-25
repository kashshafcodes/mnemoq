// The one streak, with free rest days (pure). Spec:
// company/product/phase2-glow-memory-map.md §3.
//
// A day is a Dhaka calendar day. The streak is unbroken while every 7
// consecutive days hold at most 2 missed days; the number is the count of
// learning days in the chain (rest days are shown, not counted). Rest days are
// automatic and free: nothing is bought, spent or tapped.
//
// Used by computeStreaks (src/analytics.js) for the app and by streakOf
// (src/daily/calendar.js) for the Daily, so there is one number everywhere.

const DAY = 864e5;
const DHAKA = 6 * 3600000; // UTC+6, no daylight saving
export const REST_DAYS = 2;
export const WINDOW = 7;
export const STRIP_DAYS = 14;

// "2026-11-25" for a moment, in Dhaka. Same answer as dhakaDate() in
// src/daily/calendar.js, without building an Intl formatter per call (the
// review log can hold thousands of entries).
export function dhakaKey(at) {
  const t = at instanceof Date ? at.getTime() : new Date(at).getTime();

  return Number.isFinite(t) ? new Date(t + DHAKA).toISOString().slice(0, 10) : null;
}

const toNumber = (key) => Math.round(Date.parse(`${key}T00:00:00Z`) / DAY);
const toKey = (n) => new Date(n * DAY).toISOString().slice(0, 10);

// The chain ending at T: { current, start } where start is the oldest
// learning day in it (null when there is none).
function chainAt(D, T, earliest) {
  let cur = D.has(T) ? 1 : 0;
  let start = cur ? T : null;
  const missed = [];

  for (let d = T - 1; d >= earliest; d -= 1) {
    if (D.has(d)) {
      cur += 1;
      start = d;
    } else {
      missed.push(d);
      // A third miss inside one 7-day window ends the chain.
      if (missed.filter((m) => m <= d + WINDOW - 1).length > REST_DAYS) break;
    }
  }

  return { current: cur, start };
}

// The core, on whole day numbers (any consecutive integers: Dhaka days or
// Daily puzzle numbers). `days` is an iterable of numbers, T is today.
export function streakFromNumbers(days, T) {
  const D = new Set([...days].filter(Number.isFinite));
  const past = [...D].filter((d) => d <= T);

  if (past.length === 0) {
    return { current: 0, best: 0, reviewedToday: false, restUsed: 0, atRisk: false, strip: strip(D, T, null, null) };
  }

  const earliest = Math.min(...past);
  const { current, start } = chainAt(D, T, earliest);
  const reviewedToday = D.has(T);
  let restUsed = 0;

  if (current > 0) {
    for (let d = Math.max(T - (WINDOW - 1), start); d <= T - 1; d += 1) if (!D.has(d)) restUsed += 1;
  }

  let best = current;

  for (const t of past) best = Math.max(best, chainAt(D, t, earliest).current);

  return {
    current,
    best,
    reviewedToday,
    restUsed,
    atRisk: current > 0 && !reviewedToday && restUsed === REST_DAYS,
    strip: strip(D, T, earliest, current > 0 ? start : null),
  };
}

// The last 14 days, oldest first: lit, rest (a miss the chain absorbed),
// gap (a miss outside the chain, never shown as red), today, before (before
// the first learning day).
function strip(D, T, earliest, start) {
  const out = [];

  for (let d = T - (STRIP_DAYS - 1); d <= T; d += 1) {
    let state;

    if (D.has(d)) state = 'lit';
    else if (d === T) state = 'today';
    else if (earliest === null || d < earliest) state = 'before';
    else if (start !== null && d > start) state = 'rest';
    else state = 'gap';

    out.push({ n: d, state });
  }

  return out;
}

// Dates or ISO times -> the streak, on Dhaka days.
//   { current, best, reviewedToday, restUsed, atRisk, days: [{ day, state }] }
export function streakFromTimes(times = [], now = new Date()) {
  const keys = new Set();

  for (const at of times) {
    const key = at ? dhakaKey(at) : null;
    if (key) keys.add(key);
  }

  const { strip: lastDays, ...rest } = streakFromNumbers([...keys].map(toNumber), toNumber(dhakaKey(now)));

  return { ...rest, days: lastDays.map(({ n, state }) => ({ day: toKey(n), state })) };
}
