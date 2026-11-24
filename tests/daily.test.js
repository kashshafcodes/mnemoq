import { describe, expect, it } from 'vitest';
import { CATEGORIES, QUESTIONS } from '../src/daily/questions.js';
import { CYCLE_DAYS, MAX_SCORE, ROTATION_START, dhakaDate, msUntilNext, pointsFor, puzzleNumber, questionsFor, scoreOf, shareText, streakOf } from '../src/daily/puzzle.js';

describe('daily question pool', () => {
  it('has six questions for every category and level, in both languages', () => {
    for (const category of CATEGORIES) {
      for (const level of [1, 2, 3, 4, 5]) {
        expect(QUESTIONS.filter((q) => q.category === category && q.level === level)).toHaveLength(6);
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

  it('uses every question exactly once in each cycle from #16', () => {
    expect(CYCLE_DAYS).toBe(30);
    expect(ROTATION_START).toBe(16);

    for (const start of [16, 46, 76, 106]) {
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

// Puzzles #1–#15 were live (or announced) before the pool grew to 150, and
// Marketing's reveal posts quote them. These ids and answer positions were
// produced by the 75-question code on 2026-11-24 and must never change.
const FROZEN_1_TO_15 = {"1":["n-percent:2","sci-sodium:1","wo-liberty:1","w-ephemeral:3","bd-sectors:0"],"2":["sci-photo:2","wo-india:1","w-ubiquitous:3","bd-un:2","n-updown:0"],"3":["wo-pacific:1","w-abundant:0","bd-anthem:1","n-coins:0","sci-nitrogen:3"],"4":["w-ancient:0","bd-tiger:0","n-linear:3","sci-light:2","wo-timezones:3"],"5":["bd-flower:3","n-discount:3","sci-ph:0","wo-versailles:0","w-obsequious:0"],"6":["n-double:3","sci-bones:3","wo-vatican:3","w-mitigate:0","bd-coral:1"],"7":["sci-mercury:0","wo-everest:0","w-spelling:2","bd-padma:0","n-lineup:1"],"8":["wo-tokyo:1","w-reluctant:3","bd-nazrul:0","n-hexagon:1","sci-donor:3"],"9":["w-brief:0","bd-motherlang:2","n-speed:2","sci-carbon:0","wo-malacca:3"],"10":["bd-victory:0","n-average:0","sci-mito:2","wo-geneva:3","w-acrophobia:2"],"11":["n-times:1","sci-boil:0","wo-mandarin:0","w-candid:1","bd-falgun:1"],"12":["sci-water:2","wo-giza:0","w-benevolent:1","bd-rangamati:2","n-interest:2"],"13":["wo-asia:2","w-frugal:0","bd-coxs:0","n-circle:3","sci-moons:1"],"14":["w-children:0","bd-border:2","n-power:3","sci-diamond:1","wo-lesotho:3"],"15":["bd-dhaka:1","n-sqrt:1","sci-vitd:1","wo-canada:0","w-ineffable:2"]};

describe('daily freeze: puzzles #1–#15 never change', () => {
  it('keeps the same questions and answer positions for #1–#15', () => {
    for (let n = 1; n <= 15; n += 1) {
      expect(questionsFor(n).map((q) => `${q.id}:${q.answer}`), `puzzle #${n}`).toEqual(FROZEN_1_TO_15[n]);
    }
  });
});

describe('daily rotation after the freeze', () => {
  const idsOf = (from, to) => {
    const ids = [];

    for (let n = from; n <= to; n += 1) ids.push(...questionsFor(n).map((q) => q.id));

    return ids;
  };

  it('repeats no question inside #16–#45', () => {
    const ids = idsOf(16, 45);

    expect(ids).toHaveLength(150);
    expect(new Set(ids).size).toBe(150);
  });

  it('shows only new questions on #16–#30, so nothing from #1–#15 comes back early', () => {
    const early = new Set(idsOf(1, 15));

    expect(early.size).toBe(75);
    expect(idsOf(16, 30).filter((id) => early.has(id))).toEqual([]);
  });

  it('never shows the same question twice within 20 days, across cycle boundaries', () => {
    const last = new Map();

    for (let n = 1; n <= 200; n += 1) {
      for (const q of questionsFor(n)) {
        if (last.has(q.id)) expect(n - last.get(q.id), `${q.id} on #${n}`).toBeGreaterThanOrEqual(20);
        last.set(q.id, n);
      }
    }
  });
});
