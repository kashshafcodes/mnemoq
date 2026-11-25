import { describe, expect, it } from 'vitest';
import { afterRound, dayIndex, dueTomorrow, playState, shortClock } from '../src/loop/playState.js';
import { loopT } from '../src/loop/strings.js';
import { computeAnalytics, computeStreaks } from '../src/analytics.js';
import { playTimes, streakOf } from '../src/daily/calendar.js';

describe('Play button state', () => {
  it('reviews first when cards are due', () => {
    expect(playState({ dueCount: 3, dailyPlayed: false })).toEqual({ kind: 'due', action: 'review', n: 3 });
    expect(playState({ dueCount: 1, dailyPlayed: true }).action).toBe('review');
  });

  it('offers a round of 10 when 10 or more are due', () => {
    expect(playState({ dueCount: 10, size: 10 }).kind).toBe('many');
    expect(playState({ dueCount: 37, size: 10 })).toEqual({ kind: 'many', action: 'review', n: 37 });
    expect(playState({ dueCount: 9, size: 10 }).kind).toBe('due');
  });

  it('opens the Daily when nothing is due and it is not played', () => {
    expect(playState({ dueCount: 0, dailyPlayed: false })).toEqual({ kind: 'daily', action: 'daily', n: 0 });
  });

  it('is done when nothing is due and the Daily is played', () => {
    expect(playState({ dueCount: 0, dailyPlayed: true })).toEqual({ kind: 'done', action: 'done', n: 0 });
    expect(playState()).toEqual({ kind: 'daily', action: 'daily', n: 0 });
  });

  it('ignores nonsense counts', () => {
    expect(playState({ dueCount: -4, dailyPlayed: true }).kind).toBe('done');
    expect(playState({ dueCount: 'x', dailyPlayed: false }).kind).toBe('daily');
  });
});

describe('after a round', () => {
  it('never leaves a dead end', () => {
    expect(afterRound({ moreDue: 4, dailyPlayed: false })).toBe('more');
    expect(afterRound({ moreDue: 0, dailyPlayed: false })).toBe('daily');
    expect(afterRound({ moreDue: 0, dailyPlayed: true })).toBe('done');
  });
});

describe('tomorrow preview', () => {
  const now = new Date(2026, 10, 24, 20, 0);
  const at = (days, hour = 9) => new Date(2026, 10, 24 + days, hour).toISOString();

  it('counts cards that become due by the end of tomorrow', () => {
    const cards = [
      { nextReviewAt: null }, // due now, not tomorrow
      { nextReviewAt: at(0, 8) }, // already due
      { nextReviewAt: at(0, 23) }, // later tonight
      { nextReviewAt: at(1, 9) }, // tomorrow
      { nextReviewAt: at(2, 9) }, // the day after
    ];

    expect(dueTomorrow(cards, now)).toBe(2);
  });

  it('formats the countdown and rotates once a day', () => {
    expect(shortClock(5 * 3600000 + 12 * 60000)).toBe('5h 12m');
    expect(shortClock(4 * 60000)).toBe('4m');
    expect(dayIndex(new Date(2026, 10, 24, 1)) ).toBe(dayIndex(new Date(2026, 10, 24, 23)));
    expect(dayIndex(new Date(2026, 10, 25, 1)) - dayIndex(new Date(2026, 10, 24, 1))).toBe(1);
  });
});

describe('loop copy', () => {
  it('uses the singular in English and Bangla digits in Bangla', () => {
    expect(loopT('en')('play.due', { n: 1 })).toBe('1 card fading');
    expect(loopT('en')('play.due', { n: 4 })).toBe('4 cards fading');
    expect(loopT('bn')('play.due', { n: 4 })).toBe('৪টি কার্ড ঝাপসা');
    expect(loopT('bn')('play.many', { size: 10 })).toBe('১০টির রাউন্ড');
  });
});

describe('one streak: reviews and Daily rounds', () => {
  const now = new Date(2026, 10, 24, 21, 0);
  const day = (offset, hour = 19) => new Date(2026, 10, 24 + offset, hour);

  it('counts a day with only a Daily round', () => {
    const reviews = [{ at: day(-2) }, { at: day(-1) }];

    expect(computeStreaks(reviews, now).current).toBe(2);
    expect(computeStreaks(reviews, now, [day(0).toISOString()]).current).toBe(3);
  });

  it('bridges a gap with a Daily round and keeps the best run', () => {
    const reviews = [{ at: day(-4) }, { at: day(-3) }, { at: day(-1) }];
    const merged = computeStreaks(reviews, now, [day(-2).toISOString()]);

    expect(merged.current).toBe(4);
    expect(merged.best).toBe(4);
    expect(merged.reviewedToday).toBe(false);
  });

  it('works with Daily rounds alone, and computeAnalytics passes them through', () => {
    const plays = [day(-1).toISOString(), day(0).toISOString()];

    expect(computeStreaks([], now, plays)).toMatchObject({ current: 2, best: 2, reviewedToday: true, restUsed: 0, atRisk: false });
    expect(computeAnalytics([], [], now, { extraDays: plays }).stats.streak.current).toBe(2);
    expect(computeAnalytics([], [], now).stats.streak.current).toBe(0);
  });

  it('reads Daily play times from the device history', () => {
    const history = { plays: { 1: { at: '2026-11-23T14:00:00Z' }, 2: { at: '2026-11-24T14:00:00Z' }, 3: {} } };

    expect(playTimes(history)).toEqual(['2026-11-23T14:00:00Z', '2026-11-24T14:00:00Z']);
    expect(streakOf(history, 2)).toBe(2);
  });
});
