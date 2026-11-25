import { afterEach, describe, expect, it, vi } from 'vitest';

const events = [];
const feels = [];

vi.mock('../src/track.js', () => ({ track: (event, props) => events.push([event, props]) }));
vi.mock('../src/googleAnalytics.js', () => ({ trackEvent: () => {} }));
vi.mock('../src/sensory/index.js', () => ({ feel: (id, opts) => feels.push([id, opts]) }));

const { AMOUNTS, DAILY_CAP, applyAward, award, jonakiGlow, levelFor } = await import('../src/glow/glow.js');
const { streakFromNumbers, streakFromTimes, dhakaKey } = await import('../src/glow/streak.js');
const { dueCelebrations, MILESTONES } = await import('../src/glow/milestones.js');
const { earn, lifetimeGlow, todayGlow, takeCapNotice, loadLedger } = await import('../src/glow/store.js');
const { buildBatch, loadQueue, markSent, mergeSeen, mergeSources, noteGlow, queueSeen, saveServerDays, saveServerSeen, knownSeen, setSyncUser, glowOf } = await import('../src/sync/queue.js');
const { computeAnalytics, computeBadges, computeStreaks } = await import('../src/analytics.js');
const { dhakaDate } = await import('../src/daily/calendar.js');

function fakeStore() {
  const data = {};

  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => delete data[key],
    data,
  };
}

const NOW = new Date('2026-11-25T15:00:00Z'); // 21:00 in Dhaka
const day = (rec = {}) => ({ day: { glow: 0, keys: [], snaps: 0, ...rec } });

describe('Glow v1: every row of the table (spec §2)', () => {
  it('a due card recalled pays 3, missed pays 1, not due pays 0', () => {
    expect(award({ type: 'review', cardId: 'a', due: true, recalled: true }, day()).amount).toBe(3);
    expect(award({ type: 'review', cardId: 'a', due: true, recalled: false }, day()).amount).toBe(1);
    expect(award({ type: 'review', cardId: 'a', due: false, recalled: true }, day())).toMatchObject({ amount: 0, reason: 'notDue' });
  });

  it('once per card per Dhaka day', () => {
    const first = award({ type: 'review', cardId: 'a', due: true, recalled: true }, day());
    const rec = applyAward({}, first);

    expect(award({ type: 'review', cardId: 'a', due: true, recalled: true }, { day: rec })).toMatchObject({ amount: 0, reason: 'again' });
    expect(award({ type: 'review', cardId: 'b', due: true, recalled: true }, { day: rec }).amount).toBe(3);
    // A new day has a new record: the same card pays again.
    expect(award({ type: 'review', cardId: 'a', due: true, recalled: true }, day()).amount).toBe(3);
  });

  it('Daily: 2 a lit lantern, 3 if sure, 0 a miss, +2 to finish, once per puzzle', () => {
    expect(award({ type: 'daily', puzzle: 3, index: 0, correct: true }, day()).amount).toBe(2);
    expect(award({ type: 'daily', puzzle: 3, index: 1, correct: true, sure: true }, day()).amount).toBe(3);
    expect(award({ type: 'daily', puzzle: 3, index: 2, correct: false, sure: true }, day()).amount).toBe(0);
    expect(award({ type: 'daily.finish', puzzle: 3 }, day()).amount).toBe(2);
    expect(award({ type: 'daily.finish', puzzle: 3 }, { day: {}, ever: ['dailyDone:3'] }).reason).toBe('again');
    expect(5 * AMOUNTS['daily.sure'] + AMOUNTS['daily.finish']).toBe(17); // the Daily's maximum
  });

  it('practice or drill: 2 a right answer once per question a day, 0 a miss', () => {
    const right = award({ type: 'practice', questionId: 'c:q1', correct: true }, day());

    expect(right.amount).toBe(2);
    expect(award({ type: 'practice', questionId: 'c:q1', correct: false }, day()).amount).toBe(0);
    expect(award({ type: 'practice', questionId: 'c:q1', correct: true }, { day: applyAward({}, right) }).reason).toBe('again');
  });

  it('cards: a kept practice miss 1, a snap 5 for the first 3 a day, manual and imports 0', () => {
    expect(award({ type: 'card', method: 'practice_miss', cardId: 'x' }, day()).amount).toBe(1);
    expect(award({ type: 'card', method: 'snap', cardId: 'x' }, day()).amount).toBe(5);
    expect(award({ type: 'card', method: 'snap_offline', cardId: 'x' }, day()).amount).toBe(5);
    expect(award({ type: 'card', method: 'snap', cardId: 'x', ok: false }, day()).amount).toBe(0);
    expect(award({ type: 'card', method: 'snap', cardId: 'x' }, day({ snaps: 3 }))).toMatchObject({ amount: 0, reason: 'snapLimit' });
    for (const method of ['quick_add', 'library_form', 'csv_import', 'ai_set']) {
      expect(award({ type: 'card', method, cardId: 'x' }, day()).amount).toBe(0);
    }
  });

  it('round finished +10 once a day; diagnostic 30 and mock 20 once ever, outside the cap', () => {
    const round = award({ type: 'round' }, day());

    expect(round.amount).toBe(10);
    expect(award({ type: 'round' }, { day: applyAward({}, round) }).reason).toBe('again');

    const diag = award({ type: 'diagnostic', path: 'sat', kind: 'initial' }, day({ glow: DAILY_CAP }));

    expect(diag).toMatchObject({ amount: 30, exempt: true });
    expect(award({ type: 'diagnostic', path: 'sat', kind: 'initial' }, { day: {}, ever: ['diag:sat:initial'] }).amount).toBe(0);
    expect(award({ type: 'diagnostic', path: 'sat', kind: 'retest' }, { day: {}, ever: ['diag:sat:initial'] }).amount).toBe(30);

    expect(award({ type: 'mock', source: 'prepared:sat-1', id: 'm1' }, day({ glow: DAILY_CAP })).amount).toBe(20);
    // A retake of the same prepared paper pays 0; custom mocks pay once each.
    expect(award({ type: 'mock', source: 'prepared:sat-1', id: 'm2' }, { day: {}, ever: ['mock:prepared:sat-1'] }).amount).toBe(0);
    expect(award({ type: 'mock', source: 'custom', id: 'm3' }, { day: {}, ever: ['mock:custom:m2'] }).amount).toBe(20);
  });

  it('the cap: 100 a Dhaka day, partly paid at the edge, then 0', () => {
    expect(award({ type: 'round' }, day({ glow: 95 }))).toMatchObject({ amount: 5, capped: true });
    expect(award({ type: 'review', cardId: 'z', due: true, recalled: true }, day({ glow: 100 }))).toMatchObject({ amount: 0, reason: 'cap' });

    // A spam run: 60 due cards recalled in one day never pass 100.
    let rec = {};
    for (let i = 0; i < 60; i += 1) rec = applyAward(rec, award({ type: 'review', cardId: `c${i}`, due: true, recalled: true }, { day: rec }));
    expect(rec.glow).toBe(DAILY_CAP);
    // Exempt Glow is kept apart and never eats the cap.
    rec = applyAward(rec, award({ type: 'mock', source: 'custom', id: 'm9' }, { day: rec }));
    expect(rec).toMatchObject({ glow: 100, extra: 20 });
  });
});

describe('levels and Jonaki', () => {
  it('levels from lifetime Glow', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, next: 100, toNext: 100 });
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(400).level).toBe(3);
    expect(levelFor(1000)).toMatchObject({ level: 4, toNext: 1500 });
    expect(levelFor(2500)).toMatchObject({ level: 5, next: null, toNext: 0 });
  });

  it('Jonaki brightness follows the spec curve and only goes up', () => {
    expect(jonakiGlow(0)).toBeCloseTo(0.3, 2);
    expect(jonakiGlow(100)).toBeCloseTo(0.38, 2);
    expect(jonakiGlow(400)).toBeCloseTo(0.575, 2);
    expect(jonakiGlow(1000)).toBeCloseTo(0.8, 2);
    expect(jonakiGlow(2500)).toBeCloseTo(0.97, 2);
    expect(jonakiGlow(5000)).toBeLessThanOrEqual(1);
  });
});

describe('the streak with rest days: the §3 worked cases', () => {
  const lit = (...ranges) => ranges.flatMap((r) => (Array.isArray(r) ? Array.from({ length: r[1] - r[0] + 1 }, (_, i) => r[0] + i) : [r]));

  it('lit 1–7, T = 7', () => {
    expect(streakFromNumbers(lit([1, 7]), 7)).toMatchObject({ current: 7, restUsed: 0, best: 7 });
  });

  it('lit 1,2,3, miss 4, lit 5; T = 5: day 4 is a rest day', () => {
    const s = streakFromNumbers(lit([1, 3], 5), 5);

    expect(s).toMatchObject({ current: 4, restUsed: 1 });
    expect(s.strip.find((d) => d.n === 4).state).toBe('rest');
  });

  it('lit 1, miss 2,3, lit 4; T = 4', () => {
    expect(streakFromNumbers([1, 4], 4)).toMatchObject({ current: 2, restUsed: 2, atRisk: false });
  });

  it('same, T = 5, nothing yet today: at risk', () => {
    expect(streakFromNumbers([1, 4], 5)).toMatchObject({ current: 2, restUsed: 2, atRisk: true });
  });

  it('lit 1, miss 2,3,4; T = 5, lit today: ended, a new one began, best stays 1', () => {
    expect(streakFromNumbers([1, 5], 5)).toMatchObject({ current: 1, restUsed: 0, best: 1 });
  });

  it('lit 1, miss 2,3, lit 4–9, miss 10,11; T = 12, lit today', () => {
    expect(streakFromNumbers(lit(1, [4, 9], 12), 12)).toMatchObject({ current: 8, restUsed: 2 });
  });

  it('no history', () => {
    expect(streakFromNumbers([], 10)).toMatchObject({ current: 0, restUsed: 0, best: 0, atRisk: false });
  });

  it('lit only yesterday, nothing yet today: alive, not at risk', () => {
    expect(streakFromNumbers([9], 10)).toMatchObject({ current: 1, restUsed: 0, atRisk: false });
  });

  it('lit 5 days ago, nothing yet: ended', () => {
    expect(streakFromNumbers([5], 10).current).toBe(0);
  });

  it('the 14-day strip never shows days before the first lit one as missed', () => {
    const s = streakFromNumbers([20, 22], 23);
    const states = Object.fromEntries(s.strip.map((d) => [d.n, d.state]));

    expect(states[19]).toBe('before');
    expect(states[21]).toBe('rest');
    expect(states[23]).toBe('today');
    expect(s.strip).toHaveLength(14);
  });

  it('computeStreaks uses Dhaka days and the same rule, with the new fields', () => {
    // 23:30 in Dhaka on the 23rd and 00:30 on the 25th: the 24th is a rest day.
    const times = ['2026-11-23T17:30:00Z', '2026-11-24T18:30:00Z'];
    const s = computeStreaks([], new Date('2026-11-25T10:00:00Z'), times);

    expect(dhakaKey(times[1])).toBe('2026-11-25');
    expect(dhakaKey(times[0])).toBe(dhakaDate(new Date(times[0])));
    expect(s).toMatchObject({ current: 2, reviewedToday: true, restUsed: 1, atRisk: false });
    expect(s.days.at(-2)).toEqual({ day: '2026-11-24', state: 'rest' });
  });

  it('a simulated missed day holds the streak; a third miss in 7 ends it (best kept)', () => {
    const at = (n) => new Date(NOW.getTime() - n * 864e5).toISOString();
    const held = streakFromTimes([at(4), at(3), at(2)], NOW); // yesterday missed, today not yet

    expect(held).toMatchObject({ current: 3, restUsed: 1, atRisk: false });
    const ended = streakFromTimes([at(6), at(5), at(4)], NOW);

    expect(ended).toMatchObject({ current: 0, best: 3 });
  });

  it('the two streak badges are retired; the others stay', () => {
    const { stats } = computeAnalytics([], [], NOW);
    const ids = computeBadges(stats).map((b) => b.id);

    expect(ids).not.toContain('streak-3');
    expect(ids).not.toContain('streak-7');
    expect(ids).toContain('first-card');
    expect(ids).toContain('comeback');
  });
});

describe('Glow across devices: added up, never double counted', () => {
  afterEach(() => setSyncUser(null));

  it('each device keeps its own entry; the day is the sum; a replay counts once', () => {
    const merged = mergeSources({ review: 3, glow: { a: 40 } }, { review: 2, glow: { b: 25 } });

    expect(merged).toEqual({ review: 3, glow: { a: 40, b: 25 } });
    expect(glowOf(merged)).toBe(65);
    // The same batch sent twice (or the device's own entry coming back) changes nothing.
    expect(glowOf(mergeSources(merged, { glow: { b: 25 } }))).toBe(65);
    // A device's later, larger total replaces its own entry only.
    expect(glowOf(mergeSources(merged, { glow: { b: 30 } }))).toBe(70);
  });

  it('the batch writes learning_days.glow as the sum, keeping the other phone', () => {
    const store = fakeStore();

    setSyncUser('u1', store);
    saveServerDays('u1', [{ day: '2026-11-25', sources: { review: 1, glow: { phoneA: 40 } }, glow: 40 }], store);
    noteGlow('2026-11-25', 12, 'phoneB', store, 'u1');

    const batch = buildBatch(store);

    expect(batch.days[0]).toMatchObject({ day: '2026-11-25', glow: 52, sources: { review: 1, glow: { phoneA: 40, phoneB: 12 } } });
    markSent(batch, undefined, store);
    expect(loadQueue(store).dirty).toEqual([]);
    // More Glow on this phone the same day: an absolute total, not "+n".
    noteGlow('2026-11-25', 15, 'phoneB', store, 'u1');
    expect(buildBatch(store).days[0].glow).toBe(55);
  });

  it('an old row with only a total keeps it as one entry', () => {
    const store = fakeStore();

    saveServerDays('u1', [{ day: '2026-11-20', sources: { review: 1 }, glow: 30 }], store);
    setSyncUser('u1', store);
    noteGlow('2026-11-20', 5, 'me', store, 'u1');
    expect(buildBatch(store).days[0].glow).toBe(35);
  });

  it('lifetime Glow adds other devices and never this device twice', () => {
    const store = fakeStore();

    store.setItem('mnemoq-device', 'me');
    setSyncUser('u1', store);
    earn({ type: 'round' }, { at: NOW, store, user: 'u1', quiet: true });
    expect(todayGlow(store, 'u1', NOW)).toBe(10);
    // The account has this day from both phones (this one's entry came back).
    saveServerDays('u1', [{ day: dhakaKey(NOW), sources: { glow: { me: 10, other: 7 } } }, { day: '2026-11-01', sources: { glow: { other: 50 } } }], store);
    expect(lifetimeGlow(store, 'u1', 'me')).toBe(67);
    // Signed out, the guest ledger is separate.
    expect(lifetimeGlow(store, null, 'me')).toBe(0);
  });
});

describe('earning on the device', () => {
  afterEach(() => setSyncUser(null));

  it('plays glow.gain, keeps once-per-card, and shows the cap line once', () => {
    const store = fakeStore();

    feels.length = 0;
    events.length = 0;
    expect(earn({ type: 'review', cardId: 'a', due: true, recalled: true }, { at: NOW, store, user: null }).amount).toBe(3);
    expect(feels.at(-1)).toEqual(['glow.gain', { n: 3 }]);
    expect(earn({ type: 'review', cardId: 'a', due: true, recalled: true }, { at: NOW, store, user: null }).amount).toBe(0);

    for (let i = 0; i < 40; i += 1) earn({ type: 'review', cardId: `c${i}`, due: true, recalled: true }, { at: NOW, store, user: null, quiet: true });
    expect(loadLedger(store, null).days[dhakaKey(NOW)].glow).toBe(100);
    expect(events.filter(([e]) => e === 'glow_cap_hit')).toHaveLength(1);
    expect(takeCapNotice()).toBe(true);
    expect(takeCapNotice()).toBe(false);
  });
});

describe('milestones and level-ups fire once', () => {
  it('fires a milestone the first time, then never again', () => {
    const first = dueCelebrations({ streak: 3, glow: 0, seen: null });

    expect(first).toMatchObject({ milestone: 3, levelUp: null });
    expect(dueCelebrations({ streak: 3, glow: 0, seen: first.seen }).milestone).toBe(null);
    expect(dueCelebrations({ streak: 4, glow: 0, seen: first.seen }).milestone).toBe(null);
    expect(dueCelebrations({ streak: 7, glow: 0, seen: first.seen }).milestone).toBe(7);
    expect(MILESTONES).toEqual([3, 7, 14, 30, 60, 100]);
  });

  it('an older long streak celebrates only the highest, and marks the rest seen', () => {
    const due = dueCelebrations({ streak: 40, glow: 0, seen: null });

    expect(due.milestone).toBe(30);
    expect(due.seen.milestones).toEqual(['streak.m14', 'streak.m3', 'streak.m30', 'streak.m7']);
  });

  it('a level-up fires once; a milestone and a level-up can land together', () => {
    const both = dueCelebrations({ streak: 3, glow: 120, seen: null });

    expect(both).toMatchObject({ milestone: 3, levelUp: 2 });
    expect(dueCelebrations({ streak: 3, glow: 150, seen: both.seen })).toMatchObject({ milestone: null, levelUp: null });
  });

  it('seen on one device stays seen on another (learner_profile)', () => {
    const phoneA = fakeStore();
    const phoneB = fakeStore();

    setSyncUser('u1', phoneA);
    const due = dueCelebrations({ streak: 7, glow: 0, seen: knownSeen(phoneA, 'u1').seen });

    queueSeen(due.seen, phoneA, 'u1');
    const batch = buildBatch(phoneA);

    expect(batch.profile).toMatchObject({ user_id: 'u1', milestones_seen: ['streak.m3', 'streak.m7'], glow_level_seen: 1 });
    markSent(batch, undefined, phoneA);
    expect(loadQueue(phoneA).seen).toBe(null);

    // Phone B pulls the profile row on sign-in: nothing fires again there.
    saveServerSeen('u1', { milestones_seen: batch.profile.milestones_seen, glow_level_seen: 1 }, phoneB);
    const there = knownSeen(phoneB, 'u1');

    expect(there.pulled).toBe(true);
    expect(dueCelebrations({ streak: 7, glow: 0, seen: there.seen }).milestone).toBe(null);
    // Before the pull, a signed-in device knows it must wait.
    expect(knownSeen(fakeStore(), 'u1').pulled).toBe(false);
    expect(mergeSeen({ milestones: ['streak.m3'], level: 3 }, { milestones: ['streak.m7'], level: 2 })).toEqual({ milestones: ['streak.m3', 'streak.m7'], level: 3 });
  });
});
