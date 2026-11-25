import { describe, expect, it } from 'vitest';
import { cardsProgress, freshSteps, newRecord, playFromRound, roundPlan } from '../src/loop/roundPlan.js';
import { drillSourceFor } from '../src/loop/drillSource.js';
import { freeSetCount } from '../src/practice/access.js';
import CATALOG_FOR_DRILL from '../library/catalog.json';
import { loadRound, pruneRounds, roundKey, saveRound } from '../src/loop/roundStore.js';
import { STRINGS, loopT } from '../src/loop/strings.js';
import { NAV_STRINGS } from '../src/nav/strings.js';

const ids = (plan) => plan.steps.map((s) => s.id);
const weakest = { name: 'Mathematics', cardSubject: 'Mathematics' };
const base = { hasCards: true, dueCount: 0, dailyPlayed: false, weakest: null, drillAvailable: false, size: 10 };

describe('roundPlan: which steps a round has (spec §4)', () => {
  it('0 due, Daily not played, drill available: Daily then drill', () => {
    expect(ids(roundPlan({ ...base, weakest, drillAvailable: true }))).toEqual(['daily', 'drill']);
  });

  it('0 due, Daily played, drill available: just the drill', () => {
    const plan = roundPlan({ ...base, dailyPlayed: true, weakest, drillAvailable: true });

    expect(ids(plan)).toEqual(['drill']);
    expect(plan.current).toBe('drill');
  });

  it('0 due, nothing else: done for today at once', () => {
    const plan = roundPlan({ ...base, dailyPlayed: true });

    expect(plan.total).toBe(0);
    expect(plan.allDone).toBe(true);
    expect(playFromRound(plan).kind).toBe('done');
  });

  it('1 and 9 due: the cards step is exactly the cards due', () => {
    expect(roundPlan({ ...base, dueCount: 1 }).steps[0]).toMatchObject({ id: 'cards', target: 1 });
    expect(roundPlan({ ...base, dueCount: 9 }).steps[0]).toMatchObject({ id: 'cards', target: 9 });
    expect(roundPlan({ ...base, dueCount: 9 }).many).toBe(false);
  });

  it('10 and 40 due: one round of 10, the rest wait', () => {
    expect(roundPlan({ ...base, dueCount: 10 }).steps[0].target).toBe(10);

    const many = roundPlan({ ...base, dueCount: 40 });

    expect(many.steps[0].target).toBe(10);
    expect(many.many).toBe(true);
    expect(playFromRound(many, { dueCount: 40, size: 10 })).toEqual({ kind: 'many', action: 'review', n: 40 });
  });

  it('a new user with no cards: snap one, then the Daily, no drill', () => {
    const plan = roundPlan({ ...base, hasCards: false, weakest: null });

    expect(ids(plan)).toEqual(['snap', 'daily']);
    expect(playFromRound(plan).kind).toBe('snap');
  });

  it('no measured weakest or no practice set: no drill step', () => {
    expect(ids(roundPlan({ ...base, dueCount: 3, weakest: null, drillAvailable: true }))).toEqual(['cards', 'daily']);
    expect(ids(roundPlan({ ...base, dueCount: 3, weakest, drillAvailable: false }))).toEqual(['cards', 'daily']);
  });

  it('a full day: 12 due, Daily unplayed, weakest measured -> 3 segments', () => {
    const plan = roundPlan({ ...base, dueCount: 12, weakest, drillAvailable: true });

    expect(ids(plan)).toEqual(['cards', 'daily', 'drill']);
    expect(plan.current).toBe('cards');
    expect(plan.doneCount).toBe(0);
  });

  it('ignores nonsense counts', () => {
    expect(freshSteps({ ...base, dueCount: -3 })).toEqual([{ id: 'daily', target: 5 }]);
    expect(freshSteps({ ...base, dueCount: 'x', dailyPlayed: true })).toEqual([]);
  });
});

describe('roundPlan: progress is real, the ring never shrinks', () => {
  const record = { steps: ['cards', 'daily', 'drill'], cardsTarget: 10, skipped: [] };
  const day = { ...base, dueCount: 12, weakest, drillAvailable: true, record };

  it('fills the cards segment card by card', () => {
    const plan = roundPlan({ ...day, progress: { cards: 3, cardsLeft: 9 } });

    expect(plan.steps[0]).toMatchObject({ n: 3, done: false, fill: 0.3 });
    expect(plan.current).toBe('cards');
  });

  it('marks cards done after the target, and moves on to the Daily', () => {
    const plan = roundPlan({ ...day, dueCount: 2, progress: { cards: 10, cardsLeft: 2 } });

    expect(plan.steps[0].done).toBe(true);
    expect(plan.current).toBe('daily');
    expect(playFromRound(plan, { dueCount: 2 }).kind).toBe('daily');
  });

  it('cards done when none of the start cards are still due', () => {
    expect(roundPlan({ ...day, progress: { cards: 4, cardsLeft: 0 } }).steps[0].done).toBe(true);
  });

  it('keeps the steps of the day even when the due count changes', () => {
    const plan = roundPlan({ ...day, dueCount: 0, dailyPlayed: true, progress: { cards: 10, drillDone: false } });

    expect(ids(plan)).toEqual(['cards', 'daily', 'drill']);
    expect(plan.doneCount).toBe(2);
    expect(plan.current).toBe('drill');
  });

  it('the Daily played elsewhere (/daily) still lights its step', () => {
    const plan = roundPlan({ ...day, dailyPlayed: true, progress: { cards: 0, cardsLeft: 12 } });

    expect(plan.steps[1].done).toBe(true);
  });

  it('is all done, with one celebration worth of state, when every step is', () => {
    const plan = roundPlan({ ...day, dueCount: 2, dailyPlayed: true, progress: { cards: 10, cardsLeft: 2, drillDone: true } });

    expect(plan.allDone).toBe(true);
    expect(plan.doneCount).toBe(3);
    expect(plan.current).toBe(null);
    expect(playFromRound(plan, { dueCount: 2 }).kind).toBe('done');
  });
});

describe('roundPlan: "Not now" and offline', () => {
  it('a skipped step stays hollow and the round can still finish', () => {
    const record = { steps: ['cards', 'daily'], cardsTarget: 5, skipped: ['daily'] };
    const plan = roundPlan({ ...base, dueCount: 0, record, progress: { cards: 5, cardsLeft: 0 } });

    expect(plan.steps[1]).toMatchObject({ skipped: true, done: false, fill: 0 });
    expect(plan.allDone).toBe(true);
    expect(plan.doneCount).toBe(1);
  });

  it('skipping the current step moves Play to the next one', () => {
    const record = { steps: ['cards', 'daily'], cardsTarget: 5, skipped: ['cards'] };
    const plan = roundPlan({ ...base, dueCount: 5, record, progress: { cards: 0, cardsLeft: 5 } });

    expect(plan.current).toBe('daily');
  });

  it('a skipped step that gets done anyway counts as done', () => {
    const record = { steps: ['daily'], skipped: ['daily'] };
    const plan = roundPlan({ ...base, dailyPlayed: true, record });

    expect(plan.steps[0]).toMatchObject({ done: true, skipped: false });
  });

  it('offline: cards and drill disabled, the cached Daily still plays', () => {
    const plan = roundPlan({ ...base, dueCount: 4, weakest, drillAvailable: true, online: false, dailyCached: true });

    expect(plan.steps.map((s) => s.enabled)).toEqual([false, true, false]);
    expect(plan.steps[0].reason).toBe('offline');
    expect(plan.current).toBe('daily');
  });

  it('offline with nothing playable: blocked, not done', () => {
    const plan = roundPlan({ ...base, dueCount: 4, dailyPlayed: true, online: false });

    expect(plan.blocked).toBe(true);
    expect(plan.allDone).toBe(false);
    expect(playFromRound(plan).kind).toBe('offline');
  });
});

describe('the day record and its progress', () => {
  it('a new record keeps the steps, the target and the cards due at the start', () => {
    const plan = roundPlan({ ...base, dueCount: 12, weakest, drillAvailable: true });
    const record = newRecord(plan, { user: 'u1', dueIds: [1, 2, 3], date: '2026-11-25' });

    expect(record).toMatchObject({ date: '2026-11-25', user: 'u1', steps: ['cards', 'daily', 'drill'], cardsTarget: 10, cardIds: ['1', '2', '3'], skipped: [], celebrated: false });
  });

  it('counts today’s reviews of the start cards, once per card', () => {
    const record = { cardIds: ['a', 'b', 'c'] };
    const reviews = [
      { cardId: 'a', at: 'today' },
      { cardId: 'a', at: 'today' },
      { cardId: 'b', at: 'yesterday' },
      { cardId: 'z', at: 'today' },
      { cardId: 'c', at: 'today' },
    ];

    expect(cardsProgress(record, reviews, ['b'], (at) => at === 'today')).toEqual({ cards: 2, cardsLeft: 1 });
    expect(cardsProgress(null, reviews, [])).toEqual({ cards: 0, cardsLeft: null });
  });

  it('day rollover: each Dhaka day has its own record; old ones are pruned', () => {
    const mem = new Map();
    const store = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
      key: (i) => [...mem.keys()][i],
      get length() {
        return mem.size;
      },
    };

    saveRound({ date: '2026-11-10', user: 'u1', steps: ['daily'] }, store);
    saveRound({ date: '2026-11-24', user: 'u1', steps: ['cards'] }, store);

    expect(loadRound('2026-11-25', 'u1', store)).toBe(null);
    expect(loadRound('2026-11-24', 'u1', store).steps).toEqual(['cards']);
    expect(loadRound('2026-11-24', 'someone-else', store)).toBe(null);

    pruneRounds('2026-11-25', store);
    expect(mem.has(roundKey('2026-11-10'))).toBe(false);
    expect(mem.has(roundKey('2026-11-24'))).toBe(true);
  });
});

describe('the drill source', () => {
  it('maps the weakest section to a practice collection, or none', () => {
    expect(drillSourceFor({ name: 'Mathematics', cardSubject: 'Mathematics' })).toMatchObject({ collection: 'quant', set: 1, size: 5 });
    expect(drillSourceFor({ name: 'English', cardSubject: 'English' }).collection).toBe('vocab');
    expect(drillSourceFor({ name: 'General Knowledge', cardSubject: 'General Knowledge' })).toBe(null);
    expect(drillSourceFor(null)).toBe(null);
  });

  it('rotates the five questions daily; free users stay in the free half', () => {
    const a = drillSourceFor(weakest, { day: 0 });
    const b = drillSourceFor(weakest, { day: 1 });

    expect(a.offset).toBe(0);
    expect(b.offset).toBe(5);
    expect(drillSourceFor(weakest, { day: 9 }).set).toBe(3);
    expect(drillSourceFor(weakest, { day: 9, pro: true }).set).toBe(3);

    const sets = new Set(Array.from({ length: 2000 }, (_, day) => drillSourceFor(weakest, { day }).set));
    const proSets = new Set(Array.from({ length: 2000 }, (_, day) => drillSourceFor(weakest, { day, pro: true }).set));
    const total = CATALOG_FOR_DRILL.collections.find((c) => c.id === drillSourceFor(weakest).collection).sets;

    expect(Math.max(...sets)).toBe(freeSetCount(total));
    expect(Math.max(...proSets)).toBe(total);
  });
});

describe('round copy', () => {
  it('has English and Bangla for every round key, with Bangla digits', () => {
    const en = loopT('en');
    const bn = loopT('bn');

    expect(en('round.progress.left', { n: 1 })).toBe('One more, then you’re done');
    expect(en('round.progress.left', { n: 2 })).toBe('2 more, then you’re done');
    expect(bn('round.progress.left', { n: 2 })).toBe('আর ২টি, তারপর ছুটি');
    expect(bn('round.ring.aria', { done: 1, total: 3 })).toBe('৩টির মধ্যে ১টি ধাপ শেষ');
    expect(en('round.done.extra', { size: 10, n: 4 })).toBe('Another round of 10? 4 cards are ready.');
  });

  it('every new English key has a Bangla line', () => {
    const missing = (en, bn) => Object.keys(en).filter((k) => !k.endsWith('_one') && !(k in bn));

    expect(missing(STRINGS.en, STRINGS.bn).filter((k) => /^(round|drill|play)\./.test(k))).toEqual([]);
    expect(missing(NAV_STRINGS.en, NAV_STRINGS.bn)).toEqual([]);
  });
});
