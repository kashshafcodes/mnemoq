// Friend-opened Glow and the Light-passer charm: the rules, pure.
// Spec: company/growth/share-referral-perks.md §1 (rows 2 and 3).
//
// +5 Glow when a new visitor opens your link (utm_source=friend,
// utm_content=<your refcode>, their first touch) and answers a question.
// At most 2 a Dhaka day and 10 a Dhaka week (Monday to Sunday). Visitor ids
// that ever appeared on your own account are ignored. Each visitor counts
// once, ever, on the Dhaka day of their first answer.
//
// The server (api/referral.js, action 'friends') recomputes this from
// site_events every time, so the result is the same however often it runs,
// and writes it into your learning_days row as sources.glow.friend (one more
// "device" in the existing Glow sync).
//
// The charm: 3 different friends have opened your links (lifetime).

import { addDays, dhakaDay } from './rules.js';

export const FRIEND_GLOW = 5;
export const FRIEND_DAY_CAP = 2;
export const FRIEND_WEEK_CAP = 10;
export const CHARM_FRIENDS = 3;
export const CHARM_ID = 'charm.lightpasser';
export const FRIEND_DEVICE = 'friend'; // the key in sources.glow
// Events that mean "answered a question" on /sample, /daily or an exam page.
export const PLAYED_EVENTS = ['sample_answer', 'daily_finish', 'guest_diag_done'];

// The Monday of the Dhaka week holding `day` ('YYYY-MM-DD').
export function weekOf(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 Sunday

  return addDays(day, -((weekday + 6) % 7));
}

// rows: site_events { visitor_id, at } for your code's played events (any order)
// own:  visitor ids seen on your own account (Set or array)
// since: only days on or after this are returned in `days` (the rest are
//        older history the server no longer rewrites)
// -> { friends, days: { 'YYYY-MM-DD': glow } }
export function friendGlow({ rows = [], own = [], since = null } = {}) {
  const mine = own instanceof Set ? own : new Set(own);
  const first = new Map();

  for (const row of rows || []) {
    const id = row?.visitor_id;
    const at = Date.parse(row?.at);

    if (!id || mine.has(id) || !Number.isFinite(at)) continue;
    if (!first.has(id) || at < first.get(id)) first.set(id, at);
  }

  const perDay = {};
  const perWeek = {};

  for (const at of [...first.values()].sort((a, b) => a - b)) {
    const day = dhakaDay(at);
    const week = weekOf(day);

    if ((perDay[day] || 0) >= FRIEND_DAY_CAP || (perWeek[week] || 0) >= FRIEND_WEEK_CAP) continue;

    perDay[day] = (perDay[day] || 0) + 1;
    perWeek[week] = (perWeek[week] || 0) + 1;
  }

  const days = {};

  for (const [day, n] of Object.entries(perDay)) if (!since || day >= since) days[day] = n * FRIEND_GLOW;

  return { friends: first.size, days };
}

// The day's friend Glow, inside the 100 a day cap: never more than what the
// other devices left room for, and never less than what was already written.
export function cappedFriendGlow(want, sourcesGlow = {}, cap = 100) {
  const others = Object.entries(sourcesGlow || {}).reduce((sum, [id, n]) => (id === FRIEND_DEVICE ? sum : sum + (Number(n) || 0)), 0);
  const had = Number(sourcesGlow?.[FRIEND_DEVICE]) || 0;

  return Math.max(had, Math.min(want, Math.max(0, cap - others)));
}
