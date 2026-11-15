// Site-wide safety limits for the paid AI features (not a route: the leading
// underscore keeps Vercel from exposing this file).
//
// Each account already has its own daily AI limit. That does not stop someone
// from making hundreds of accounts, so this adds one budget for the whole site:
// once AI_GLOBAL_DAILY_LIMIT uses have happened in 24 hours, AI answers "busy"
// until usage drops. It protects the AI bill during a viral spike or an attack.
//
// Settings (Vercel > Environment Variables):
//   AI_GLOBAL_DAILY_LIMIT      optional, default 3000 AI calls per 24 hours
//   SUPABASE_SERVICE_ROLE_KEY  needed to count everyone's usage (already used by reminders)

import { adminConfig } from './_push.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function countSince(cfg, table, since) {
  const res = await fetch(`${cfg.url}/rest/v1/${table}?select=id&created_at=gte.${encodeURIComponent(since)}`, {
    method: 'HEAD',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, Prefer: 'count=exact' },
  });

  if (!res.ok) return 0; // a missing table just means no usage of that kind

  return Number(String(res.headers.get('content-range') || '').split('/')[1]) || 0;
}

// Cached briefly per server instance so a burst does not hit the database each time.
let cache = { at: 0, used: 0 };

// -> true when the site may still spend on AI right now.
export async function globalAiBudgetOk(env, now = Date.now()) {
  const cfg = adminConfig(env);

  if (!cfg) return true; // not configured: per-user limits still apply

  const limit = Math.max(1, Number(env.AI_GLOBAL_DAILY_LIMIT) || 3000);

  if (now - cache.at > 30 * 1000) {
    const since = new Date(now - DAY_MS).toISOString();

    try {
      const [ai, coach] = await Promise.all([countSince(cfg, 'ai_usage', since), countSince(cfg, 'coach_usage', since)]);

      cache = { at: now, used: ai + coach };
    } catch {
      return true; // never block students because the counter is down
    }
  }

  return cache.used < limit;
}

export const BUDGET_MESSAGE = 'Mnemoq’s AI is very busy right now. Please try again in a few hours.';
