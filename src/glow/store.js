import { useSyncExternalStore } from 'react';
import { applyAward, award } from './glow';
import { dhakaKey } from './streak';
import { noteGlow, serverGlowDays, syncUser } from '../sync/queue';
import { feel } from '../sensory';
import { track } from '../track';
import { trackEvent } from '../googleAnalytics';

// Glow on this device: the ledger, the lifetime total and the hook the
// screens read. The rules are in glow.js; this file only remembers.
//
// One ledger per account on this device (guests get their own), in
// localStorage: { days: { 'YYYY-MM-DD': { glow, extra, keys, snaps, capped } }, ever: [keys] }
//   glow   Glow under the daily cap      extra  diagnostics and mocks (outside it)
// When signed in, each day's total goes to learning_days through src/sync/
// as this device's own entry, so phones add up without double counting.

const DEVICE_KEY = 'mnemoq-device';
const ledgerKey = (user) => `mnemoq-glow-${user || 'guest'}`;

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// A random id for this browser, so its Glow is its own entry on the account.
export function deviceId(store = storage()) {
  try {
    let id = store?.getItem(DEVICE_KEY);

    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      store?.setItem(DEVICE_KEY, id);
    }

    return id || 'device';
  } catch {
    return 'device';
  }
}

export function loadLedger(store = storage(), user = syncUser()) {
  try {
    const saved = JSON.parse(store?.getItem(ledgerKey(user)) || 'null');

    if (saved && typeof saved === 'object') {
      return { days: saved.days && typeof saved.days === 'object' ? saved.days : {}, ever: Array.isArray(saved.ever) ? saved.ever : [], seen: saved.seen || null };
    }
  } catch {
    // Unreadable: start again (the account still has the synced days).
  }

  return { days: {}, ever: [], seen: null };
}

function saveLedger(ledger, store, user) {
  // Keys only matter today (once per card per day); older days keep totals.
  const today = dhakaKey(new Date());
  const days = Object.fromEntries(
    Object.entries(ledger.days).map(([day, rec]) => [day, day >= today ? rec : { glow: rec.glow || 0, extra: rec.extra || 0 }]),
  );

  try {
    store?.setItem(ledgerKey(user), JSON.stringify({ ...ledger, days }));
  } catch {
    // Storage full or blocked: this Glow is only on screen.
  }
}

const dayTotal = (rec) => (rec?.glow || 0) + (rec?.extra || 0);

// Lifetime Glow: this device's days plus every other device's entries on the
// account. This device's own account entry is never added twice.
export function lifetimeGlow(store = storage(), user = syncUser(), device = deviceId(store)) {
  const ledger = loadLedger(store, user);
  const account = serverGlowDays(store, user);
  let sum = 0;

  for (const day of new Set([...Object.keys(ledger.days), ...Object.keys(account)])) {
    const others = account[day] || {};

    for (const [id, n] of Object.entries(others)) if (id !== device) sum += Number(n) || 0;
    sum += Math.max(dayTotal(ledger.days[day]), Number(others[device]) || 0);
  }

  return sum;
}

export function todayGlow(store = storage(), user = syncUser(), now = new Date()) {
  return dayTotal(loadLedger(store, user).days[dhakaKey(now)]);
}

// ---- listeners (the hook) ---------------------------------------------------

let version = 0;
let capNotice = false; // glow.capped waits here until a screen shows it once
const listeners = new Set();

function changed() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (!event.key || event.key.startsWith('mnemoq-glow') || event.key.startsWith('mnemoq-sync')) changed();
  };

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// -> { total, today, version }. Re-reads after every award and after a sync pull.
export function useGlow() {
  const v = useSyncExternalStore(subscribe, () => version, () => 0);

  return { total: lifetimeGlow(), today: todayGlow(), version: v };
}

// True once after today's cap was reached (the calm glow.capped line).
export function takeCapNotice() {
  const shown = capNotice;

  capNotice = false;
  return shown;
}

// After the account's days arrive (other devices' Glow), screens re-read.
export function glowChanged() {
  changed();
}

// ---- earning ----------------------------------------------------------------

// glow_earned is one event per round or session (spec §7), not per tap: the
// amounts wait here and go out with flushGlowEvents() at the end of a step.
let pending = {};

export function flushGlowEvents(store = storage(), user = syncUser()) {
  const sources = Object.entries(pending);

  pending = {};
  if (sources.length === 0) return;

  const dayTotalNow = todayGlow(store, user);

  for (const [source, amount] of sources) {
    track('glow_earned', { source, amount, day_total: dayTotalNow });
    trackEvent('glow_earned', { source, amount, day_total: dayTotalNow });
  }
}

// Whatever is still waiting goes out when the app is hidden.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushGlowEvents();
  });
}

const SOURCE = { review: 'review', daily: 'daily', 'daily.finish': 'daily', practice: 'practice', card: 'card', round: 'round', diagnostic: 'diagnostic', mock: 'mock' };

// One learning action -> the award (see glow.js). Plays feel('glow.gain')
// unless `quiet` (when a bigger reward plays on the same action, or for
// actions summed at the end, like a Daily round).
// Returns { amount, reason, capHit }; capHit is true the first time today's
// cap is reached, so the caller can show glow.capped once.
export function earn(action, { at = new Date(), store = storage(), user = syncUser(), quiet = false } = {}) {
  const ledger = loadLedger(store, user);
  const day = dhakaKey(at);
  const rec = ledger.days[day] || {};
  const result = award(action, { day: rec, ever: ledger.ever });

  if (result.reason === 'again' || result.reason === 'unknown' || result.reason === 'snapLimit' || result.reason === 'none' || result.reason === 'miss') {
    return { ...result, capHit: false };
  }

  const next = applyAward(rec, result);
  const capHit = (result.capped || result.reason === 'cap') && !rec.capped;

  if (capHit) next.capped = true;
  else if (rec.capped) next.capped = true;
  ledger.days[day] = next;
  if (result.once && result.key && !ledger.ever.includes(result.key)) ledger.ever.push(result.key);
  saveLedger(ledger, store, user);

  if (result.amount > 0) {
    noteGlow(day, dayTotal(next), deviceId(store), store, user);
    const source = SOURCE[action.type] || action.type;
    pending[source] = (pending[source] || 0) + result.amount;
    if (!quiet) feel('glow.gain', { n: result.amount });
  }

  if (capHit) {
    capNotice = true;
    track('glow_cap_hit', { day_total: next.glow });
    trackEvent('glow_cap_hit', { day_total: next.glow });
  }

  changed();

  return { ...result, capHit };
}

// Milestones and the level already celebrated on this device.
export function ledgerSeen(store = storage(), user = syncUser()) {
  return loadLedger(store, user).seen;
}

export function saveLedgerSeen(seen, store = storage(), user = syncUser()) {
  const ledger = loadLedger(store, user);

  ledger.seen = seen;
  saveLedger(ledger, store, user);
}
