// POST /api/remind
//
// Run by a scheduler (see .github/workflows/reminders.yml) every 15 minutes.
// It sends each person their daily "cards are ready" reminder at the time they
// chose, in their own time zone, an optional evening nudge to keep a streak
// alive (only when cards are due), and "cards are due now" alerts during the
// day (at most 3 a day, at least 3 hours apart). Nothing is ever sent in
// their quiet hours. Only the scheduler may call it: it must send
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
  streakWindow,
  validTimeZone,
  vapidReady,
} from './_push.js';

export const config = { maxDuration: 60 };

function send(res, status, body) {
  return res.status(status).json(body);
}

function chunks(list, size) {
  const out = [];

  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));

  return out;
}

async function runPool(items, size, work) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];

      next += 1;
      await work(item);
    }
  };

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return diff === 0;
}

// Runs the whole job. Dependencies are passed in so it can be tested.
export async function runReminders({ env, now = new Date(), webpush, cfg }) {
  // Everyone with reminders on, a page at a time (no upper limit on people).
  const settings = [];

  for (let offset = 0; ; offset += 1000) {
    const page = await rest(cfg, `reminder_settings?select=*&enabled=eq.true&order=user_id&limit=1000&offset=${offset}`);

    settings.push(...page);
    if (page.length < 1000) break;
  }

  if (settings.length === 0) return { people: 0, daily: 0, streak: 0, alerts: 0, devices: 0, removed: 0 };

  const ids = settings.map((s) => s.user_id);
  const settingsById = new Map(settings.map((s) => [s.user_id, s]));
  const byUser = new Map();
  const reviewDates = new Map();
  const lastReview = new Map();
  // Recent reviews, to know who is keeping a streak.
  const since = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Ask about people in batches: thousands of ids in one address is too long.
  for (const batch of chunks(ids, 150)) {
    const idList = `(${batch.join(',')})`;
    const [devices, recent] = await Promise.all([
      rest(cfg, `push_subscriptions?select=*&user_id=in.${idList}&limit=5000`),
      rest(cfg, `reviews?select=user_id,created_at&user_id=in.${idList}&created_at=gte.${encodeURIComponent(since)}&limit=20000`),
    ]);

    for (const d of devices) byUser.set(d.user_id, [...(byUser.get(d.user_id) || []), d]);

    for (const r of recent) {
      const person = settingsById.get(r.user_id);

      if (!person) continue;

      const set = reviewDates.get(r.user_id) || new Set();
      const at = new Date(r.created_at);

      set.add(localParts(at, person.timezone).date);
      if (!lastReview.get(r.user_id) || at > lastReview.get(r.user_id)) lastReview.set(r.user_id, at);
      reviewDates.set(r.user_id, set);
    }
  }

  const totals = { people: settings.length, daily: 0, streak: 0, alerts: 0, devices: 0, removed: 0 };
  const deadEndpoints = [];

  async function handlePerson(person) {
    const mine = byUser.get(person.user_id) || [];

    if (mine.length === 0 || !validTimeZone(person.timezone)) return;

    const local = localParts(now, person.timezone);
    const patch = {};
    const messages = [];

    let dueNow = null;
    const countDue = async () => {
      if (dueNow === null) dueNow = await dueCount(cfg, person.user_id, now).catch(() => 0);

      return dueNow;
    };

    if (dailyDue(person, now)) {
      const message = dailyMessage(await countDue(), now, person.lang);

      patch.last_sent_on = local.date; // counts as today's reminder even when nothing is due

      if (message) {
        messages.push([message, 'daily']);
        patch.last_alert_at = now.toISOString();
      }
    }

    // The streak nudge only when cards are due (otherwise it is a dead end).
    const dates = reviewDates.get(person.user_id) || new Set();

    if (streakWindow(person, dates, now) && streakDue(person, dates, now, await countDue())) {
      messages.push([streakMessage(now, person.lang), 'streak']);
      patch.last_streak_on = local.date;
      patch.last_alert_at = now.toISOString();
    }

    // Cards that became due during the day, at most a few times and never at night.
    if (messages.length === 0 && person.due_alerts !== false) {
      // Cheap checks first, so the card count is only fetched for likely people.
      if (alertDue({ ...person, due_min: 1 }, 1, lastReview.get(person.user_id) || null, now)) {
        const count = await countDue();

        if (alertDue(person, count, lastReview.get(person.user_id) || null, now)) {
          messages.push([alertMessage(count, now, person.lang), 'alerts']);

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

  // Several people at once, so thousands fit inside the time limit; one
  // person's failure never stops the others.
  await runPool(settings, 12, (person) => handlePerson(person).catch(() => {}));

  for (const endpoint of new Set(deadEndpoints)) {
    await rest(cfg, `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    totals.removed += 1;
  }

  return totals;
}

// Records the run for the Stats page (supabase/reminders.sql). Never fails the job.
async function logRun(cfg, row) {
  await rest(cfg, 'reminder_runs', { method: 'POST', body: row, prefer: 'return=minimal' }).catch(() => {});
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

    await logRun(cfg, { people: result.people, sent: result.devices, detail: result });

    return send(res, 200, { ok: true, ...result });
  } catch (error) {
    const detail = String(error?.message || error).slice(0, 120);

    await logRun(cfg, { people: 0, sent: 0, detail: { error: detail } });

    return send(res, 500, { error: 'The reminder job failed.', detail });
  }
}
