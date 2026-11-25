// Today's round (spec company/product/phase2-today-round.md): up to three
// steps in a fixed order, only the ones that apply today.
//
//   1. cards  the cards due now, one round of at most `size` (or, for someone
//             with no cards yet, "snap": save one mistake)
//   2. daily  tonight's Daily, if it is not played yet
//   3. drill  5 questions on the weakest section, only when a weakest section
//             is measured and a practice set exists for it
//
// Pure (no React, no storage): tests/round.test.js covers every case. The
// steps are fixed by the day's record (roundStore.js) once the round starts,
// so the ring never shrinks under the student's feet. "Done" is always read
// from real data (reviews, the Daily history, the drill finish), never from
// taps on the ring.

export const STEP_IDS = ['cards', 'snap', 'daily', 'drill'];

const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

// The steps a fresh round would have right now.
export function freshSteps({ dueCount = 0, hasCards = false, dailyPlayed = false, weakest = null, drillAvailable = false, size = 10 } = {}) {
  const due = count(dueCount);
  const steps = [];

  if (!hasCards) steps.push({ id: 'snap', target: 1 });
  else if (due > 0) steps.push({ id: 'cards', target: Math.min(due, size) });

  if (!dailyPlayed) steps.push({ id: 'daily', target: 5 });
  if (weakest && drillAvailable) steps.push({ id: 'drill', target: 5 });

  return steps;
}

// input:
//   dueCount, hasCards, dailyPlayed, weakest, drillAvailable, size
//   online        false: cards, snap and drill are disabled
//   dailyCached   the Daily can still be played offline
//   record        today's saved record { steps, cardsTarget, skipped } or null
//   progress      { cards: reviews today of the cards due at the start,
//                   cardsLeft: how many of those are still due (null = unknown),
//                   drillDone }
// output:
//   { steps: [{ id, target, n, done, skipped, enabled, reason, fill }],
//     current, doneCount, total, allDone, blocked, many }
export function roundPlan(input = {}) {
  const { dueCount = 0, hasCards = false, dailyPlayed = false, drillAvailable = false, online = true, dailyCached = true, size = 10, record = null, progress = {} } =
    input;
  const base = record?.steps?.length
    ? record.steps
        .filter((id) => STEP_IDS.includes(id))
        .map((id) => ({ id, target: id === 'cards' ? count(record.cardsTarget) || size : id === 'snap' ? 1 : 5 }))
    : freshSteps(input);
  const skippedIds = new Set(record?.skipped || []);
  const cardsDone = count(progress.cards);

  const steps = base.map(({ id, target }) => {
    let n = 0;
    let done = false;
    let enabled = online;
    let reason = online ? null : 'offline';

    if (id === 'cards') {
      n = Math.min(target, cardsDone);
      done = cardsDone >= target || progress.cardsLeft === 0;
    } else if (id === 'snap') {
      done = Boolean(hasCards);
      n = done ? 1 : 0;
    } else if (id === 'daily') {
      done = Boolean(dailyPlayed);
      n = done ? target : 0;
      enabled = online || Boolean(dailyCached);
      reason = enabled ? null : 'offline';
    } else if (id === 'drill') {
      done = Boolean(progress.drillDone);
      n = done ? target : 0;
      if (online && !drillAvailable) {
        enabled = false;
        reason = 'unavailable';
      }
    }

    const skipped = !done && skippedIds.has(id);
    const fill = done ? 1 : skipped ? 0 : target > 0 ? n / target : 0;

    return { id, target, n, done, skipped, enabled: enabled && !done, reason: done ? null : reason, fill };
  });

  const open = steps.filter((step) => !step.done && !step.skipped);
  const current = open.find((step) => step.enabled)?.id || null;
  const doneCount = steps.filter((step) => step.done).length;
  const allDone = open.length === 0;

  return {
    steps,
    current,
    doneCount,
    total: steps.length,
    allDone,
    // Something is left, but nothing can be played right now (offline).
    blocked: !allDone && current === null,
    // More cards are due than one round holds: "the rest will wait".
    many: count(dueCount) > size && steps.some((step) => step.id === 'cards' && !step.done),
  };
}

// The Play button's state, from the round (labels stay play.*).
export function playFromRound(plan, { dueCount = 0, size = 10, skill = '' } = {}) {
  const due = count(dueCount);

  switch (plan.current) {
    case 'cards':
      return { kind: due >= size ? 'many' : 'due', action: 'review', n: due };
    case 'daily':
      return { kind: 'daily', action: 'daily', n: 0 };
    case 'drill':
      return { kind: 'drill', action: 'drill', n: 5, skill };
    case 'snap':
      return { kind: 'snap', action: 'snap', n: 0 };
    default:
      return plan.blocked ? { kind: 'offline', action: 'none', n: 0 } : { kind: 'done', action: 'done', n: 0 };
  }
}

// The record saved the first time the round opens on a day.
export function newRecord(plan, { user = null, dueIds = [], date = '' } = {}) {
  const cards = plan.steps.find((step) => step.id === 'cards');

  return {
    v: 1,
    date,
    user,
    steps: plan.steps.map((step) => step.id),
    cardsTarget: cards ? cards.target : 0,
    cardIds: cards ? dueIds.map(String) : [],
    skipped: [],
    lit: plan.steps.filter((step) => step.done).map((step) => step.id),
    celebrated: false,
    drillDone: false,
    extra: 0,
  };
}

// Reviews today of the cards that were due when the round started, and how
// many of those cards are still due. `isToday(date)` decides "today".
export function cardsProgress(record, reviews = [], dueIds = [], isToday = () => true) {
  if (!record?.cardIds?.length) return { cards: 0, cardsLeft: null };

  const start = new Set(record.cardIds.map(String));
  const seen = new Set();

  for (const review of reviews) {
    const id = String(review.cardId);

    if (start.has(id) && isToday(review.at)) seen.add(id);
  }

  const stillDue = dueIds.filter((id) => start.has(String(id))).length;

  return { cards: seen.size, cardsLeft: stillDue };
}
