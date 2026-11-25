import { loadHistory } from '../daily/calendar';
import { batchIsEmpty, buildBatch, markSent, noteLearning, onQueue, queueDailyResult, saveServerDays, setSyncUser, syncUser } from './queue';

// Account sync, the network part. App.jsx starts it when someone signs in and
// stops it when they sign out. It flushes the queue (src/sync/queue.js):
//   - at the end of a round (a finished Daily or drill flushes at once; card
//     reviews are batched a few seconds after the last one)
//   - when the app is hidden or comes back (visibilitychange) and when the
//     phone comes back online
//   - every 30 seconds while the app is open and visible
// Offline, nothing is lost: the queue waits in localStorage and replays.

const EVERY_MS = 30 * 1000;
const SOON_MS = 4 * 1000;
const PULL_DAYS = 400; // more than any streak needs
const guestKey = (user) => `mnemoq-sync-guest-${user}`;

let client = null;
let timers = { every: null, soon: null };
let inFlight = null;
let pulls = {};
let stopListeners = () => {};

function online() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function upsert(table, rows, onConflict) {
  const { error } = await client.from(table).upsert(rows, { onConflict });

  return !error;
}

// Sends what is queued. Never throws; a failure leaves the queue for next time.
export function flush() {
  if (!client || !syncUser() || !online()) return Promise.resolve(false);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const batch = buildBatch();

    if (batchIsEmpty(batch) || batch.user !== syncUser()) return true;

    const parts = { days: true, results: true, profile: true };

    try {
      if (batch.days.length) parts.days = await upsert('learning_days', batch.days, 'user_id,day');
      if (batch.results.length) parts.results = await upsert('daily_results', batch.results, 'user_id,number');
      if (batch.profile) parts.profile = await upsert('learner_profile', [batch.profile], 'user_id');
    } catch {
      return false;
    }

    markSent(batch, parts);

    return parts.days && parts.results && parts.profile;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

function flushSoon(when) {
  clearTimeout(timers.soon);

  if (when === 'now') {
    flush();
    return;
  }

  timers.soon = setTimeout(flush, SOON_MS);
}

function dhakaDaysAgo(n) {
  return new Date(Date.now() + 6 * 3600000 - n * 864e5).toISOString().slice(0, 10);
}

// The account's learning days, saved for the streak. One pull per sign-in;
// App.jsx waits for it before the review log, so the first streak shown
// already includes other devices. Offline it resolves at once with the
// device record (the last pulled days stay cached).
export function pullDays(user) {
  if (!client || !user) return Promise.resolve(false);
  if (pulls[user]) return pulls[user];

  pulls[user] = (async () => {
    if (!online()) return false;

    try {
      const { data, error } = await client.from('learning_days').select('day, sources').eq('user_id', user).gte('day', dhakaDaysAgo(PULL_DAYS)).limit(1000);

      if (error) return false;
      saveServerDays(user, data);
      return true;
    } catch {
      return false;
    } finally {
      if (!online()) delete pulls[user];
    }
  })();

  return pulls[user];
}

// The Daily history this device has from before the account existed (guest
// play), uploaded once per account on this device.
function uploadGuestHistory(user) {
  try {
    if (localStorage.getItem(guestKey(user))) return;

    for (const [number, play] of Object.entries(loadHistory().plays || {})) {
      if (!play?.at) continue;
      queueDailyResult(number, play, undefined, user);
      noteLearning('daily', play.at, undefined, user);
    }

    localStorage.setItem(guestKey(user), '1');
  } catch {
    // Blocked storage: nothing to upload.
  }
}

// -> stop()
export function startSync(supabase, user) {
  stopSync();
  if (!supabase || !user) return stopSync;

  client = supabase;
  setSyncUser(user);
  onQueue(flushSoon);
  uploadGuestHistory(user);
  pullDays(user);

  const onVisible = () => flush();
  const onOnline = () => {
    delete pulls[user];
    pullDays(user);
    flush();
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  timers.every = setInterval(() => {
    if (document.visibilityState !== 'hidden') flush();
  }, EVERY_MS);
  stopListeners = () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
  flush();

  return stopSync;
}

export function stopSync() {
  stopListeners();
  stopListeners = () => {};
  clearInterval(timers.every);
  clearTimeout(timers.soon);
  timers = { every: null, soon: null };
  onQueue(null);
  setSyncUser(null);
  client = null;
}
