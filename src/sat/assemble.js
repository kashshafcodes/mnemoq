// Builds SAT question sets from the bank: a diagnostic, a drill, or a test
// module. The second module of a section is routed harder or easier from the
// first, which is what makes a full test adaptive.
//
// Pure functions: the same bank, seed and "already seen" list always give the
// same set, so they can be tested.

import { DIAGNOSTIC_MIX, DRILL_LENGTH, SECTIONS } from './blueprint';

// Share of easier / medium / harder questions in each kind of set.
export const LEVEL_MIX = {
  mixed: [0.3, 0.45, 0.25],
  hard: [0.1, 0.35, 0.55],
  easy: [0.55, 0.35, 0.1],
};

// Our own rule, not College Board's (theirs is not public): 60% or more on
// the first module opens the harder second module.
export const HARD_ROUTE_AT = 0.6;

export const routeFor = (correct, total) => (total > 0 && correct / total >= HARD_ROUTE_AT ? 'hard' : 'easy');

// Small seeded random number generator (mulberry32).
export function seeded(seed) {
  let state = (Number(seed) || 1) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

// Splits `count` over the three levels by `mix`, giving leftovers to the largest remainders.
export function levelQuotas(count, mix) {
  const exact = mix.map((share) => share * count);
  const quotas = exact.map(Math.floor);
  let left = count - quotas.reduce((a, b) => a + b, 0);
  const order = exact.map((value, i) => [value - Math.floor(value), i]).sort((a, b) => b[0] - a[0]);

  for (let i = 0; left > 0; i += 1, left -= 1) quotas[order[i % 3][1]] += 1;

  return quotas;
}

// Picks `count` questions from `pool`: spread over its skills, close to the
// level mix, new questions before ones already seen.
export function pick(pool, count, mix, seen, rand) {
  const candidates = shuffled(pool, rand).sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
  const skills = shuffled([...new Set(pool.map((q) => q.skill))], rand);
  const quotas = levelQuotas(count, mix);
  const taken = new Set();
  const chosen = [];

  const take = (test) => {
    const found = candidates.find((q) => !taken.has(q.id) && test(q));

    if (found) {
      taken.add(found.id);
      chosen.push(found);
      quotas[found.level - 1] -= 1;
    }

    return Boolean(found);
  };

  for (let i = 0; i < count && skills.length > 0; i += 1) {
    const skill = skills[i % skills.length];
    // The level that still needs the most questions comes first.
    const levels = [1, 2, 3].sort((a, b) => quotas[b - 1] - quotas[a - 1]);
    const fresh = (q) => !seen.has(q.id);

    if (levels.some((level) => quotas[level - 1] > 0 && take((q) => q.skill === skill && q.level === level && fresh(q)))) continue;
    if (levels.some((level) => quotas[level - 1] > 0 && take((q) => q.level === level && fresh(q)))) continue;
    if (take((q) => q.skill === skill && fresh(q)) || take(fresh)) continue;
    if (take((q) => q.skill === skill)) continue;
    if (!take(() => true)) break;
  }

  return chosen;
}

// Reading and Writing keeps the test's domain order; Math runs from easier to harder.
function inTestOrder(sectionId, items) {
  if (sectionId === 'math') return [...items].sort((a, b) => a.level - b.level);

  const domainOrder = SECTIONS.rw.domains.map((d) => d.id);
  const skillOrder = SECTIONS.rw.domains.flatMap((d) => d.skills.map((s) => s.id));

  return [...items].sort(
    (a, b) =>
      domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain) ||
      skillOrder.indexOf(a.skill) - skillOrder.indexOf(b.skill) ||
      a.level - b.level
  );
}

function byDomainCounts(bank, sectionId, counts, mix, seen, rand) {
  const items = SECTIONS[sectionId].domains.flatMap((domain) =>
    pick(bank.filter((q) => q.section === sectionId && q.domain === domain.id), counts[domain.id] || 0, mix, seen, rand)
  );

  return inTestOrder(sectionId, items);
}

// One test module (27 Reading and Writing or 22 Math questions).
// route: 'mixed' for a first module, 'hard' or 'easy' for a second one.
export function buildModule(bank, sectionId, { route = 'mixed', seen = new Set(), seed = 1 } = {}) {
  const counts = Object.fromEntries(SECTIONS[sectionId].domains.map((d) => [d.id, d.perModule]));

  return byDomainCounts(bank, sectionId, counts, LEVEL_MIX[route] || LEVEL_MIX.mixed, seen, seeded(seed));
}

export function buildDiagnostic(bank, sectionId, { seen = new Set(), seed = 1 } = {}) {
  return byDomainCounts(bank, sectionId, DIAGNOSTIC_MIX[sectionId], LEVEL_MIX.mixed, seen, seeded(seed));
}

// A drill on one skill (or one whole domain), from easier to harder.
export function buildDrill(bank, { skill = null, domain = null, count = DRILL_LENGTH, seen = new Set(), seed = 1 } = {}) {
  const pool = bank.filter((q) => (skill ? q.skill === skill : q.domain === domain));

  return pick(pool, Math.min(count, pool.length), LEVEL_MIX.mixed, seen, seeded(seed)).sort((a, b) => a.level - b.level);
}
