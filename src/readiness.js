// Exam readiness: one honest 0-100 estimate per section and overall.
//
// It starts from the AI diagnostic (the baseline) and, as the student reviews
// cards in a section's subject, moves towards their recent recall rate. More
// practice means more weight on practice, up to 60%. It is an estimate of
// where the student stands against the target, not a prediction of the exam.

import { getPath, scaleOf } from './paths';
import { estimateScore } from './sat/score';
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

// The student's last three mock tests that included this section.
const MOCK_RECENT = 3;
const MIN_MOCK_QUESTIONS = 3;

// A prepared mock only counts the first time it is taken, so retaking the same
// paper cannot inflate the score. Custom mocks always count.
export function countedMocks(mocks = []) {
  const seen = new Set();

  return [...mocks]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .filter((m) => {
      if (!String(m.source || '').startsWith('prepared:')) return true;
      if (seen.has(m.source)) return false;

      seen.add(m.source);

      return true;
    });
}

export function mockStats(sectionId, mocks = []) {
  const recent = countedMocks(mocks)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((m) => m.sections?.find((s) => s.id === sectionId))
    .filter((s) => s && s.total >= MIN_MOCK_QUESTIONS)
    .slice(0, MOCK_RECENT);
  const total = recent.reduce((sum, s) => sum + s.total, 0);
  const correct = recent.reduce((sum, s) => sum + s.correct, 0);

  return { count: recent.length, score: total > 0 ? Math.round((correct / total) * 100) : null };
}

// diagnostic: { sections: [{ id, correct, total }], essay: { score } | null } or null.
export function computeReadiness(pathId, diagnostic, reviews = [], now = new Date(), mocks = []) {
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

    // Mock tests are a second, longer look at the same section: they count for
    // 60% of the baseline once there is one (the diagnostic keeps 40%).
    const mock = mockStats(entry.id, mocks);

    let baseline = diagScore;

    if (mock.score !== null) baseline = diagScore === null ? mock.score : Math.round(diagScore * 0.4 + mock.score * 0.6);

    const practice = practiceStats(entry.cardSubject, reviews, now);
    const practiceScore = practice.count >= MIN_PRACTICE_REVIEWS ? Math.round(practice.rate * 100) : null;
    let score = null;

    if (baseline !== null && practiceScore !== null) {
      const weight = Math.min(MAX_PRACTICE_WEIGHT, (practice.count / FULL_WEIGHT_AT) * MAX_PRACTICE_WEIGHT);

      score = Math.round(baseline * (1 - weight) + practiceScore * weight);
    } else {
      score = baseline ?? practiceScore;
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
      mockScore: mock.score,
      mockCount: mock.count,
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

// Readiness for any path, in the shape the rest of the app expects. A SAT
// path reports an estimated score (400-1600) instead of a 0-100 readiness.
export function readinessFor(pathId, diagnostic, reviews = [], now = new Date(), mocks = []) {
  const path = getPath(pathId);

  if (!path) return null;
  if (path.engine !== 'sat') return computeReadiness(pathId, diagnostic, reviews, now, mocks);

  const estimate = estimateScore(diagnostic, mocks, now);
  const sections = estimate.sections.map((s) => ({ ...s, marks: 800 }));
  const measured = sections.filter((s) => s.score !== null);

  return {
    overall: estimate.overall,
    low: estimate.low,
    high: estimate.high,
    sections,
    weakest: measured.length > 1 ? [...measured].sort((a, b) => a.score - b.score)[0] : null,
    coverage: measured.length / sections.length,
  };
}

// Where the student stands against their own target. `scale` comes from
// scaleOf(path): how close counts as "close" differs between 0-100 and 400-1600.
export function describeProgress(overall, target, daysLeft = null, scale = { close: 10, building: 25, step: 1 }) {
  if (overall === null) return { band: 'unmeasured', label: 'Not measured yet', gap: null, perWeek: null };

  const gap = Math.max(0, target - overall);
  let band = 'early';

  if (overall >= target) band = 'ready';
  else if (overall >= target - scale.close) band = 'close';
  else if (overall >= target - scale.building) band = 'building';

  const label = { ready: 'On target', close: 'Close to target', building: 'Building up', early: 'Early days' }[band];
  const weeks = daysLeft !== null && daysLeft > 0 ? daysLeft / 7 : null;
  const step = scale.step || 1;

  return { band, label, gap, perWeek: weeks && gap > 0 ? Math.max(step, Math.ceil(gap / weeks / step) * step) : null };
}

export function daysLeftFor(examDate, now = new Date()) {
  return examDate ? daysUntil(examDate, now) : null;
}

// What the AI is told: only measured facts from the diagnostic.
export function analysisPayload(pathId, diagnostic, examDate, target, now = new Date()) {
  const path = getPath(pathId);

  return {
    action: 'analyze',
    path: pathId,
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
    mistakes: mistakesOf(diagnostic).slice(0, 10).map((m) => ({
      section: m.sectionId,
      topic: m.topic,
      question: m.question,
      picked: m.pickedText,
      correct: m.correctText,
    })),
  };
}

// Every question a diagnostic got wrong, in one shape for every exam:
// { sectionId, sectionName, topic, question, passage, options, correctIndex, pickedIndex, correctText, pickedText, explain }
export function mistakesOf(diagnostic) {
  const out = [];

  for (const section of diagnostic?.sections || []) {
    for (const m of section.missed || []) {
      if (!m.question) continue;

      const options = Array.isArray(m.options) ? m.options : null;
      const correctIndex = Number.isInteger(m.correct) ? m.correct : null;
      const pickedIndex = Number.isInteger(m.picked) ? m.picked : null;

      out.push({
        sectionId: section.id,
        sectionName: section.name,
        topic: m.topic || section.name,
        question: m.question,
        passage: m.passage || '',
        // Long passages (NSU reading) cannot fit on a card; short SAT passages go on the card.
        needsPassage: Boolean(m.needsPassage) || String(m.passage || '').length > 700,
        options,
        correctIndex,
        pickedIndex,
        correctText: m.correctText || (options && correctIndex !== null ? options[correctIndex] : ''),
        pickedText: m.pickedText || (options && pickedIndex !== null ? options[pickedIndex] : ''),
        explain: m.explain || '',
      });
    }
  }

  return out;
}
