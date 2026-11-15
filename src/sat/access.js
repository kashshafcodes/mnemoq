// What a free account can do on the SAT path, and what needs Mnemoq Pro.
//
// Free is generous on purpose: the full diagnostic, the score estimate, the
// skill map, the score log, three drills a day, a timed module per section
// every week, and every explanation. Pro removes the limits and adds the whole
// question bank, full adaptive tests, the AI coach and the study plan.
//
// These checks decide what the screens offer. The Pro questions themselves
// and the Pro AI features are guarded on the server (api/sat-bank.js,
// api/coach.js), so skipping a check here unlocks nothing that matters.

import { dayKey } from '../analytics';

export const FREE = {
  drillsPerDay: 3,
  modulesPerWeek: 1, // per section
  // Explanations and review cards are never limited: they are how people learn.
  explanationsPerReport: Infinity,
  cardsPerReport: Infinity,
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const isDrill = (mock) => String(mock.source || '').startsWith('sat:drill');
const isModule = (mock, sectionId) => String(mock.source || '') === `sat:module:${sectionId}`;

export function drillsToday(mocks = [], now = new Date()) {
  const today = dayKey(now);

  return mocks.filter((m) => isDrill(m) && dayKey(m.createdAt) === today).length;
}

// Timed modules of one section in the last seven days.
export function modulesThisWeek(mocks = [], sectionId, now = new Date()) {
  const since = now.getTime() - WEEK_MS;

  return mocks.filter((m) => isModule(m, sectionId) && new Date(m.createdAt).getTime() >= since).length;
}

// -> { allowed, reason } for each thing a person can start.
// `feature` names the benefit shown on the upgrade prompt.
export function accessFor(plan, mocks = [], now = new Date()) {
  const pro = Boolean(plan?.pro);
  const open = { allowed: true, reason: '' };
  const usedDrills = drillsToday(mocks, now);

  return {
    pro,
    diagnostic: open,
    scoreLog: open,
    drill:
      pro || usedDrills < FREE.drillsPerDay
        ? { ...open, left: pro ? null : FREE.drillsPerDay - usedDrills }
        : { allowed: false, feature: 'drills', reason: `You have done today's ${FREE.drillsPerDay} free drills. They come back tomorrow, or go Pro for unlimited drills.` },
    module: (sectionId) =>
      pro || modulesThisWeek(mocks, sectionId, now) < FREE.modulesPerWeek
        ? open
        : { allowed: false, feature: 'modules', reason: 'You have taken this week\'s free timed module for this section. It comes back in a few days, or go Pro for unlimited modules from the full question bank.' },
    fullTest: pro ? open : { allowed: false, feature: 'full', reason: 'Full adaptive practice tests are part of Mnemoq Pro.' },
    coach: pro ? open : { allowed: false, feature: 'coach', reason: 'The AI coach is part of Mnemoq Pro.' },
    plan: pro ? open : { allowed: false, feature: 'plan', reason: 'Your week-by-week study plan is part of Mnemoq Pro.' },
    explanations: pro ? Infinity : FREE.explanationsPerReport,
    cardsPerReport: pro ? Infinity : FREE.cardsPerReport,
  };
}
