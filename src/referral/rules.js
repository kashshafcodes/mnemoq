// Referral Pro days: the rules, as pure functions (no network, no storage).
// Spec: company/growth/share-referral-perks.md §2 and §5. Owner decisions
// 2026-11-26: 7 + 7 days, 3 a month and 10 in total per referrer, paid after
// the friend's learning days on 2 separate Dhaka days within 14 days of
// sign-up; held referrals wait for the owner.
//
// api/referral.js gathers the facts with the service key and asks decide();
// the SQL function referral_settle (supabase/referrals.sql) writes the row and
// grants the days in one transaction, and re-checks the caps under a lock.

export const REWARD_DAYS = 7; // each side
export const NEEDED_DAYS = 2; // separate Dhaka learning days
export const WINDOW_DAYS = 14; // from the friend's sign-up day
export const MONTH_CAP = 3;
export const TOTAL_CAP = 10;
export const BURST_LIMIT = 3; // more than this many sign-ups from one code in 24 h are held
export const LATE_CLAIM_DAYS = 14; // a claim sent later than this after sign-up is an old account

const ZONE = 'Asia/Dhaka';
const DAY_MS = 24 * 60 * 60 * 1000;
const REFCODE = /^[0-9a-z]{6,8}$/;

export function dhakaDay(at) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

export const dhakaMonth = (at) => dhakaDay(at).slice(0, 7);

export function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export const validRefcode = (code) => REFCODE.test(String(code || ''));

// The refcode a visit arrived with, from the first-touch record in
// src/track.js trafficSource(). Share cards use utm_content=<refcode> with
// utm_source=friend; older links used utm_campaign=f-<refcode>.
// -> { refcode, clickedAt } | null
export function refFromSource(src) {
  if (!src || typeof src !== 'object') return null;

  const content = String(src.content || '').toLowerCase();
  const campaign = String(src.campaign || '').toLowerCase();
  let refcode = '';

  if (src.source === 'friend' && validRefcode(content)) refcode = content;
  else if (/^f-[0-9a-z]{6,8}$/.test(campaign)) refcode = campaign.slice(2);

  if (!refcode) return null;

  const clicked = Date.parse(src.landed_at);

  return { refcode, clickedAt: Number.isFinite(clicked) ? new Date(clicked).toISOString() : null };
}

// Gmail ignores dots and +tags, so a.b+x@gmail.com is ab@gmail.com.
export function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');

  if (at < 1) return value;

  let local = value.slice(0, at).split('+')[0];
  let domain = value.slice(at + 1);

  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');

  return `${local}@${domain}`;
}

// The friend's window: from the sign-up Dhaka day, 14 days (end exclusive).
export function learningWindow(signupAt) {
  const from = dhakaDay(signupAt);

  return { from, to: addDays(from, WINDOW_DAYS) };
}

// Distinct Dhaka days inside the window. Two different dates are always at
// least one calendar day apart, which is the "separate days" rule.
export function countLearningDays(days, signupAt) {
  const { from, to } = learningWindow(signupAt);
  const set = new Set();

  for (const row of days || []) {
    const day = typeof row === 'string' ? row : row?.day;

    if (typeof day === 'string' && day >= from && day < to) set.add(day.slice(0, 10));
  }

  return set.size;
}

// Rewards that use a referrer's slots: granted, and revoked ones too (a
// revoked reward was fraud and must not free a slot). Held and rejected don't.
export function capState(rewards, now = new Date()) {
  const month = dhakaMonth(now);
  const used = (rewards || []).filter((r) => r && (r.status === 'granted' || r.status === 'revoked'));
  const thisMonth = used.filter((r) => r.qualified_at && dhakaMonth(r.qualified_at) === month).length;

  return {
    total: used.length,
    month: thisMonth,
    totalFull: used.length >= TOTAL_CAP,
    monthFull: thisMonth >= MONTH_CAP,
  };
}

// facts:
//   existing    the friend's referral_rewards row, if any
//   friend      { id, email, created_at, email_confirmed_at }
//   claim       { refcode, clicked_at, created_at } from referral_claims, or null
//   referrer    { user_id, shared } from refcodes, or null
//   referrerEmail  the referrer's email, or null when unknown
//   days        the friend's learning_days rows (or day strings)
//   burst       claims for this refcode in the 24 h up to this claim (this one included)
//   rewards     the referrer's referral_rewards rows
// -> { status: 'none' | 'pending' | 'held' | 'granted' | 'rejected', reason?, days?, write? }
//    write is true when the result must be saved (a final status).
export function decide(facts, now = new Date()) {
  const { existing, friend, claim, referrer, referrerEmail, days, burst = 1, rewards } = facts || {};

  if (existing?.status) return { status: existing.status, reason: existing.reason || null, write: false };
  if (!friend?.id || !claim) return { status: 'none', write: false };

  const nowMs = new Date(now).getTime();
  const final = (status, reason = null) => ({ status, reason, write: true });

  // Not confirmed yet (when sign-in confirmation is on): wait, don't reject.
  if (!friend.email_confirmed_at && !friend.confirmed_at) return { status: 'pending', reason: 'unconfirmed', days: 0, write: false };

  const count = countLearningDays(days, friend.created_at);
  const { to } = learningWindow(friend.created_at);

  if (count < NEEDED_DAYS) {
    if (dhakaDay(nowMs) >= to) return final('rejected', 'expired');

    return { status: 'pending', reason: 'days', days: count, write: false };
  }

  if (!validRefcode(claim.refcode) || !referrer?.user_id) return final('rejected', 'unknown_code');
  if (referrer.user_id === friend.id) return final('rejected', 'self');
  if (referrerEmail && friend.email && normalizeEmail(referrerEmail) === normalizeEmail(friend.email)) return final('rejected', 'self_email');

  const created = Date.parse(friend.created_at);
  const clicked = Date.parse(claim.clicked_at);
  const claimed = Date.parse(claim.created_at);

  if (!Number.isFinite(created) || !Number.isFinite(clicked) || created <= clicked) return final('rejected', 'before_click');
  if (Number.isFinite(claimed) && claimed - created > LATE_CLAIM_DAYS * DAY_MS) return final('rejected', 'late_claim');

  const caps = capState(rewards, now);

  if (caps.totalFull) return final('rejected', 'cap_total');
  if (caps.monthFull) return final('rejected', 'cap_month');

  // Two accounts produce the same 6-character code: the owner decides who it is.
  if (referrer.shared) return final('held', 'shared_code');
  if (burst > BURST_LIMIT) return final('held', 'burst');

  return final('granted');
}
