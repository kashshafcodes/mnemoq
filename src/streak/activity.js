import { playTimes } from '../daily/calendar';
import { noteLearning, serverDayTimes } from '../sync/queue';

// The one streak counts every kind of learning, not just card reviews:
//   reviews        (the review log, passed to computeStreaks directly)
//   Daily rounds   (src/daily/calendar.js)
//   drills         a finished 5-question drill in Today's round
//   snaps          a card made with Snap a mistake
// Drills and snaps are kept on this device, like Daily plays. When signed in,
// the days saved to the account (learning_days, src/sync/) join the list, so
// the streak matches across devices; signed out or offline, the device record
// is the fallback.

const KEY = 'mnemoq-activity';
const KEEP = 400; // about a year of days, more than any streak needs

export const SOURCES = ['drill', 'snap'];

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadActivity(store = storage()) {
  try {
    const list = JSON.parse(store?.getItem(KEY) || '[]');

    return Array.isArray(list) ? list.filter((item) => item && SOURCES.includes(item.kind) && item.at) : [];
  } catch {
    return [];
  }
}

// Remembers one learning action. Keeps one entry per kind per day.
export function recordActivity(kind, at = new Date(), store = storage()) {
  if (!SOURCES.includes(kind) || !store) return;

  const iso = new Date(at).toISOString();
  const day = iso.slice(0, 10);
  const list = loadActivity(store).filter((item) => !(item.kind === kind && String(item.at).slice(0, 10) === day));

  list.push({ kind, at: iso });

  try {
    store.setItem(KEY, JSON.stringify(list.slice(-KEEP)));
  } catch {
    // Storage full or blocked: the streak just misses this one.
  }

  noteLearning(kind, at);
}

// Every non-review moment that counts as a day of study, for computeStreaks'
// `extraDays`.
export function streakTimes({ plays = playTimes(), activity = loadActivity(), account = serverDayTimes() } = {}) {
  return [...plays, ...activity.map((item) => item.at), ...account];
}
