// What a free account can do on the SAT path, and what needs Mnemoq Pro.
//
// Free is a real taste, not a demo: the full diagnostic, the score estimate,
// the skill map, the score log, one drill a day, one timed module per section
// and the first explanations in every report. Pro removes the limits and adds
// the full adaptive tests, every explanation, the AI coach and the study plan.
//
// These checks decide what the screens offer. The Pro questions themselves
// and the Pro AI features are guarded on the server (api/sat-bank.js,
// api/coach.js), so skipping a check here unlocks nothing that matters.

import { dayKey } from '../analytics';

export const FREE = {
  drillsPerDay: 1,
  modulesPerSection: 1,
  explanationsPerReport: 3,
  cardsPerReport: 3,
};

const isDrill = (mock) => String(mock.source || '').startsWith('sat:drill');
const isModule = (mock, sectionId) => String(mock.source || '') === `sat:module:${sectionId}`;

export function drillsToday(mocks = [], now = new Date()) {
  const today = dayKey(now);

  return mocks.filter((m) => isDrill(m) && dayKey(m.createdAt) === today).length;
}

export function modulesTaken(mocks = [], sectionId) {
  return mocks.filter((m) => isModule(m, sectionId)).length;
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
        : { allowed: false, feature: 'drills', reason: 'You have used today\'s free drill. It comes back tomorrow, or go Pro for unlimited drills.' },
    module: (sectionId) =>
      pro || modulesTaken(mocks, sectionId) < FREE.modulesPerSection
        ? open
        : { allowed: false, feature: 'modules', reason: 'You have taken your free timed module for this section. Pro unlocks unlimited modules from the full question bank.' },
    fullTest: pro ? open : { allowed: false, feature: 'full', reason: 'Full adaptive practice tests are part of Mnemoq Pro.' },
    coach: pro ? open : { allowed: false, feature: 'coach', reason: 'The AI coach is part of Mnemoq Pro.' },
    plan: pro ? open : { allowed: false, feature: 'plan', reason: 'Your week-by-week study plan is part of Mnemoq Pro.' },
    explanations: pro ? Infinity : FREE.explanationsPerReport,
    cardsPerReport: pro ? Infinity : FREE.cardsPerReport,
  };
}
