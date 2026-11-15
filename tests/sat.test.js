import { describe, expect, it } from 'vitest';
import { PRO_BANK } from '../api/_satBank.js';
import { isActive, listedAsPro } from '../api/_plan.js';
import { describePlan } from '../src/plan.js';
import { pickActive } from '../src/pathStore.js';
import { describeProgress, readinessFor } from '../src/readiness.js';
import { getPath, scaleOf } from '../src/paths.js';
import { accessFor, FREE } from '../src/sat/access.js';
import { isCorrect, missedAsCards, parseTyped, scoreItems, typedIsCorrect } from '../src/sat/answers.js';
import { buildDiagnostic, buildDrill, buildModule, levelQuotas, routeFor } from '../src/sat/assemble.js';
import { FREE_BANK } from '../src/sat/bank/free.js';
import { SECTIONS, SKILLS } from '../src/sat/blueprint.js';
import { buildMissions, buildStudyPlan, nextStep } from '../src/sat/coach.js';
import { estimateScore, halfWidth, scaledFrom, scoreHistory } from '../src/sat/score.js';
import { nextSkill, seenIds, skillMap } from '../src/sat/skills.js';

const FULL = [...FREE_BANK, ...PRO_BANK];
const NOW = new Date('2026-11-15T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
const section = (id, correct, total, extra = {}) => ({ id, correct, total, topics: [], missed: [], ids: [], ...extra });

describe('typed answers', () => {
  it('reads whole numbers, decimals and fractions', () => {
    expect(parseTyped('12')).toBe(12);
    expect(parseTyped(' 3/4 ')).toBe(0.75);
    expect(parseTyped('-.5')).toBe(-0.5);
    expect(parseTyped('1/0')).toBeNull();
    expect(parseTyped('abc')).toBeNull();
    expect(parseTyped('')).toBeNull();
  });

  it('accepts equal values in any form', () => {
    expect(typedIsCorrect('0.75', [0.75])).toBe(true);
    expect(typedIsCorrect('3/4', [0.75])).toBe(true);
    expect(typedIsCorrect('6/8', [0.75])).toBe(true);
    expect(typedIsCorrect('0.7', [0.75])).toBe(false);
  });

  it('accepts a long decimal rounded or cut, but not too short', () => {
    expect(typedIsCorrect('2/3', [2 / 3])).toBe(true);
    expect(typedIsCorrect('0.666', [2 / 3])).toBe(true);
    expect(typedIsCorrect('0.667', [2 / 3])).toBe(true);
    expect(typedIsCorrect('.6667', [2 / 3])).toBe(true);
    expect(typedIsCorrect('0.66', [2 / 3])).toBe(false);
    expect(typedIsCorrect('0.67', [2 / 3])).toBe(false);
  });
});

describe('the question bank', () => {
  it('keeps free and Pro questions apart', () => {
    const free = new Set(FREE_BANK.map((q) => q.id));

    expect(PRO_BANK.some((q) => free.has(q.id))).toBe(false);
    expect(new Set(FULL.map((q) => q.id)).size).toBe(FULL.length);
  });

  it('has every skill in the free bank', () => {
    for (const skill of Object.keys(SKILLS)) expect(FREE_BANK.some((q) => q.skill === skill)).toBe(true);
  });

  it('marks its own keys as correct', () => {
    for (const q of FULL) {
      const answer = q.type === 'spr' ? q.accept[0] : q.answer;

      expect(isCorrect(q, answer), q.id).toBe(true);
      if (q.type === 'spr') for (const shown of q.accept) expect(typedIsCorrect(shown, q.values), q.id).toBe(true);
    }
  });
});

describe('building sets', () => {
  it('splits a count over the levels', () => {
    expect(levelQuotas(27, [0.3, 0.45, 0.25]).reduce((a, b) => a + b)).toBe(27);
    expect(levelQuotas(8, [0.1, 0.35, 0.55])).toEqual([1, 3, 4]);
  });

  for (const bankName of ['free', 'full']) {
    const bank = bankName === 'free' ? FREE_BANK : FULL;

    it(`fills a module of each section from the ${bankName} bank`, () => {
      for (const id of ['rw', 'math']) {
        const items = buildModule(bank, id, { seed: 7 });

        expect(items).toHaveLength(SECTIONS[id].moduleQuestions);
        expect(new Set(items.map((q) => q.id)).size).toBe(items.length);

        for (const domain of SECTIONS[id].domains) expect(items.filter((q) => q.domain === domain.id)).toHaveLength(domain.perModule);
      }
    });
  }

  it('gives the same set for the same seed and a different one otherwise', () => {
    const a = buildModule(FULL, 'rw', { seed: 3 }).map((q) => q.id);

    expect(buildModule(FULL, 'rw', { seed: 3 }).map((q) => q.id)).toEqual(a);
    expect(buildModule(FULL, 'rw', { seed: 4 }).map((q) => q.id)).not.toEqual(a);
  });

  it('makes the harder route harder than the easier one', () => {
    const mean = (items) => items.reduce((sum, q) => sum + q.level, 0) / items.length;

    for (const id of ['rw', 'math']) {
      expect(mean(buildModule(FULL, id, { route: 'hard', seed: 5 }))).toBeGreaterThan(mean(buildModule(FULL, id, { route: 'easy', seed: 5 })) + 0.5);
    }
  });

  it('avoids questions already seen when it can', () => {
    const first = buildModule(FULL, 'math', { seed: 1 });
    const seen = new Set(first.map((q) => q.id));
    const second = buildModule(FULL, 'math', { route: 'hard', seen, seed: 2 });

    expect(second.some((q) => seen.has(q.id))).toBe(false);
  });

  it('can fill a whole adaptive Reading and Writing test without repeats', () => {
    const first = buildModule(FULL, 'rw', { seed: 1 });
    const seen = new Set(first.map((q) => q.id));

    for (const route of ['hard', 'easy']) {
      const second = buildModule(FULL, 'rw', { route, seen, seed: 2 });

      expect(second).toHaveLength(27);
      expect(second.some((q) => seen.has(q.id))).toBe(false);
    }
  });

  it('orders Math from easier to harder and Reading and Writing by domain', () => {
    const math = buildModule(FULL, 'math', { seed: 9 }).map((q) => q.level);

    expect(math).toEqual([...math].sort((a, b) => a - b));

    const order = SECTIONS.rw.domains.map((d) => d.id);
    const rw = buildModule(FULL, 'rw', { seed: 9 }).map((q) => order.indexOf(q.domain));

    expect(rw).toEqual([...rw].sort((a, b) => a - b));
  });

  it('builds a 12-question diagnostic per section and a one-skill drill', () => {
    expect(buildDiagnostic(FREE_BANK, 'rw', { seed: 2 })).toHaveLength(12);
    expect(buildDiagnostic(FREE_BANK, 'math', { seed: 2 })).toHaveLength(12);

    const drill = buildDrill(FULL, { skill: 'bnd', seed: 2 });

    expect(drill).toHaveLength(10);
    expect(drill.every((q) => q.skill === 'bnd')).toBe(true);
  });

  it('routes on the first module', () => {
    expect(routeFor(17, 27)).toBe('hard');
    expect(routeFor(16, 27)).toBe('easy');
    expect(routeFor(0, 0)).toBe('easy');
  });
});

describe('marking a set', () => {
  const items = buildModule(FULL, 'math', { seed: 11 });
  const answers = Object.fromEntries(
    items.map((q, i) => [q.id, i % 2 === 0 ? (q.type === 'spr' ? q.accept[0] : q.answer) : q.type === 'spr' ? '999999' : (q.answer + 1) % 4])
  );
  const result = scoreItems('math', items, answers);

  it('counts right and wrong answers', () => {
    expect(result.correct).toBe(11);
    expect(result.total).toBe(22);
    expect(result.missed).toHaveLength(11);
    expect(result.topics.reduce((sum, t) => sum + t.total, 0)).toBe(22);
    expect(result.ids).toHaveLength(22);
  });

  it('turns misses into cards under the SAT subject', () => {
    const cards = missedAsCards([result]);

    expect(cards).toHaveLength(11);
    expect(cards.every((c) => c.subject === 'SAT Math' && c.correctAnswer && c.question)).toBe(true);
  });

  it('keeps the passage with a Reading and Writing card', () => {
    const q = FREE_BANK.find((x) => x.section === 'rw');
    const [card] = missedAsCards([scoreItems('rw', [q], {})]);

    expect(card.question).toContain(q.passage.slice(0, 30));
    expect(card.distractors).toHaveLength(3);
    expect(card.yourAnswer).toBe('');
  });
});

describe('the score estimate', () => {
  it('turns shares into section scores', () => {
    expect(scaledFrom(0, 27)).toBe(200);
    expect(scaledFrom(27, 27, 'hard')).toBe(800);
    expect(scaledFrom(27, 27, 'easy')).toBe(600);
    expect(scaledFrom(22, 44, 'hard')).toBe(500);
    expect(scaledFrom(5, 0)).toBeNull();
    expect(scaledFrom(20, 27, 'hard') % 10).toBe(0);
  });

  it('never drops when more answers are right', () => {
    for (const route of ['hard', 'mixed', 'easy']) {
      let last = 0;

      for (let c = 0; c <= 54; c += 1) {
        const score = scaledFrom(c, 54, route);

        expect(score).toBeGreaterThanOrEqual(last);
        last = score;
      }
    }
  });

  it('has no total until both sections are measured', () => {
    const one = estimateScore(null, [{ source: 'sat:module:rw', createdAt: NOW, sections: [section('rw', 20, 27)] }], NOW);

    expect(one.overall).toBeNull();
    expect(one.sections.find((s) => s.id === 'rw').score).not.toBeNull();
    expect(estimateScore(null, [], NOW).overall).toBeNull();
  });

  it('uses a logged official score as it is', () => {
    const est = estimateScore(null, [{ source: 'official:bluebook', createdAt: NOW, sections: [{ id: 'rw', scaled: 600 }, { id: 'math', scaled: 650 }] }], NOW);

    expect(est.overall).toBe(1250);
    expect(est.low).toBeLessThan(1250);
    expect(est.high).toBeGreaterThan(1250);
  });

  it('trusts an official score more than a diagnostic', () => {
    const diagnostic = { createdAt: NOW, sections: [section('rw', 12, 12), section('math', 12, 12)] };
    const official = { source: 'official:bluebook', createdAt: NOW, sections: [{ id: 'rw', scaled: 500 }, { id: 'math', scaled: 500 }] };
    const est = estimateScore(diagnostic, [official], NOW);

    expect(est.overall).toBeLessThan((1000 + 1560) / 2);
    expect(est.overall).toBeGreaterThan(1000);
  });

  it('lets a recent result outweigh an old one of the same kind', () => {
    const old = { source: 'sat:full', createdAt: daysAgo(120), sections: [section('rw', 0, 54, { scaled: 400 }), section('math', 0, 44, { scaled: 400 })] };
    const fresh = { source: 'sat:full', createdAt: NOW, sections: [section('rw', 0, 54, { scaled: 700 }), section('math', 0, 44, { scaled: 700 })] };

    expect(estimateScore(null, [old, fresh], NOW).overall).toBeGreaterThan(1200);
  });

  it('narrows the range as evidence adds up', () => {
    expect(halfWidth(0.7)).toBeGreaterThan(halfWidth(3));
    expect(halfWidth(3)).toBeGreaterThan(halfWidth(12));
    expect(halfWidth(100)).toBe(30);
  });

  it('counts drills only a little, and only when there are enough', () => {
    const drill = (n) => ({ source: 'sat:drill:rw:bnd', createdAt: NOW, sections: [section('rw', n, n)] });

    expect(estimateScore(null, [drill(5)], NOW).sections[0].score).toBeNull();
    expect(estimateScore(null, [drill(10)], NOW).sections[0].score).not.toBeNull();
  });

  it('lists scored events for the history chart', () => {
    const mocks = [
      { source: 'official:bluebook', createdAt: NOW, sections: [{ id: 'rw', scaled: 600, takenOn: '2026-11-01' }, { id: 'math', scaled: 650, takenOn: '2026-11-01' }] },
      { source: 'sat:drill:rw:bnd', createdAt: NOW, sections: [section('rw', 10, 10)] },
    ];
    const history = scoreHistory({ createdAt: daysAgo(30), sections: [section('rw', 6, 12), section('math', 6, 12)] }, mocks, NOW);

    expect(history.map((h) => h.kind)).toEqual(['diag', 'official']);
    expect(history[1].total).toBe(1250);
  });
});

describe('the skill map', () => {
  const topics = (skill, correct, total) => ({ topic: skill, skill, domain: SKILLS[skill].domain, correct, total });
  const mocks = [{ source: 'sat:drill:rw:bnd', createdAt: NOW, sections: [section('rw', 3, 10, { topics: [topics('bnd', 3, 10)], ids: ['rw-bnd-1'] })] }];
  const diagnostic = { createdAt: NOW, sections: [section('rw', 2, 2, { topics: [topics('wic', 2, 2)], ids: ['rw-wic-1'] })] };
  const map = skillMap(diagnostic, mocks, NOW);

  it('rates a skill only after three answers', () => {
    expect(map.skills.bnd.state).toBe('weak');
    expect(map.skills.bnd.pct).toBe(30);
    expect(map.skills.wic.state).toBe('unseen');
    expect(map.skills.trig.total).toBe(0);
  });

  it('recommends the weakest measured skill first', () => {
    expect(nextSkill(map).id).toBe('bnd');
    expect(nextSkill(skillMap(null, [], NOW)).state).toBe('unseen');
  });

  it('forgets answers older than the window', () => {
    const stale = [{ ...mocks[0], createdAt: daysAgo(90) }];

    expect(skillMap(null, stale, NOW).skills.bnd.total).toBe(0);
  });

  it('collects every question already seen', () => {
    expect([...seenIds(diagnostic, mocks)].sort()).toEqual(['rw-bnd-1', 'rw-wic-1']);
  });
});

describe('paths and readiness on two scales', () => {
  it('describes the SAT path on the 400-1600 scale', () => {
    const sat = getPath('sat');

    expect(sat.totalMarks).toBe(1600);
    expect(scaleOf(sat)).toMatchObject({ min: 400, max: 1600, targetMax: 1600, step: 10 });
    expect(scaleOf(getPath('nsu'))).toMatchObject({ targetMin: 40, targetMax: 95, close: 10 });
  });

  it('reports a SAT estimate through the shared readiness entry point', () => {
    const mocks = [{ source: 'official:bluebook', createdAt: NOW, sections: [{ id: 'rw', scaled: 600 }, { id: 'math', scaled: 650 }] }];
    const ready = readinessFor('sat', null, [], NOW, mocks);

    expect(ready.overall).toBe(1250);
    expect(ready.weakest.id).toBe('rw');
    expect(ready.coverage).toBe(1);
    expect(readinessFor('nsu', null, [], NOW, []).overall).toBeNull();
  });

  it('bands progress by the scale in use', () => {
    const sat = scaleOf(getPath('sat'));

    expect(describeProgress(1250, 1500, 119, sat)).toMatchObject({ band: 'early', gap: 250, perWeek: 20 });
    expect(describeProgress(1460, 1500, null, sat).band).toBe('close');
    expect(describeProgress(1500, 1500, null, sat).band).toBe('ready');
    expect(describeProgress(60, 75, 14).band).toBe('building');
    expect(describeProgress(null, 75).band).toBe('unmeasured');
  });

  it('picks the active path, falling back to the newest', () => {
    const rows = [
      { path_id: 'nsu', updated_at: '2026-11-10', is_active: false },
      { path_id: 'sat', updated_at: '2026-11-01', is_active: true },
    ];

    expect(pickActive(rows).path_id).toBe('sat');
    expect(pickActive(rows.map((row) => ({ path_id: row.path_id, updated_at: row.updated_at }))).path_id).toBe('nsu');
    expect(pickActive([])).toBeNull();
  });
});

describe('free and Pro', () => {
  const drill = { source: 'sat:drill:rw:bnd', createdAt: NOW, sections: [] };
  const timed = { source: 'sat:module:rw', createdAt: daysAgo(3), sections: [] };

  it('gives a free account three drills a day and a module per section each week', () => {
    const fresh = accessFor({ pro: false }, [], NOW);

    expect(fresh.drill.allowed).toBe(true);
    expect(fresh.module('rw').allowed).toBe(true);
    expect(fresh.fullTest.allowed).toBe(false);
    expect(fresh.explanations).toBe(Infinity);
    expect(fresh.drill.left).toBe(FREE.drillsPerDay);

    expect(accessFor({ pro: false }, [drill, drill], NOW).drill.allowed).toBe(true);

    const used = accessFor({ pro: false }, [drill, drill, drill, timed], NOW);

    expect(used.drill.allowed).toBe(false);
    expect(used.module('rw').allowed).toBe(false);
    expect(used.module('math').allowed).toBe(true);
    expect(accessFor({ pro: false }, [{ ...drill, createdAt: daysAgo(1) }], NOW).drill.allowed).toBe(true);
    expect(accessFor({ pro: false }, [{ ...timed, createdAt: daysAgo(8) }], NOW).module('rw').allowed).toBe(true);
  });

  it('removes every limit for Pro', () => {
    const pro = accessFor({ pro: true }, [drill, drill, timed, timed], NOW);

    expect(pro.drill.allowed && pro.module('rw').allowed && pro.fullTest.allowed && pro.coach.allowed && pro.plan.allowed).toBe(true);
    expect(pro.explanations).toBe(Infinity);
  });

  it('reads a plan from its end date', () => {
    expect(describePlan(null, NOW).pro).toBe(false);
    expect(describePlan(daysAgo(1), NOW).pro).toBe(false);
    expect(describePlan(new Date(NOW.getTime() + 36 * 3600000), NOW)).toMatchObject({ pro: true, daysLeft: 2 });
    expect(isActive(daysAgo(-1), NOW)).toBe(true);
    expect(isActive('nonsense', NOW)).toBe(false);
  });

  it('lists only verified emails as Pro on the server', () => {
    const env = { PRO_EMAILS: 'Owner@Example.com, tester@example.com' };

    expect(listedAsPro(env, { email: 'owner@example.com', email_confirmed_at: 'x' })).toBe(true);
    expect(listedAsPro(env, { email: 'owner@example.com' })).toBe(false);
    expect(listedAsPro(env, { email: 'other@example.com', email_confirmed_at: 'x' })).toBe(false);
    expect(listedAsPro({}, { email: 'owner@example.com', email_confirmed_at: 'x' })).toBe(false);
  });
});

describe('guidance', () => {
  const empty = estimateScore(null, [], NOW);
  const blank = skillMap(null, [], NOW);

  it('starts with the diagnostic', () => {
    expect(nextStep({ estimate: empty, map: blank, mocks: [], now: NOW }).action.type).toBe('diagnostic');
    expect(buildMissions({ estimate: empty, map: blank, now: NOW }).missions[0].id).toBe('diagnostic');
  });

  it('plans phases that cover every week to the test', () => {
    const mocks = [{ source: 'official:bluebook', createdAt: NOW, sections: [{ id: 'rw', scaled: 600 }, { id: 'math', scaled: 650 }] }];
    const plan = buildStudyPlan({ estimate: estimateScore(null, mocks, NOW), target: 1500, daysLeft: 119, now: NOW });

    expect(plan.weeks).toBe(17);
    expect(plan.phases[0].from).toBe(1);
    expect(plan.phases.at(-1).to).toBe(17);
    expect(plan.phases.at(-1).milestone).toBe(1500);

    for (let i = 1; i < plan.phases.length; i += 1) expect(plan.phases[i].from).toBe(plan.phases[i - 1].to + 1);

    expect(buildStudyPlan({ estimate: empty, target: 1400, daysLeft: null, now: NOW })).toMatchObject({ weeks: 12, noDate: true });
    expect(buildStudyPlan({ estimate: empty, target: 1400, daysLeft: 3, now: NOW }).phases.length).toBeGreaterThan(0);
  });
});
