import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QUEUE_KEY,
  buildBatch,
  loadQueue,
  markSent,
  mergeSources,
  noteLearning,
  queueDailyResult,
  queueLang,
  saveServerDays,
  serverDayTimes,
  setSyncUser,
} from '../src/sync/queue.js';
import { streakTimes } from '../src/streak/activity.js';
import { computeStreaks } from '../src/analytics.js';

function fakeStore() {
  const data = new Map();

  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

// 10:00 Dhaka on 25 Nov 2026
const NOW = new Date('2026-11-25T04:00:00Z');
const dhakaDay = (offset) => new Date(Date.UTC(2026, 10, 25 + offset, 6)).toISOString().slice(0, 10);

describe('sync queue', () => {
  afterEach(() => setSyncUser(null));

  it('queues nothing for a guest (device-only play)', () => {
    const store = fakeStore();

    noteLearning('review', NOW, store, null);
    queueDailyResult(3, { score: 9, marks: [], at: NOW.toISOString() }, store, null);
    expect(store.data.has(QUEUE_KEY)).toBe(false);
  });

  it('bumps the Dhaka day per source and builds absolute rows', () => {
    const store = fakeStore();

    setSyncUser('u1', store);
    noteLearning('review', NOW, store, 'u1');
    noteLearning('review', NOW, store, 'u1');
    noteLearning('drill', NOW, store, 'u1');
    // 23:30 Dhaka on 25 Nov is still the 25th; 00:30 Dhaka is the 26th
    noteLearning('snap', new Date('2026-11-25T17:30:00Z'), store, 'u1');
    noteLearning('snap', new Date('2026-11-25T18:30:00Z'), store, 'u1');
    noteLearning('login', NOW, store, 'u1');

    const batch = buildBatch(store);

    expect(batch.days).toEqual([
      { user_id: 'u1', day: '2026-11-25', actions: 4, glow: 0, sources: { review: 2, drill: 1, snap: 1 } },
      { user_id: 'u1', day: '2026-11-26', actions: 1, glow: 0, sources: { snap: 1 } },
    ]);
  });

  it('offline replay: the queue survives failed flushes and empties only on success', () => {
    const store = fakeStore();

    setSyncUser('u1', store);
    noteLearning('review', NOW, store, 'u1');
    queueDailyResult(3, { score: 9, marks: ['h', 'h', 'm', 'h', 'n'], at: NOW.toISOString() }, store, 'u1');
    queueLang('bn', store);

    const first = buildBatch(store);

    // Offline / failed: nothing marked, the same batch is built again.
    markSent(first, { days: false, results: false, profile: false }, store);
    expect(buildBatch(store)).toEqual(first);

    // Back online: a partial success keeps only the failed part.
    markSent(first, { days: true, results: false, profile: true }, store);
    const second = buildBatch(store);

    expect(second.days).toEqual([]);
    expect(second.profile).toBeNull();
    expect(second.results).toEqual([{ user_id: 'u1', number: 3, score: 9, marks: ['h', 'h', 'm', 'h', 'n'], played_at: NOW.toISOString() }]);

    markSent(second, undefined, store);
    expect(buildBatch(store)).toMatchObject({ days: [], results: [], profile: null });
  });

  it('keeps work queued while a flush was in flight', () => {
    const store = fakeStore();

    setSyncUser('u1', store);
    noteLearning('review', NOW, store, 'u1');
    const batch = buildBatch(store);

    noteLearning('review', NOW, store, 'u1'); // arrives before the reply
    markSent(batch, undefined, store);
    expect(buildBatch(store).days).toEqual([{ user_id: 'u1', day: '2026-11-25', actions: 2, glow: 0, sources: { review: 2 } }]);
  });

  it('idempotent merge: max per source, so replaying a batch changes nothing', () => {
    expect(mergeSources({ review: 5, daily: 1 }, { review: 2, snap: 1 })).toEqual({ review: 5, daily: 1, snap: 1 });
    expect(mergeSources(mergeSources({ review: 5 }, { review: 7 }), { review: 7 })).toEqual({ review: 7 });

    const store = fakeStore();

    setSyncUser('u1', store);
    saveServerDays('u1', [{ day: '2026-11-25', sources: { review: 10, daily: 1 } }], store);
    noteLearning('review', NOW, store, 'u1');
    const once = buildBatch(store);

    expect(once.days[0]).toMatchObject({ actions: 11, sources: { review: 10, daily: 1 } });
    markSent(once, undefined, store);
    noteLearning('review', NOW, store, 'u1');
    // device review count 2 is still below the account's 10: the same row again
    expect(buildBatch(store).days[0]).toEqual(once.days[0]);
  });

  it('a different account on the same device starts a fresh queue', () => {
    const store = fakeStore();

    setSyncUser('u1', store);
    noteLearning('review', NOW, store, 'u1');
    queueLang('bn', store);
    setSyncUser('u2', store);

    const state = loadQueue(store);

    expect(state.user).toBe('u2');
    expect(state.dirty).toEqual([]);
    expect(state.lang).toBe('bn'); // the app language belongs to the device
  });
});

describe('streak merge across devices', () => {
  afterEach(() => setSyncUser(null));

  it('server days join the one streak while that account is signed in', () => {
    const store = fakeStore();

    // The other phone studied yesterday and the day before; this one today.
    saveServerDays('u1', [{ day: dhakaDay(-1), sources: { review: 3 } }, { day: dhakaDay(-2), sources: { daily: 1 } }], store);

    const today = [NOW.toISOString()];
    const signedIn = streakTimes({ plays: today, activity: [], account: serverDayTimes(store, 'u1') });
    const signedOut = streakTimes({ plays: today, activity: [], account: serverDayTimes(store, null) });
    const otherUser = streakTimes({ plays: today, activity: [], account: serverDayTimes(store, 'u2') });

    expect(computeStreaks([], NOW, signedIn).current).toBe(3);
    expect(computeStreaks([], NOW, signedOut).current).toBe(1); // the device record is the fallback
    expect(computeStreaks([], NOW, otherUser).current).toBe(1);
  });

  it('a day both devices studied counts once', () => {
    const store = fakeStore();

    saveServerDays('u1', [{ day: dhakaDay(0), sources: { review: 3 } }], store);
    const times = streakTimes({ plays: [NOW.toISOString()], activity: [], account: serverDayTimes(store, 'u1') });

    expect(computeStreaks([], NOW, times).current).toBe(1);
  });

  it('a day with only Glow (a share, a friend opening your link) is not a learning day', () => {
    const store = fakeStore();

    saveServerDays(
      'u1',
      [
        { day: dhakaDay(-1), sources: { glow: { dev1: 3 } } },
        { day: dhakaDay(-2), sources: { glow: { friend: 5, dev1: 3 } } },
        { day: dhakaDay(-3), sources: { snap: 1, glow: { dev1: 3 } } },
      ],
      store
    );

    expect(serverDayTimes(store, 'u1')).toEqual([`${dhakaDay(-3)}T12:00:00+06:00`]);
  });
});

describe('flush', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('upserts each table on its key, replays after offline, and uploads guest Daily history once', async () => {
    const store = fakeStore();
    const calls = [];
    let offline = true;
    const client = {
      from: (table) => ({
        upsert: async (rows, opts) => {
          calls.push({ table, rows, opts });
          return { error: null };
        },
        select: () => ({ eq: () => ({ gte: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
      }),
    };

    store.setItem('mnemoq-daily', JSON.stringify({ plays: { 2: { marks: ['h'], score: 3, at: '2026-11-24T10:00:00Z' } } }));
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('navigator', {
      get onLine() {
        return !offline;
      },
    });
    vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' });
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });

    const { flush, startSync, stopSync } = await import('../src/sync/sync.js');

    startSync(client, 'u1');
    noteLearning('review', NOW);
    expect(await flush()).toBe(false); // offline: nothing sent
    expect(calls).toHaveLength(0);

    offline = false;
    expect(await flush()).toBe(true);
    expect(calls.map((c) => [c.table, c.opts.onConflict])).toEqual([
      ['learning_days', 'user_id,day'],
      ['daily_results', 'user_id,number'],
    ]);
    expect(calls[0].rows.map((r) => r.day).sort()).toEqual(['2026-11-24', '2026-11-25']);
    expect(calls[1].rows).toEqual([{ user_id: 'u1', number: 2, score: 3, marks: ['h'], played_at: '2026-11-24T10:00:00Z' }]);

    // Signing in again does not upload the guest history twice.
    stopSync();
    calls.length = 0;
    startSync(client, 'u1');
    await flush();
    expect(calls).toHaveLength(0);
    stopSync();
  });
});
