// The Memory map's numbers (pure). Spec: company/product/phase2-glow-memory-map.md
// §4 (blocks) and §5 (states). The screen is src/progress/MemoryMap.jsx.

import { STAGES, bySubject, cardStage, computeStreaks } from '../analytics';
import { levelFor } from '../glow/glow';

// Fewer reviews than this and a skill says "not enough yet" (readiness.js).
export const MIN_SKILL_REVIEWS = 5;

// Kept = recalled after a gap of 4+ days ("strong") or mastered.
export function keptCards(cards = []) {
  const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0]));

  for (const card of cards) counts[cardStage(card)] += 1;

  return {
    n: counts.strong + counts.mastered,
    total: cards.length,
    stages: STAGES.map((s) => ({ id: s.id, count: counts[s.id] })),
  };
}

// One row per path section when there is a path, else per card subject.
// score is 0-100 (or the path's own scale) or null for "not enough yet".
export function skillRows(cards = [], reviews = [], pathInfo = null, now = new Date()) {
  if (pathInfo?.sections?.length) {
    return pathInfo.sections.map((s) => ({ id: s.id, name: s.name, score: s.score ?? null, max: pathInfo.engine === 'sat' ? 800 : 100 }));
  }

  return bySubject(cards, reviews, now).map((s) => ({
    id: s.name,
    name: s.name,
    score: s.reviews >= MIN_SKILL_REVIEWS ? Math.round((s.recalled / s.reviews) * 100) : null,
    max: 100,
  }));
}

// What the readiness block says. Never a made-up number.
export function readinessBlock(pathInfo) {
  if (!pathInfo) return { kind: 'noPath' };
  if (!pathInfo.hasDiagnostic || pathInfo.readiness === null || pathInfo.readiness === undefined) return { kind: 'noCheck', name: pathInfo.short || pathInfo.name };

  return {
    kind: 'score',
    name: pathInfo.short || pathInfo.name,
    score: pathInfo.readiness,
    target: pathInfo.target,
    daysLeft: pathInfo.daysLeft,
    band: pathInfo.progress?.band || 'unmeasured',
    weakest: pathInfo.weakest ? { id: pathInfo.weakest.id, name: pathInfo.weakest.name } : null,
  };
}

// Everything on the map. historyOk false = the review history failed to load:
// the streak is unknown (shown as "—"), never 0.
export function memoryMapData({ cards = [], reviews = [], extraDays = [], pathInfo = null, glowTotal = 0, historyOk = true, now = new Date() } = {}) {
  const streak = historyOk ? computeStreaks(reviews, now, extraDays) : null;
  const kept = keptCards(cards);
  const empty = cards.length === 0 && reviews.length === 0 && (!streak || streak.best === 0);

  return {
    glow: historyOk ? { total: glowTotal, ...levelFor(glowTotal) } : null,
    ready: readinessBlock(pathInfo),
    streak,
    kept,
    skills: empty ? [] : skillRows(cards, reviews, pathInfo, now),
    empty,
  };
}

// Which blocks grew since the last visit (one soft pulse each).
export function grownNodes(before, now) {
  if (!before) return [];

  const out = [];

  if (now.streak && now.streak.current > (before.streak ?? 0)) out.push('streak');
  if (now.kept.n > (before.kept ?? 0)) out.push('kept');
  if (now.glow && now.glow.level > (before.level ?? 1)) out.push('glow');

  return out;
}

export function snapshot(data) {
  return { streak: data.streak?.current ?? 0, kept: data.kept.n, level: data.glow?.level ?? 1 };
}
