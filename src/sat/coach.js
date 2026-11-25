// The SAT path's own guidance, worked out from data the app already has:
// today's missions, the next best step, the study plan to test day, and
// achievements. Pure functions, nothing extra is stored.

import { computeStreaks, dayKey } from '../analytics';
import { SECTIONS } from './blueprint';
import { kindOf, round10 } from './score';
import { nextSkill } from './skills';

const DAY_MS = 24 * 60 * 60 * 1000;
const same = (a, b) => String(a ?? '').trim().toLocaleLowerCase() === String(b ?? '').trim().toLocaleLowerCase();
const isSatSubject = (subject) => Object.values(SECTIONS).some((s) => same(s.cardSubject, subject));

export const dailyCardGoal = (daysLeft) => (daysLeft !== null && daysLeft <= 21 ? 15 : 10);

// Has the student got any score to work from (a diagnostic, a test or a logged score)?
export const hasBaseline = (estimate) => estimate.sections.some((s) => s.score !== null);

// ---- today's missions --------------------------------------------------------

// -> { missions: [{ id, title, detail, value, goal, done, action }], done, total }
// action: { type: 'diagnostic' | 'review' | 'drill' | 'module' | 'full' | 'add', label, skill?, section? }
export function buildMissions({ estimate, map, cards = [], reviews = [], mocks = [], daysLeft = null, now = new Date() }) {
  const today = dayKey(now);
  const missions = [];
  const reviewsToday = reviews.filter((r) => r.at && dayKey(r.at) === today).length;
  const goal = dailyCardGoal(daysLeft);
  const satCards = cards.filter((c) => isSatSubject(c.subject)).length;

  if (!hasBaseline(estimate)) {
    missions.push({
      id: 'diagnostic',
      title: 'Take the 25-minute diagnostic',
      detail: 'Twelve questions per section. It gives you a first score estimate and your skill map.',
      value: 0,
      goal: 1,
      done: false,
      action: { type: 'diagnostic', label: 'Start' },
    });
  }

  const weak = nextSkill(map);
  const drillsToday = mocks.filter((m) => kindOf(m.source) === 'drill' && dayKey(m.createdAt) === today).length;

  if (weak) {
    missions.push({
      id: 'drill',
      title: `Drill: ${weak.name}`,
      detail: weak.state === 'unseen' ? 'You have not tried this skill yet.' : `Your weakest skill right now (${weak.pct}% correct).`,
      value: Math.min(1, drillsToday),
      goal: 1,
      done: drillsToday >= 1,
      action: { type: 'drill', skill: weak.id, label: 'Drill' },
    });
  }

  missions.push({
    id: 'reviews',
    title: `Review ${goal} cards`,
    detail: satCards === 0 ? 'Add your missed questions as cards and they come back until they stick.' : 'Your past mistakes, brought back just before you would forget them.',
    value: Math.min(goal, reviewsToday),
    goal,
    done: reviewsToday >= goal,
    action: { type: 'review', label: 'Review' },
  });

  if (hasBaseline(estimate)) {
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const timed = mocks.some((m) => ['module', 'full', 'official'].includes(kindOf(m.source)) && new Date(m.createdAt).getTime() >= weekAgo);

    missions.push({
      id: 'timed',
      title: 'One timed module or test this week',
      detail: timed ? 'Done this week.' : 'Timing is a skill of its own. Practise it at least once a week.',
      value: timed ? 1 : 0,
      goal: 1,
      done: timed,
      action: { type: 'module', label: 'Start' },
    });
  }

  const done = missions.filter((m) => m.done).length;

  return { missions, done, total: missions.length, allDone: done === missions.length };
}

// ---- the study plan ------------------------------------------------------------

const PHASES = [
  { id: 'foundations', name: 'Foundations', share: 0.3, focus: ['Fix your weakest domain first, one skill at a time.', 'Learn the grammar rules and formulas as cards, and review them daily.', 'One timed module a week to keep a feel for the clock.'] },
  { id: 'skills', name: 'Skill building', share: 0.35, focus: ['Drill every skill below 80% until it turns green.', 'Add every miss to your cards on the same day.', 'One timed module per section each week.'] },
  { id: 'timed', name: 'Timed practice', share: 0.25, focus: ['A full adaptive test every week or two.', 'After each test, drill the three weakest skills it shows.', 'Start the official Bluebook practice tests and log each score here.'] },
  { id: 'final', name: 'Final stretch', share: 0.1, focus: ['One official Bluebook test, then review every miss.', 'Short drills only; no new topics.', 'Rest the day before. Sleep matters more than one more set.'] },
];

// -> { weeks, phases: [{ id, name, from, to, focus, current, milestone }], pointsPerWeek, noDate }
// Without a test date it plans twelve weeks from today.
export function buildStudyPlan({ estimate, target, daysLeft, now = new Date() }) {
  const noDate = daysLeft === null || daysLeft <= 0;
  const weeks = Math.max(1, Math.ceil((noDate ? 84 : daysLeft) / 7));
  const start = estimate.overall;
  const gap = start === null ? null : Math.max(0, target - start);
  let used = 0;

  const phases = PHASES.map((phase, i) => {
    const length = i === PHASES.length - 1 ? Math.max(1, weeks - used) : Math.max(1, Math.round(weeks * phase.share));
    const from = Math.min(weeks, used + 1);
    const to = Math.min(weeks, used + length);

    used = to;

    return {
      ...phase,
      from,
      to,
      current: from === 1,
      startsOn: new Date(now.getTime() + (from - 1) * 7 * DAY_MS),
      // Where the estimate should be by the end of this phase, on a straight line to the target.
      milestone: gap === null ? null : Math.min(target, round10(start + (gap * to) / weeks)),
    };
  }).filter((phase, i, all) => i === 0 || phase.to > all[i - 1].to);

  return { weeks, phases, pointsPerWeek: gap === null || gap === 0 ? null : Math.max(10, Math.ceil(gap / weeks / 10) * 10), noDate, gap };
}

// ---- the next best step ----------------------------------------------------------

// One recommendation for the top of the dashboard.
export function nextStep({ estimate, map, mocks = [], now = new Date() }) {
  if (!hasBaseline(estimate)) {
    return { title: 'Find out where you stand', detail: 'Take the 25-minute diagnostic, or enter a score you already have from Bluebook.', action: { type: 'diagnostic', label: 'Start the diagnostic' } };
  }

  const weak = nextSkill(map);
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const timedThisWeek = mocks.some((m) => ['module', 'full'].includes(kindOf(m.source)) && new Date(m.createdAt).getTime() >= weekAgo);

  if (weak && weak.state === 'weak') {
    return { title: `Work on ${weak.name}`, detail: `You are at ${weak.pct}% in this skill, and ${weak.domainName} is a large part of the ${SECTIONS[weak.section].short} section.`, action: { type: 'drill', skill: weak.id, label: 'Start a drill' } };
  }

  if (!timedThisWeek) {
    const section = [...estimate.sections].filter((s) => s.score !== null).sort((a, b) => a.score - b.score)[0];

    return { title: `Take a timed ${SECTIONS[section.id].short} module`, detail: 'You have not done timed practice this week. One module shows whether your accuracy holds under the clock.', action: { type: 'module', section: section.id, label: 'Start the module' } };
  }

  if (weak) {
    return { title: `Try ${weak.name}`, detail: weak.state === 'unseen' ? 'You have not practised this skill yet, so it is not on your map.' : `You are at ${weak.pct}% here. Push it past 80%.`, action: { type: 'drill', skill: weak.id, label: 'Start a drill' } };
  }

  return { title: 'Sit a full adaptive test', detail: 'Every skill on your map is strong. A full test is the best check before test day.', action: { type: 'full', label: 'Start a full test' } };
}

// ---- achievements ------------------------------------------------------------------

// extraDays: the other learning days (streakTimes()), so the streak matches Today.
export function buildAchievements({ estimate, map, cards = [], reviews = [], mocks = [], target, hasDiagnostic, now = new Date(), extraDays = [] }) {
  const streak = computeStreaks(reviews, now, extraDays);
  const overall = estimate.overall ?? 0;
  const kinds = mocks.map((m) => kindOf(m.source));
  const count = (kind) => kinds.filter((k) => k === kind).length;
  const strong = Object.values(map.skills).filter((s) => s.state === 'strong').length;
  const satCards = cards.filter((c) => isSatSubject(c.subject)).length;

  const counter = (id, title, detail, value, goal) => ({ id, title, detail, value: Math.min(goal, value), goal, unlocked: value >= goal });

  return [
    counter('baseline', 'Know your starting point', 'Finish the diagnostic or log a score.', hasDiagnostic || mocks.length > 0 ? 1 : 0, 1),
    counter('drill1', 'First drill', 'Finish a skill drill.', count('drill'), 1),
    counter('drill20', 'Twenty drills', 'Finish 20 skill drills.', count('drill'), 20),
    counter('module1', 'Against the clock', 'Finish a timed module.', count('module'), 1),
    counter('full1', 'Full rehearsal', 'Finish a full adaptive test.', count('full'), 1),
    counter('official1', 'Official check', 'Log a Bluebook practice test score.', count('official'), 1),
    counter('skill5', 'Five skills strong', 'Get 5 skills to 80% or better.', strong, 5),
    counter('skill15', 'Fifteen skills strong', 'Get 15 skills to 80% or better.', strong, 15),
    counter('cards25', 'Mistake journal', 'Save 25 SAT cards from your misses.', satCards, 25),
    counter('streak7', 'A full week', 'Keep a 7-day review streak.', streak.best, 7),
    counter('streak30', 'Unstoppable', 'Keep a 30-day review streak.', streak.best, 30),
    counter('s1300', '1300 club', 'Reach an estimated 1300.', overall, 1300),
    counter('s1400', '1400 club', 'Reach an estimated 1400.', overall, 1400),
    counter('s1500', '1500 club', 'Reach an estimated 1500.', overall, 1500),
    counter('target', 'On target', 'Reach your target score.', overall, target || 1400),
  ];
}
