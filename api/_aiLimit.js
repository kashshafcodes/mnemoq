// One daily AI allowance per person, across every AI feature (card
// suggestions, AI-made sets, the AI coach). Not a route: the leading
// underscore keeps Vercel from exposing it.
//
//   free accounts  AI_FREE_DAILY_LIMIT  (default 5 a day)
//   Pro accounts   AI_PRO_DAILY_LIMIT   (default 50 a day)
//   AI_UNLIMITED_EMAILS                 no limit (the owner and testers)
//
// Uses are the rows in ai_usage and coach_usage from the last 24 hours,
// counted with the person's own token (row level security: only their rows).

import { hasPro } from './_plan.js';

export const FREE_DAILY = 5;
export const PRO_DAILY = 50;

async function countSince(cfg, token, table, since) {
  const res = await fetch(`${cfg.url}/rest/v1/${table}?select=id&created_at=gte.${encodeURIComponent(since)}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${token}`, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' },
  });

  if (!res.ok) return null;

  const total = Number(String(res.headers.get('content-range') || '').split('/')[1]);

  return Number.isFinite(total) ? total : null;
}

// -> { pro, limit, used } ; used is null when the counter cannot be read
// (callers then refuse: without a counter there is no safe limit).
export async function aiAllowance(env, cfg, token, user, { unlimited = false } = {}) {
  const pro = await hasPro(env, cfg, token, user);

  if (unlimited) return { pro, limit: Infinity, used: 0 };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [ai, coach] = await Promise.all([
    countSince(cfg, token, 'ai_usage', since).catch(() => null),
    countSince(cfg, token, 'coach_usage', since).catch(() => null),
  ]);
  const limit = pro ? Math.max(1, Number(env.AI_PRO_DAILY_LIMIT) || PRO_DAILY) : Math.max(1, Number(env.AI_FREE_DAILY_LIMIT) || FREE_DAILY);

  // A missing coach_usage table just means no coach use yet.
  return { pro, limit, used: ai === null ? null : ai + (coach || 0) };
}

export function limitMessage({ pro, limit }) {
  return pro
    ? `You have used your ${limit} AI uses for today. They come back within 24 hours.`
    : `You have used your ${limit} free AI uses for today. Mnemoq Pro gives you ${PRO_DAILY} a day.`;
}

// Has this person already had their one free AI coach analysis?
export async function usedFreeAnalysis(cfg, token) {
  const res = await fetch(`${cfg.url}/rest/v1/diagnostics?select=id&analysis=not.is.null&limit=1`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return false;

  const rows = await res.json().catch(() => []);

  return Array.isArray(rows) && rows.length > 0;
}

async function oldestSince(cfg, token, table, since) {
  const res = await fetch(
    `${cfg.url}/rest/v1/${table}?select=created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=1`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return null;

  const rows = await res.json().catch(() => []);
  const at = Array.isArray(rows) ? Date.parse(rows[0]?.created_at) : NaN;

  return Number.isFinite(at) ? at : null;
}

// When the next AI use comes back: the oldest use inside the 24-hour window,
// plus 24 hours. ISO string, or null when it cannot be read. Only asked for
// when someone has run out, so normal calls cost no extra query.
export async function aiResetsAt(cfg, token, now = Date.now()) {
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [ai, coach] = await Promise.all([
    oldestSince(cfg, token, 'ai_usage', since).catch(() => null),
    oldestSince(cfg, token, 'coach_usage', since).catch(() => null),
  ]);
  const times = [ai, coach].filter((at) => at !== null);

  return times.length > 0 ? new Date(Math.min(...times) + 24 * 60 * 60 * 1000).toISOString() : null;
}
