// POST /api/remind
//
// Run by a scheduler (see .github/workflows/reminders.yml) every 15 minutes.
// It sends each person their daily "cards are ready" reminder at the time they
// chose, in their own time zone, an optional evening nudge to keep a streak
// alive, and "cards are due now" alerts during the day (never in their quiet
// hours, at most 3 a day, at least 3 hours apart). Only the scheduler may call it: it must send
//   Authorization: Bearer <CRON_SECRET>
//
// Settings (Vercel > Environment Variables):
//   CRON_SECRET                long random string, also stored in GitHub secrets
//   SUPABASE_SERVICE_ROLE_KEY  Supabase > Project Settings > API (keep it secret)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT   see scripts/make-vapid-keys.mjs

import {
  adminConfig,
  alertDue,
  alertMessage,
  dailyDue,
  dailyMessage,
  dueCount,
  loadWebPush,
  localParts,
  rest,
  sendToDevices,
  streakDue,
  streakMessage,
  vapidReady,
} from './_push.js';

export const config = { maxDuration: 60 };

function send(res, status, body) {
  return res.status(status).json(body);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return diff === 0;
}

// Runs the whole job. Dependencies are passed in so it can be tested.
export async function runReminders({ env, now = new Date(), webpush, cfg }) {
  const settings = await rest(cfg, 'reminder_settings?select=*&enabled=eq.true&limit=5000');

  if (settings.length === 0) return { people: 0, daily: 0, streak: 0, alerts: 0, devices: 0, removed: 0 };

  const ids = settings.map((s) => s.user_id);
  const idList = `(${ids.join(',')})`;
  const devices = await rest(cfg, `push_subscriptions?select=*&user_id=in.${idList}&limit=20000`);
  const byUser = new Map();

  for (const d of devices) byUser.set(d.user_id, [...(byUser.get(d.user_id) || []), d]);

  // Recent reviews, to know who is keeping a streak.
  const since = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const recent = await rest(cfg, `reviews?select=user_id,created_at&user_id=in.${idList}&created_at=gte.${encodeURIComponent(since)}&limit=20000`);
  const reviewDates = new Map();
  const lastReview = new Map();

  for (const r of recent) {
    const person = settings.find((s) => s.user_id === r.user_id);

    if (!person) continue;

    const set = reviewDates.get(r.user_id) || new Set();

    set.add(localParts(new Date(r.created_at), person.timezone).date);

    const at = new Date(r.created_at);

    if (!lastReview.get(r.user_id) || at > lastReview.get(r.user_id)) lastReview.set(r.user_id, at);
    reviewDates.set(r.user_id, set);
  }

  const totals = { people: settings.length, daily: 0, streak: 0, alerts: 0, devices: 0, removed: 0 };
  const deadEndpoints = [];

  for (const person of settings) {
    const mine = byUser.get(person.user_id) || [];

    if (mine.length === 0) continue;

    const local = localParts(now, person.timezone);
    const patch = {};
    const messages = [];

    let dueNow = null;
    const countDue = async () => {
      if (dueNow === null) dueNow = await dueCount(cfg, person.user_id, now).catch(() => 0);

      return dueNow;
    };

    if (dailyDue(person, now)) {
      const message = dailyMessage(await countDue());

      patch.last_sent_on = local.date; // counts as today's reminder even when nothing is due

      if (message) {
        messages.push([message, 'daily']);
        patch.last_alert_at = now.toISOString();
      }
    }

    if (streakDue(person, reviewDates.get(person.user_id) || new Set(), now)) {
      messages.push([streakMessage(), 'streak']);
      patch.last_streak_on = local.date;
      patch.last_alert_at = now.toISOString();
    }

    // Cards that became due during the day, at most a few times and never at night.
    if (messages.length === 0 && person.due_alerts !== false) {
      const probe = { ...person };

      // Cheap checks first, so the card count is only fetched for likely people.
      if (alertDue({ ...probe, due_min: 1 }, 1, lastReview.get(person.user_id) || null, now)) {
        const count = await countDue();

        if (alertDue(person, count, lastReview.get(person.user_id) || null, now)) {
          messages.push([alertMessage(count), 'alerts']);

          const todays = person.alerts_on === local.date ? Number(person.alerts_today) || 0 : 0;

          patch.last_alert_at = now.toISOString();
          patch.alerts_on = local.date;
          patch.alerts_today = todays + 1;
        }
      }
    }

    for (const [message, kind] of messages) {
      const { sent, dead } = await sendToDevices(webpush, env, mine, message);

      totals.devices += sent;
      totals[kind] += sent > 0 ? 1 : 0;
      deadEndpoints.push(...dead);
    }

    if (Object.keys(patch).length > 0) {
      await rest(cfg, `reminder_settings?user_id=eq.${person.user_id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
    }
  }

  for (const endpoint of new Set(deadEndpoints)) {
    await rest(cfg, `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    totals.removed += 1;
  }

  return totals;
}

export default async function handler(req, res, env = process.env, deps = {}) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }

  const secret = env.CRON_SECRET || '';
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (secret.length < 16 || !timingSafeEqual(token, secret)) return send(res, 401, { error: 'Not allowed.' });

  const cfg = adminConfig(env);

  if (!cfg || !vapidReady(env)) return send(res, 503, { error: 'Reminders are not set up yet.' });

  try {
    const webpush = deps.webpush || (await loadWebPush());
    const result = await runReminders({ env, webpush, cfg, now: deps.now });

    return send(res, 200, { ok: true, ...result });
  } catch (error) {
    return send(res, 500, { error: 'The reminder job failed.', detail: String(error?.message || error).slice(0, 120) });
  }
}
