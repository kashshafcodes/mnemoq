// Exam readiness: one honest 0-100 estimate per section and overall.
//
// It starts from the AI diagnostic (the baseline) and, as the student reviews
// cards in a section's subject, moves towards their recent recall rate. More
// practice means more weight on practice, up to 60%. It is an estimate of
// where the student stands against the target, not a prediction of the exam.

import { getPath } from './paths';
import { daysUntil } from './pilot';

const DAY_MS = 24 * 60 * 60 * 1000;
export const PRACTICE_WINDOW_DAYS = 30;
const MIN_PRACTICE_REVIEWS = 5;
const MAX_PRACTICE_WEIGHT = 0.6;
const FULL_WEIGHT_AT = 30; // reviews

const same = (a, b) => String(a ?? '').trim().toLocaleLowerCase() === String(b ?? '').trim().toLocaleLowerCase();

export const percent = (correct, total) => (total > 0 ? Math.round((correct / total) * 100) : null);

// Recall rate over the last 30 days for cards in one subject.
export function practiceStats(subject, reviews = [], now = new Date()) {
  const since = now.getTime() - PRACTICE_WINDOW_DAYS * DAY_MS;
  const mine = reviews.filter((r) => same(r.subject, subject) && r.at && new Date(r.at).getTime() >= since);
  const recalled = mine.filter((r) => r.recalled).length;

  return { count: mine.length, recalled, rate: mine.length > 0 ? recalled / mine.length : null };
}

// diagnostic: { sections: [{ id, correct, total }], essay: { score } | null } or null.
export function computeReadiness(pathId, diagnostic, reviews = [], now = new Date()) {
  const path = getPath(pathId);

  if (!path) return null;

  const sections = path.subjects.map((entry) => {
    let diagScore = null;

    if (entry.aiMarked) {
      diagScore = Number.isFinite(diagnostic?.essay?.score) ? Math.round(diagnostic.essay.score) : null;
    } else {
      const found = diagnostic?.sections?.find((s) => s.id === entry.id);
      diagScore = found ? percent(found.correct, found.total) : null;
    }

    const practice = practiceStats(entry.cardSubject, reviews, now);
    const practiceScore = practice.count >= MIN_PRACTICE_REVIEWS ? Math.round(practice.rate * 100) : null;
    let score = null;

    if (diagScore !== null && practiceScore !== null) {
      const weight = Math.min(MAX_PRACTICE_WEIGHT, (practice.count / FULL_WEIGHT_AT) * MAX_PRACTICE_WEIGHT);

      score = Math.round(diagScore * (1 - weight) + practiceScore * weight);
    } else {
      score = diagScore ?? practiceScore;
    }

    return {
      id: entry.id,
      name: entry.name,
      cardSubject: entry.cardSubject,
      marks: entry.marks,
      aiMarked: Boolean(entry.aiMarked),
      diagScore,
      practiceScore,
      practiceCount: practice.count,
      score,
    };
  });

  const measured = sections.filter((s) => s.score !== null);
  const measuredMarks = measured.reduce((sum, s) => sum + s.marks, 0);
  const overall =
    measuredMarks > 0 ? Math.round(measured.reduce((sum, s) => sum + s.marks * s.score, 0) / measuredMarks) : null;
  const weakest = measured.length > 1 ? [...measured].sort((a, b) => a.score - b.score)[0] : null;

  return {
    overall,
    sections,
    weakest,
    // 1 when every section has a score; less when some are not measured yet.
    coverage: path.totalMarks > 0 ? measuredMarks / path.totalMarks : 0,
  };
}

// Where the student stands against their own target.
export function describeProgress(overall, target, daysLeft = null) {
  if (overall === null) return { band: 'unmeasured', label: 'Not measured yet', gap: null, perWeek: null };

  const gap = Math.max(0, target - overall);
  let band = 'early';

  if (overall >= target) band = 'ready';
  else if (overall >= target - 10) band = 'close';
  else if (overall >= target - 25) band = 'building';

  const label = { ready: 'On target', close: 'Close to target', building: 'Building up', early: 'Early days' }[band];
  const weeks = daysLeft !== null && daysLeft > 0 ? daysLeft / 7 : null;

  return { band, label, gap, perWeek: weeks && gap > 0 ? Math.max(1, Math.ceil(gap / weeks)) : null };
}

export function daysLeftFor(examDate, now = new Date()) {
  return examDate ? daysUntil(examDate, now) : null;
}

// What the AI is told: only measured facts from the diagnostic.
export function analysisPayload(pathId, diagnostic, examDate, target, now = new Date()) {
  const path = getPath(pathId);

  return {
    action: 'analyze',
    daysLeft: daysLeftFor(examDate, now),
    target,
    sections: (diagnostic.sections || []).map((s) => ({
      id: s.id,
      name: s.name,
      marks: path?.subjects.find((x) => x.id === s.id)?.marks || 0,
      correct: s.correct,
      total: s.total,
      topics: s.topics,
    })),
    essay: diagnostic.essay ? { score: diagnostic.essay.score, criteria: diagnostic.essay.criteria } : null,
  };
}
