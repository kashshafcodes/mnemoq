// The weekly recap's numbers (pure). Spec phase2-share-card §2 (recap rules):
// the last 7 Dhaka days ending today; shown only after 3 learning days in that
// window; "kept" is the Memory map's definition; under 5 reviews, the card says
// "Cards reviewed: N" instead of a rate.

import { dhakaKey, streakFromTimes } from '../glow/streak';
import { keptCards } from '../progress/mapData';

export const RECAP_DAYS = 7;
export const RECAP_MIN_LIT = 3;
export const RECAP_MIN_REVIEWS = 5;

const DAY = 86400000;

export function recapWindow(now = new Date()) {
  const keys = [];

  for (let i = RECAP_DAYS - 1; i >= 0; i -= 1) keys.push(dhakaKey(new Date(now.getTime() - i * DAY)));

  return keys;
}

// reviews: [{ at, recalled }], extraDays: learning times (Daily, drills, snaps),
// glowByDay: { 'YYYY-MM-DD': Glow }.
export function weeklyRecap({ reviews = [], extraDays = [], cards = [], glowByDay = {}, now = new Date() } = {}) {
  const days = recapWindow(now);
  const inWindow = new Set(days);
  const streak = streakFromTimes([...reviews.map((r) => r.at), ...extraDays.filter(Boolean)], now);
  const states = Object.fromEntries(streak.days.map((d) => [d.day, d.state]));
  const dots = days.map((day) => (states[day] === 'lit' ? 'lit' : states[day] === 'rest' ? 'rest' : 'empty'));
  const daysLit = dots.filter((d) => d === 'lit').length;

  const perDay = {};
  let reviewed = 0;
  let recalled = 0;

  for (const r of reviews) {
    const key = r.at ? dhakaKey(r.at) : null;

    if (!key || !inWindow.has(key)) continue;
    reviewed += 1;
    if (r.recalled) recalled += 1;
    perDay[key] = (perDay[key] || 0) + 1;
  }

  const best = Object.entries(perDay).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0];

  return {
    days,
    from: days[0],
    to: days[days.length - 1],
    dots,
    daysLit,
    locked: daysLit < RECAP_MIN_LIT,
    reviewed,
    recalled,
    showRate: reviewed >= RECAP_MIN_REVIEWS,
    kept: keptCards(cards).n,
    glow: days.reduce((sum, day) => sum + (Number(glowByDay[day]) || 0), 0),
    bestDay: best ? best[0] : null,
  };
}
