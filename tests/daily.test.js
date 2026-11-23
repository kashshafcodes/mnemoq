import { describe, expect, it } from 'vitest';
import { CATEGORIES, QUESTIONS } from '../src/daily/questions.js';
import { CYCLE_DAYS, MAX_SCORE, dhakaDate, msUntilNext, pointsFor, puzzleNumber, questionsFor, scoreOf, shareText, streakOf } from '../src/daily/puzzle.js';

describe('daily question pool', () => {
  it('has three questions for every category and level, in both languages', () => {
    for (const category of CATEGORIES) {
      for (const level of [1, 2, 3, 4, 5]) {
        expect(QUESTIONS.filter((q) => q.category === category && q.level === level)).toHaveLength(3);
      }
    }

    for (const q of QUESTIONS) {
      for (const side of [q.en, q.bn]) {
        expect(side.q).toBeTruthy();
        expect(side.why).toBeTruthy();
        expect(side.options).toHaveLength(4);
        expect(new Set(side.options).size).toBe(4);
      }
    }

    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });
});

describe('daily rotation', () => {
  it('gives five levels in order and five different categories each day', () => {
    for (let n = 1; n <= 60; n += 1) {
      const day = questionsFor(n);

      expect(day.map((q) => q.level)).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(day.map((q) => q.category)).size).toBe(5);
    }
  });

  it('uses every question exactly once in each cycle', () => {
    expect(CYCLE_DAYS).toBe(15);

    for (const start of [1, 16, 31]) {
      const ids = [];

      for (let n = start; n < start + CYCLE_DAYS; n += 1) ids.push(...questionsFor(n).map((q) => q.id));

      expect(new Set(ids).size).toBe(QUESTIONS.length);
    }
  });

  it('keeps the right answer when it shuffles the options, in both languages', () => {
    for (let n = 1; n <= 10; n += 1) {
      for (const q of questionsFor(n)) {
        const original = QUESTIONS.find((item) => item.id === q.id);

        expect(q.en.options[q.answer]).toBe(original.en.options[0]);
        expect(q.bn.options[q.answer]).toBe(original.bn.options[0]);
      }
    }
  });

  it('does not always put the answer in the same place', () => {
    const spots = new Set(QUESTIONS.length && [1, 2].flatMap((n) => questionsFor(n).map((q) => q.answer)));

    expect(spots.size).toBeGreaterThan(1);
  });

  it('counts days in Dhaka time, starting from 23 November 2026', () => {
    expect(puzzleNumber(new Date('2026-11-23T00:30:00+06:00'))).toBe(1);
    expect(puzzleNumber(new Date('2026-11-23T17:59:00Z'))).toBe(1); // 23:59 in Dhaka
    expect(puzzleNumber(new Date('2026-11-23T18:01:00Z'))).toBe(2); // 00:01 next day in Dhaka
    expect(dhakaDate(new Date('2026-11-23T18:01:00Z'))).toBe('2026-11-24');
    expect(msUntilNext(new Date('2026-11-23T17:59:00Z'))).toBe(60 * 1000);
  });
});

describe('daily scoring and sharing', () => {
  it('rewards confident right answers and charges confident wrong ones', () => {
    expect(pointsFor(true, 'sure')).toBe(3);
    expect(pointsFor(false, 'sure')).toBe(-2);
    expect(pointsFor(true, 'guess')).toBe(1);
    expect(pointsFor(false, 'guess')).toBe(-0);
    expect(scoreOf(Array(5).fill({ correct: true, bet: 'sure' }))).toBe(MAX_SCORE);
  });

  it('builds a share text with the grid and link', () => {
    const marks = [
      { correct: true, bet: 'sure' },
      { correct: true, bet: 'think' },
      { correct: false, bet: 'sure' },
      { correct: false, bet: 'guess' },
      { correct: true, bet: 'guess' },
    ];

    expect(shareText({ number: 4, marks })).toBe('Mnemoq Daily #4 · 4/15\n🟩🟨🟥⬜🟨\nhttps://mnemoq-two.vercel.app/daily');
    expect(shareText({ number: 4, marks, lang: 'bn' }).split('\n')[0]).toBe('Mnemoq ডেইলি #৪ · ৪/১৫');
  });

  it('counts a streak of consecutive days', () => {
    const history = { plays: { 3: {}, 4: {}, 5: {} } };

    expect(streakOf(history, 5)).toBe(3);
    expect(streakOf(history, 6)).toBe(3); // today not played yet
    expect(streakOf(history, 7)).toBe(0);
  });
});
