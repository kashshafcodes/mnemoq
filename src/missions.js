// Daily study missions and achievements for an exam path.
//
// Everything here is worked out from data the app already has (cards, review
// history, the diagnostic and the readiness estimate), so nothing extra is
// stored: a mission is done when today's reviews say it is done.

import { computeStreaks, dayKey } from './analytics';

const same = (a, b) => String(a ?? '').trim().toLocaleLowerCase() === String(b ?? '').trim().toLocaleLowerCase();

// Closer to the exam means a bigger daily goal.
export function dailyGoal(daysLeft) {
  if (daysLeft !== null && daysLeft <= 14) return 15;
  return 10;
}

export function buildMissions({ daysLeft, readiness, cards = [], reviews = [], hasDiagnostic, now = new Date() }) {
  const today = dayKey(now);
  const reviewsToday = reviews.filter((r) => r.at && dayKey(r.at) === today);
  const cardsToday = cards.filter((c) => c.createdAt && dayKey(c.createdAt) === today);
  const goal = dailyGoal(daysLeft);
  const missions = [];

  if (!hasDiagnostic) {
    missions.push({
      id: 'diagnostic',
      title: 'Take your AI diagnostic',
      detail: 'It finds your weak topics, and your missions get sharper once it is done.',
      value: 0,
      goal: 1,
      done: false,
      action: { type: 'diagnostic', label: 'Start' },
    });
  }

  missions.push({
    id: 'reviews',
    title: `Review ${goal} cards`,
    detail: 'A little every day beats a lot once a week.',
    value: Math.min(goal, reviewsToday.length),
    goal,
    done: reviewsToday.length >= goal,
    action: { type: 'review', label: 'Review' },
  });

  const weak = readiness?.weakest;

  if (weak) {
    const hasCards = cards.some((c) => same(c.subject, weak.cardSubject));

    if (hasCards) {
      const n = reviewsToday.filter((r) => same(r.subject, weak.cardSubject)).length;

      missions.push({
        id: 'weakest',
        title: `Strengthen ${weak.name}`,
        detail: `Your weakest section right now (${weak.score}). Do 5 reviews in it.`,
        value: Math.min(5, n),
        goal: 5,
        done: n >= 5,
        action: { type: 'subject', subject: weak.cardSubject, label: 'Review' },
      });
    } else {
      const n = cardsToday.filter((c) => same(c.subject, weak.cardSubject)).length;

      missions.push({
        id: 'weakest',
        title: `Save 3 ${weak.name} cards`,
        detail: `${weak.name} is your weakest section and you have no cards in it yet.`,
        value: Math.min(3, n),
        goal: 3,
        done: n >= 3,
        action: { type: 'add', label: 'Add cards' },
      });
    }
  }

  missions.push({
    id: 'add',
    title: 'Save 2 new cards',
    detail: 'Something you got wrong or want to remember.',
    value: Math.min(2, cardsToday.length),
    goal: 2,
    done: cardsToday.length >= 2,
    action: { type: 'add', label: 'Add cards' },
  });

  const done = missions.filter((m) => m.done).length;

  return { missions, done, total: missions.length, allDone: done === missions.length, goal };
}

// Days (out of the last 30) on which the student reached the base daily goal.
function goalDays(reviews, goal = 10) {
  const perDay = new Map();

  for (const r of reviews) {
    if (r.at) perDay.set(dayKey(r.at), (perDay.get(dayKey(r.at)) || 0) + 1);
  }

  return [...perDay.values()].filter((n) => n >= goal).length;
}

export function buildAchievements({ cards = [], reviews = [], readiness, target, hasDiagnostic, now = new Date() }) {
  const streak = computeStreaks(reviews, now);
  const total = reviews.length;
  const overall = readiness?.overall ?? null;
  const bestSection = Math.max(0, ...(readiness?.sections || []).map((s) => s.score ?? 0));
  const days = goalDays(reviews);

  const counter = (id, title, detail, value, goal) => ({
    id,
    title,
    detail,
    value: Math.min(goal, value),
    goal,
    unlocked: value >= goal,
  });

  return [
    counter('diagnostic', 'Know your starting point', 'Finish the AI diagnostic.', hasDiagnostic ? 1 : 0, 1),
    counter('rev10', 'Getting going', 'Review 10 cards.', total, 10),
    counter('rev100', 'Hundred reviews', 'Review 100 cards.', total, 100),
    counter('rev500', 'Five hundred reviews', 'Review 500 cards.', total, 500),
    counter('streak3', 'Three days in a row', 'Keep a 3-day streak.', streak.best, 3),
    counter('streak7', 'A full week', 'Keep a 7-day streak.', streak.best, 7),
    counter('streak30', 'Unstoppable', 'Keep a 30-day streak.', streak.best, 30),
    counter('goal7', 'Goal getter', 'Reach the daily goal on 7 different days.', days, 7),
    counter('cards25', 'Building a deck', 'Save 25 cards.', cards.length, 25),
    counter('cards100', 'Serious library', 'Save 100 cards.', cards.length, 100),
    counter('ready50', 'Halfway ready', 'Reach a readiness score of 50.', overall ?? 0, 50),
    counter('section', 'Section on target', 'Get any section to your target score.', bestSection, target || 75),
    counter('target', 'On target', 'Reach your target readiness.', overall ?? 0, target || 75),
  ];
}
