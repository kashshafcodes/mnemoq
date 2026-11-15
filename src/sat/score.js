// The SAT score estimate: 200-800 per section, 400-1600 in total, with a range.
//
// College Board does not publish how answers become scores, and the real test
// weighs each question differently. So this is an ESTIMATE built from what the
// student has actually done, and it always comes with a range:
//
//   1. Every scored event gives one section score.
//        official  a real score the student typed in (Bluebook or a test day)
//        full      a Mnemoq full adaptive test
//        module    one timed Mnemoq module
//        diag      the short diagnostic
//        drill     recent drills, taken together
//   2. Events are averaged, weighted by how much each kind can be trusted and
//      by how recent it is (an event loses half its weight every 45 days).
//   3. The range narrows as trusted evidence adds up.
//
// For Mnemoq's own tests the share of correct answers becomes a score through
// the curves below. They are our approximation of public score tables: a
// harder second module can reach 800, an easier one is capped near 600.

import { SCALE, SECTIONS, SECTION_IDS } from './blueprint';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CURVES = {
  hard: [[0, 200], [0.3, 400], [0.5, 500], [0.6, 550], [0.7, 600], [0.8, 660], [0.9, 730], [0.96, 770], [1, 800]],
  mixed: [[0, 200], [0.2, 290], [0.4, 400], [0.5, 460], [0.6, 520], [0.7, 580], [0.8, 640], [0.9, 710], [1, 780]],
  easy: [[0, 200], [0.3, 300], [0.5, 380], [0.7, 470], [0.85, 540], [1, 600]],
};

export const TRUST = { official: 3, full: 2, module: 1, diag: 0.7, drill: 0.5 };
export const HALF_LIFE_DAYS = 45;
export const DRILL_WINDOW_DAYS = 21;
const DRILL_FULL_AT = 40; // drill questions for the full drill weight
const MIN_DRILL_QUESTIONS = 10;

export const round10 = (value) => Math.round(value / 10) * 10;

const clampSection = (value) => Math.min(SCALE.sectionMax, Math.max(SCALE.sectionMin, round10(value)));

// Share correct (0 to 1) -> section score, by straight lines between the curve's points.
export function scaledFrom(correct, total, route = 'mixed') {
  if (!(total > 0)) return null;

  const share = Math.min(1, Math.max(0, correct / total));
  const curve = CURVES[route] || CURVES.mixed;

  for (let i = 1; i < curve.length; i += 1) {
    const [x0, y0] = curve[i - 1];
    const [x1, y1] = curve[i];

    if (share <= x1) return clampSection(y0 + ((share - x0) / (x1 - x0)) * (y1 - y0));
  }

  return SCALE.sectionMax;
}

export function kindOf(source) {
  const text = String(source || '');

  if (text.startsWith('official')) return 'official';
  if (text.startsWith('sat:full')) return 'full';
  if (text.startsWith('sat:module')) return 'module';
  if (text.startsWith('sat:diag')) return 'diag';

  return 'drill';
}

const validScore = (value) => Number.isFinite(value) && value >= SCALE.sectionMin && value <= SCALE.sectionMax;

// Every scored event, newest first: [{ section, score, kind, at, source }]
export function scoreEvents(diagnostic, mocks = [], now = new Date()) {
  const events = [];
  const drills = { rw: [0, 0], math: [0, 0] };
  const drillSince = now.getTime() - DRILL_WINDOW_DAYS * DAY_MS;

  const add = (section, kind, at, source) => {
    if (!SECTIONS[section.id]) return;

    const score = validScore(section.scaled) ? section.scaled : scaledFrom(section.correct, section.total, section.route || 'mixed');

    if (score !== null) events.push({ section: section.id, score, kind, at: new Date(at), source });
  };

  for (const section of diagnostic?.sections || []) add(section, 'diag', diagnostic.createdAt, 'sat:diag');

  for (const mock of mocks) {
    const kind = kindOf(mock.source);

    for (const section of mock.sections || []) {
      if (kind !== 'drill') {
        add(section, kind, section.takenOn ? `${section.takenOn}T12:00:00` : mock.createdAt, mock.source);
      } else if (drills[section.id] && new Date(mock.createdAt).getTime() >= drillSince) {
        drills[section.id][0] += section.correct || 0;
        drills[section.id][1] += section.total || 0;
      }
    }
  }

  for (const id of SECTION_IDS) {
    const [correct, total] = drills[id];

    if (total >= MIN_DRILL_QUESTIONS) {
      events.push({ section: id, score: scaledFrom(correct, total, 'mixed'), kind: 'drill', at: now, source: 'drills', questions: total });
    }
  }

  return events.sort((a, b) => b.at - a.at);
}

export function eventWeight(event, now = new Date()) {
  const ageDays = Math.max(0, (now.getTime() - event.at.getTime()) / DAY_MS);
  const trust = event.kind === 'drill' ? TRUST.drill * Math.min(1, (event.questions || 0) / DRILL_FULL_AT) : TRUST[event.kind];

  return trust * 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

// How far the true score may sit from the estimate, given the evidence so far.
export function halfWidth(totalWeight) {
  return Math.min(100, Math.max(30, round10(90 / Math.sqrt(0.6 + totalWeight))));
}

// -> { overall, low, high, sections: [{ id, name, score, low, high, events, weight }], events }
// `overall` is null until both sections have been measured.
export function estimateScore(diagnostic, mocks = [], now = new Date()) {
  const events = scoreEvents(diagnostic, mocks, now);

  const sections = SECTION_IDS.map((id) => {
    const mine = events.filter((e) => e.section === id);
    const weight = mine.reduce((sum, e) => sum + eventWeight(e, now), 0);
    const base = { id, name: SECTIONS[id].name, short: SECTIONS[id].short, cardSubject: SECTIONS[id].cardSubject, events: mine.length, weight };

    if (!(weight > 0)) return { ...base, score: null, low: null, high: null };

    const score = clampSection(mine.reduce((sum, e) => sum + e.score * eventWeight(e, now), 0) / weight);
    const half = halfWidth(weight);

    return { ...base, score, low: Math.max(SCALE.sectionMin, score - half), high: Math.min(SCALE.sectionMax, score + half) };
  });

  const measured = sections.every((s) => s.score !== null);
  const overall = measured ? sections.reduce((sum, s) => sum + s.score, 0) : null;
  // Section errors partly cancel, so the total's range is narrower than their sum.
  const half = measured ? round10(Math.hypot(...sections.map((s) => (s.high - s.low) / 2))) : null;

  return {
    overall,
    low: measured ? Math.max(SCALE.min, overall - half) : null,
    high: measured ? Math.min(SCALE.max, overall + half) : null,
    sections,
    events,
  };
}

// Points for the score-history chart: one total per day on which both
// sections were scored by the same event (a full test, a diagnostic or a
// logged official score).
export function scoreHistory(diagnostic, mocks = [], now = new Date()) {
  const byKey = new Map();

  for (const event of scoreEvents(diagnostic, mocks, now)) {
    if (event.kind === 'drill' || event.kind === 'module') continue;

    const key = `${event.source}|${event.at.toISOString()}`;
    const entry = byKey.get(key) || { at: event.at, kind: event.kind };

    entry[event.section] = event.score;
    byKey.set(key, entry);
  }

  return [...byKey.values()]
    .filter((e) => e.rw && e.math)
    .map((e) => ({ at: e.at, kind: e.kind, rw: e.rw, math: e.math, total: e.rw + e.math }))
    .sort((a, b) => a.at - b.at);
}
