// Today's loop: what the one big Play button does right now, what comes after
// a round, and what tomorrow holds. Pure functions (no React, no storage), so
// they are easy to test (tests/loop.test.js).

const DAY_MS = 24 * 60 * 60 * 1000;

// The Play button's state, in order of usefulness:
//   cards due      -> start a review ('due', or 'many' when a full round of `size` is waiting)
//   Daily not done -> open tonight's Daily
//   otherwise      -> the "Done for today" screen with tomorrow's preview
export function playState({ dueCount = 0, dailyPlayed = false, size = 10 } = {}) {
  const due = Math.max(0, Number(dueCount) || 0);

  if (due > 0) return { kind: due >= size ? 'many' : 'due', action: 'review', n: due };
  if (!dailyPlayed) return { kind: 'daily', action: 'daily', n: 0 };

  return { kind: 'done', action: 'done', n: 0 };
}

// What the end of a review round offers: another round, the Daily, or rest.
export function afterRound({ moreDue = 0, dailyPlayed = false } = {}) {
  if (moreDue > 0) return 'more';
  if (!dailyPlayed) return 'daily';

  return 'done';
}

const endOfDay = (date, plusDays = 0) => {
  const d = new Date(date);

  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + plusDays);

  return d;
};

// Cards that are not due yet but will be by the end of tomorrow.
export function dueTomorrow(cards, now = new Date()) {
  const limit = endOfDay(now, 1).getTime();
  const nowMs = now.getTime();

  return cards.filter((card) => {
    if (!card.nextReviewAt) return false;

    const at = new Date(card.nextReviewAt).getTime();

    return at > nowMs && at <= limit;
  }).length;
}

// A number that changes once a day, for rotating headings.
export function dayIndex(now = new Date()) {
  const start = new Date(2026, 0, 1);

  return Math.max(0, Math.floor((endOfDay(now).getTime() - start.getTime()) / DAY_MS));
}

// "5h 12m" for a countdown.
export function shortClock(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
