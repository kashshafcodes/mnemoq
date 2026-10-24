// Everything the dashboard shows is worked out here, from two things:
//   cards   - the person's cards (as App.jsx holds them)
//   reviews - the review history: one entry per rating, oldest to newest
//             { id, cardId, subject, category, rating, recalled, intervalDays, at }
// Pure functions (no React, no network), so they are easy to test.

import { getSubjectNames, sameName } from './subjects';

const DAY = 24 * 60 * 60 * 1000;

// "Strong" = the gap before the next review has grown to at least this many days.
export const STRONG_INTERVAL_DAYS = 4;

export const STAGES = [
  { id: 'new', label: 'New', hint: 'Not reviewed yet' },
  { id: 'learning', label: 'Learning', hint: 'Short gaps, still settling' },
  { id: 'strong', label: 'Getting strong', hint: 'Gaps of 4+ days' },
  { id: 'mastered', label: 'Mastered', hint: 'Recalled again and again' },
];

export function dayKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${d.getFullYear()}-${month}-${day}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function cardStage(card) {
  if (card.mastered) return 'mastered';
  if (!card.reviewCount) return 'new';
  if ((card.reviewIntervalDays || 0) >= STRONG_INTERVAL_DAYS) return 'strong';
  return 'learning';
}

// "10 min", "3 hours", "1 day", "2 weeks": a readable length of time.
export function formatGap(ms) {
  const minutes = ms / 60000;

  if (minutes < 90) return `${Math.max(1, Math.round(minutes))} min`;

  const hours = ms / (60 * 60 * 1000);
  if (hours < 20) return `${Math.round(hours)} hr`;

  const days = ms / DAY;
  if (days < 14) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} wk`;

  return `${Math.round(days / 30)} mo`;
}

export function formatDays(days) {
  const n = Math.round(days);

  if (n < 14) return `${n} day${n === 1 ? '' : 's'}`;
  if (n < 60) return `${Math.round(n / 7)} weeks`;

  return `${Math.round(n / 30)} months`;
}

// Whole days with at least one review -> { current, best }.
// The current streak stays alive until the end of the day after the last review.
export function computeStreaks(reviews, now = new Date()) {
  const days = new Set(reviews.map((entry) => dayKey(entry.at)));

  if (days.size === 0) return { current: 0, best: 0, reviewedToday: false };

  const reviewedToday = days.has(dayKey(now));
  let cursor = reviewedToday ? startOfDay(now) : addDays(now, -1);
  let current = 0;

  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous = null;

  for (const key of sorted) {
    const date = new Date(`${key}T00:00:00`);

    if (previous && Math.round((date - previous) / DAY) === 1) run += 1;
    else run = 1;

    best = Math.max(best, run);
    previous = date;
  }

  return { current, best, reviewedToday };
}

// One entry per day for the last `count` days (oldest first).
export function lastDays(reviews, count = 14, now = new Date()) {
  const byDay = new Map();

  for (const entry of reviews) {
    const key = dayKey(entry.at);
    const bucket = byDay.get(key) || { total: 0, recalled: 0 };

    bucket.total += 1;
    if (entry.recalled) bucket.recalled += 1;
    byDay.set(key, bucket);
  }

  const out = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const date = addDays(now, -i);
    const bucket = byDay.get(dayKey(date)) || { total: 0, recalled: 0 };

    out.push({
      key: dayKey(date),
      date,
      total: bucket.total,
      recalled: bucket.recalled,
      missed: bucket.total - bucket.recalled,
      isToday: i === 0,
    });
  }

  return out;
}

// Recall rate per 7-day block, newest last. Blocks with no reviews have rate null.
export function weeklyRecall(reviews, weeks = 8, now = new Date()) {
  const out = [];
  const end = addDays(now, 1); // exclusive end: tomorrow 00:00

  for (let w = weeks - 1; w >= 0; w -= 1) {
    const to = addDays(end, -7 * w);
    const from = addDays(to, -7);
    const inside = reviews.filter((entry) => entry.at >= from && entry.at < to);
    const recalled = inside.filter((entry) => entry.recalled).length;

    out.push({
      from,
      to: addDays(to, -1),
      total: inside.length,
      recalled,
      rate: inside.length > 0 ? recalled / inside.length : null,
    });
  }

  return out;
}

// Recall rate for each of the last `count` days (oldest first). Days with no
// reviews have rate null.
export function dailyRecall(reviews, count = 30, now = new Date()) {
  return lastDays(reviews, count, now).map((day) => ({
    from: day.date,
    to: day.date,
    total: day.total,
    recalled: day.recalled,
    rate: day.total > 0 ? day.recalled / day.total : null,
  }));
}

// How many cards come due on each of the next `count` days. Overdue cards and
// brand-new cards count as today.
export function forecast(cards, count = 7, now = new Date()) {
  const today = startOfDay(now);
  const out = [];

  for (let i = 0; i < count; i += 1) {
    out.push({ key: dayKey(addDays(today, i)), date: addDays(today, i), count: 0, isToday: i === 0 });
  }

  for (const card of cards) {
    if (!card.nextReviewAt) {
      out[0].count += 1;
      continue;
    }

    const due = new Date(card.nextReviewAt);
    const offset = Math.floor((startOfDay(due) - today) / DAY);

    if (offset <= 0) out[0].count += 1;
    else if (offset < count) out[offset].count += 1;
  }

  return out;
}

// The story of each card across its history: the run of correct recalls it is
// on, and how long the real gaps between those reviews were.
export function cardJourneys(cards, reviews) {
  const byCard = new Map();

  for (const entry of reviews) {
    if (!byCard.has(entry.cardId)) byCard.set(entry.cardId, []);
    byCard.get(entry.cardId).push(entry);
  }

  const journeys = [];

  for (const card of cards) {
    const entries = (byCard.get(card.id) || []).sort((a, b) => a.at - b.at);

    if (entries.length === 0) continue;

    // Walk back from the newest review while the answers were right.
    let start = entries.length;

    while (start > 0 && entries[start - 1].recalled) start -= 1;

    const run = entries.slice(start);
    const gaps = [];

    // The gap before each recall in the run: time since the review before it.
    for (let i = start; i < entries.length; i += 1) {
      if (i === 0) continue; // first ever review has nothing before it
      gaps.push(entries[i].at - entries[i - 1].at);
    }

    const missedBefore = entries.slice(0, start).filter((entry) => !entry.recalled).length;
    const firstMissed = !entries[0].recalled;
    const totalMissed = entries.filter((entry) => !entry.recalled).length;

    journeys.push({
      card,
      entries,
      streak: run.length,
      gaps,
      longestGap: gaps.length > 0 ? Math.max(...gaps) : 0,
      missedBefore,
      totalMissed,
      turnaround: firstMissed && run.length > 0,
    });
  }

  return journeys;
}

// The most impressive journey: longest correct run, then the longest gap held.
export function bestJourney(journeys) {
  const real = journeys.filter((journey) => journey.streak >= 2 && journey.gaps.length >= 1);

  if (real.length === 0) return null;

  return [...real].sort(
    (a, b) => b.streak - a.streak || b.longestGap - a.longestGap
  )[0];
}

// The card that took the most tries and is now a win.
export function toughestWin(journeys) {
  const wins = journeys.filter(
    (journey) => journey.totalMissed >= 2 && journey.streak >= 1 && journey.card.mastered
  );

  if (wins.length === 0) return null;

  return [...wins].sort((a, b) => b.totalMissed - a.totalMissed)[0];
}

export function bySubject(cards, reviews, now = new Date()) {
  const names = getSubjectNames(cards).filter((name) =>
    cards.some((card) => sameName(card.subject, name))
  );

  return names.map((name) => {
    const mine = cards.filter((card) => sameName(card.subject, name));
    const log = reviews.filter((entry) => sameName(entry.subject, name));
    const recalled = log.filter((entry) => entry.recalled).length;

    return {
      name,
      total: mine.length,
      mastered: mine.filter((card) => card.mastered).length,
      due: mine.filter((card) => !card.nextReviewAt || new Date(card.nextReviewAt) <= now).length,
      reviews: log.length,
      recalled,
      rate: log.length >= 3 ? recalled / log.length : null,
    };
  });
}

function badge(id, label, desc, value, goal) {
  return {
    id,
    label,
    desc,
    value: Math.min(value, goal),
    goal,
    earned: value >= goal,
  };
}

export function computeBadges(stats) {
  return [
    badge('first-card', 'First card', 'Add your first card', stats.totalCards, 1),
    badge('ten-cards', 'Collector', 'Save 10 cards', stats.totalCards, 10),
    badge('first-review', 'First recall', 'Review a card', stats.reviewsTotal, 1),
    badge('reviews-50', 'Getting serious', 'Complete 50 reviews', stats.reviewsTotal, 50),
    badge('first-mastered', 'Locked in', 'Master your first card', stats.mastered, 1),
    badge('five-mastered', 'High five', 'Master 5 cards', stats.mastered, 5),
    badge('streak-3', 'Three in a row', 'Review 3 days in a row', stats.streak.best, 3),
    badge('streak-7', 'A full week', 'Review 7 days in a row', stats.streak.best, 7),
    badge('long-memory', 'Long memory', 'Hold a card for 14+ days between reviews', stats.longestIntervalDays, 14),
    badge('comeback', 'Comeback', 'Turn a missed card into a correct one', stats.turnarounds, 1),
  ];
}

// All the numbers for the dashboard.
export function computeAnalytics(cards, reviews, now = new Date()) {
  const sortedReviews = [...reviews].sort((a, b) => a.at - b.at);
  const stageCounts = { new: 0, learning: 0, strong: 0, mastered: 0 };

  for (const card of cards) stageCounts[cardStage(card)] += 1;

  const mastered = stageCounts.mastered;
  const reviewedCards = cards.filter((card) => (card.reviewCount || 0) > 0);

  // reviewCount lives on the card, so it also covers reviews done before the
  // history log existed.
  const reviewsFromCards = cards.reduce((sum, card) => sum + (card.reviewCount || 0), 0);
  const reviewsTotal = Math.max(reviewsFromCards, sortedReviews.length);

  const recalledCount = sortedReviews.filter((entry) => entry.recalled).length;
  const streak = computeStreaks(sortedReviews, now);
  const journeys = cardJourneys(cards, sortedReviews);
  const intervals = reviewedCards.map((card) => card.reviewIntervalDays || 0).filter((n) => n > 0);
  const longestIntervalDays = intervals.length > 0 ? Math.max(...intervals) : 0;

  const perDay = new Map();

  for (const entry of sortedReviews) {
    const key = dayKey(entry.at);
    perDay.set(key, (perDay.get(key) || 0) + 1);
  }

  let bestDay = null;

  for (const [key, count] of perDay) {
    if (!bestDay || count > bestDay.count) bestDay = { key, count };
  }

  const firstCardAt = cards.reduce((first, card) => {
    const created = card.createdAt ? new Date(card.createdAt) : null;
    return created && (!first || created < first) ? created : first;
  }, null);

  const stats = {
    totalCards: cards.length,
    mastered,
    masteredPct: cards.length > 0 ? mastered / cards.length : 0,
    stageCounts,
    reviewsTotal,
    historyCount: sortedReviews.length,
    hasHistory: sortedReviews.length > 0,
    recalledCount,
    recallRate: sortedReviews.length >= 3 ? recalledCount / sortedReviews.length : null,
    streak,
    longestIntervalDays,
    avgIntervalDays:
      intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0,
    turnarounds: journeys.filter((journey) => journey.turnaround).length,
    bestDay,
    daysLearning: firstCardAt ? Math.max(1, Math.round((now - firstCardAt) / DAY) + 1) : 0,
    dueNow: cards.filter((card) => !card.nextReviewAt || new Date(card.nextReviewAt) <= now).length,
  };

  const longestMemoryCards = [...reviewedCards]
    .filter((card) => (card.reviewIntervalDays || 0) > 0)
    .sort((a, b) => (b.reviewIntervalDays || 0) - (a.reviewIntervalDays || 0))
    .slice(0, 3);

  return {
    stats,
    stages: STAGES.map((stage) => ({ ...stage, count: stageCounts[stage.id] })),
    days: lastDays(sortedReviews, 14, now),
    weeks: weeklyRecall(sortedReviews, 8, now),
    daily: dailyRecall(sortedReviews, 30, now),
    upcoming: forecast(cards, 7, now),
    subjects: bySubject(cards, sortedReviews, now),
    journeys,
    best: bestJourney(journeys),
    toughest: toughestWin(journeys),
    longestMemoryCards,
    badges: computeBadges(stats),
  };
}

// One short, honest, encouraging line for the top of the dashboard.
export function headline(stats) {
  if (stats.totalCards === 0) {
    return { title: 'Your dashboard starts here.', body: 'Add a few cards and your progress will show up in this space.' };
  }

  if (stats.streak.current >= 3) {
    return {
      title: `${stats.streak.current}-day streak. Keep it going.`,
      body: stats.streak.reviewedToday
        ? 'You have already reviewed today. Nice.'
        : 'Review one card today to keep it alive.',
    };
  }

  if (stats.mastered > 0) {
    return {
      title: `${stats.mastered} ${stats.mastered === 1 ? 'mistake is' : 'mistakes are'} now things you know.`,
      body: 'Each one started as a miss. Now you can recall it, with longer and longer gaps.',
    };
  }

  if (stats.reviewsTotal > 0) {
    return {
      title: 'Your memory is building.',
      body: `${stats.reviewsTotal} review${stats.reviewsTotal === 1 ? '' : 's'} done. Every recall makes the next gap longer.`,
    };
  }

  return {
    title: 'Good start. Now bring them back.',
    body: 'Your first review is what starts the spacing. A short session is enough.',
  };
}
