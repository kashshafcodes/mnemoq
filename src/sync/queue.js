import { dhakaDate } from '../daily/calendar';

// Account sync, the part with no network (src/sync/sync.js does the calls).
// Spec: company/product/phase2-glow-memory-map.md §8. Tables (supabase/account-sync.sql):
//   learning_days    one row per Dhaka day with any learning: actions, sources {review, daily, drill, snap}
//   daily_results    one row per Daily puzzle played
//   learner_profile  the app language (milestones and Glow level arrive in wave 3)
//
// Everything waits in localStorage until it is sent, so offline work is never
// lost; it is replayed on the next flush. Every write is an upsert of absolute
// values (never "+1"), so sending the same batch twice changes nothing.
// Guest play stays on the device: nothing is queued without a signed-in user.

export const QUEUE_KEY = 'mnemoq-sync';
export const SERVER_KEY = 'mnemoq-sync-server';
export const LEARNING_SOURCES = ['review', 'daily', 'drill', 'snap'];
const KEEP_DAYS = 60; // the device tally only needs days that may still be unsent

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(store, key, fallback) {
  try {
    const value = JSON.parse(store?.getItem(key) || 'null');

    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function write(store, key, value) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the account just misses this one.
  }
}

const empty = (user = null, lang = null) => ({ user, days: {}, dirty: [], results: {}, lang });

// ---- who is signed in --------------------------------------------------------

let activeUser = null;
let onQueued = null;

// Called by sync.js. A different user than the queue's owner starts a fresh
// queue (one person's offline work never goes to another account); the app
// language is per device, so it carries over.
export function setSyncUser(user, store = storage()) {
  activeUser = user || null;
  if (!activeUser) return;

  const state = loadQueue(store);

  if (state.user !== activeUser) write(store, QUEUE_KEY, empty(activeUser, state.lang));
}

export function syncUser() {
  return activeUser;
}

// sync.js listens here to flush (soon, or now for the end of a round).
export function onQueue(listener) {
  onQueued = listener;
}

export function loadQueue(store = storage()) {
  const state = read(store, QUEUE_KEY, null);

  if (!state) return empty();

  return {
    user: state.user || null,
    days: state.days && typeof state.days === 'object' ? state.days : {},
    dirty: Array.isArray(state.dirty) ? state.dirty : [],
    results: state.results && typeof state.results === 'object' ? state.results : {},
    lang: state.lang === 'bn' || state.lang === 'en' ? state.lang : null,
  };
}

// ---- queueing ------------------------------------------------------------------

// One learning action (a card review, a finished Daily, drill or snap) bumps
// that Dhaka day's row.
export function noteLearning(kind, at = new Date(), store = storage(), user = activeUser) {
  if (!user || !LEARNING_SOURCES.includes(kind)) return;

  const state = loadQueue(store);

  if (state.user !== user) return;

  const day = dhakaDate(new Date(at));
  const sources = { ...(state.days[day] || {}) };

  sources[kind] = (Number(sources[kind]) || 0) + 1;
  state.days[day] = sources;
  if (!state.dirty.includes(day)) state.dirty.push(day);

  const keep = Object.keys(state.days).sort().slice(-KEEP_DAYS);
  state.days = Object.fromEntries(keep.map((d) => [d, state.days[d]]));
  state.dirty = state.dirty.filter((d) => state.days[d]);
  write(store, QUEUE_KEY, state);
  onQueued?.(kind === 'daily' || kind === 'drill' ? 'now' : 'soon');
}

// One Daily play: { marks, score, at } as saved by the Daily (src/daily/puzzle.js).
export function queueDailyResult(number, play, store = storage(), user = activeUser) {
  const n = Number(number);

  if (!user || !Number.isInteger(n) || n < 1 || !play?.at) return;

  const state = loadQueue(store);

  if (state.user !== user) return;

  state.results[n] = { score: Number(play.score) || 0, marks: Array.isArray(play.marks) ? play.marks : [], played_at: play.at };
  write(store, QUEUE_KEY, state);
}

// The app language, for learner_profile.lang. Kept even before sign-in.
export function queueLang(lang, store = storage()) {
  const state = loadQueue(store);

  state.lang = lang === 'bn' ? 'bn' : 'en';
  write(store, QUEUE_KEY, state);
  onQueued?.('soon');
}

// ---- merging with the account ---------------------------------------------------

// Per source, the larger count. Max (not sum) keeps a replayed or repeated
// write idempotent; a second device's counts may be under-counted, which only
// affects the "actions" number, never whether a day counts.
export function mergeSources(server = {}, device = {}) {
  const out = {};

  for (const source of new Set([...Object.keys(server || {}), ...Object.keys(device || {})])) {
    const n = Math.max(Number(server?.[source]) || 0, Number(device?.[source]) || 0);

    if (n > 0) out[source] = n;
  }

  return out;
}

const total = (sources) => Object.values(sources).reduce((sum, n) => sum + (Number(n) || 0), 0);

export function loadServer(store = storage()) {
  const cache = read(store, SERVER_KEY, null);

  return cache && cache.days && typeof cache.days === 'object' ? cache : { user: null, days: {} };
}

// The days pulled from the account on sign-in: { day: sources }.
export function saveServerDays(user, rows, store = storage()) {
  const days = {};

  for (const row of rows || []) {
    if (row?.day) days[String(row.day).slice(0, 10)] = row.sources && typeof row.sources === 'object' ? row.sources : {};
  }

  write(store, SERVER_KEY, { user, days });
}

// What one flush sends. -> { user, days: [rows], results: [rows], profile: row | null }
export function buildBatch(store = storage()) {
  const state = loadQueue(store);
  const user = state.user;

  if (!user) return { user: null, days: [], results: [], profile: null };

  const server = loadServer(store);
  const known = server.user === user ? server.days : {};
  const days = state.dirty
    .filter((day) => state.days[day])
    .map((day) => {
      const sources = mergeSources(known[day], state.days[day]);

      return { user_id: user, day, actions: total(sources), sources };
    });
  const results = Object.entries(state.results).map(([number, row]) => ({ user_id: user, number: Number(number), ...row }));

  return { user, days, results, profile: state.lang ? { user_id: user, lang: state.lang } : null };
}

// After a part of the batch was saved: drop exactly what was sent (anything
// queued meanwhile stays), and remember the merged days as the account's.
export function markSent(batch, parts = { days: true, results: true, profile: true }, store = storage()) {
  const state = loadQueue(store);

  if (!batch?.user || state.user !== batch.user) return;

  if (parts.days) {
    const server = loadServer(store);
    const days = server.user === state.user ? { ...server.days } : {};

    for (const row of batch.days) {
      days[row.day] = row.sources;
      const now = mergeSources(days[row.day], state.days[row.day]);
      // Still dirty only if something new was queued while this was in flight.
      if (total(now) === total(row.sources)) state.dirty = state.dirty.filter((d) => d !== row.day);
    }

    write(store, SERVER_KEY, { user: state.user, days });
  }

  if (parts.results) {
    for (const row of batch.results) {
      if (state.results[row.number]?.played_at === row.played_at) delete state.results[row.number];
    }
  }

  if (parts.profile && batch.profile && state.lang === batch.profile.lang) state.lang = null;

  write(store, QUEUE_KEY, state);
}

export function batchIsEmpty(batch) {
  return batch.days.length === 0 && batch.results.length === 0 && !batch.profile;
}

// The account's learning days, as times computeStreaks understands (noon in
// Dhaka, so the day is the same in any nearby time zone). Only while the
// account that owns them is signed in; signed out, the device record alone counts.
export function serverDayTimes(store = storage(), user = activeUser) {
  const server = loadServer(store);

  if (!user || server.user !== user) return [];

  return Object.keys(server.days).map((day) => `${day}T12:00:00+06:00`);
}
