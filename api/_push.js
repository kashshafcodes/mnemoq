// Shared pieces of the reminder system (not a route: the leading underscore
// keeps Vercel from exposing this file).
//
//   - who is due a reminder right now, in their own time zone
//   - the reminder text
//   - sending a Web Push and cleaning up dead devices
//   - Supabase calls made with the service role key (server only)

import { pushLine } from './_pushCopy.js';
import { streakFromKeys } from '../src/glow/streak.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// How long after a person's chosen time we still send that day's reminder. The
// scheduler may run late, but a reminder for 06:00 should not arrive at night.
export const SEND_WINDOW_MIN = 180;
export const STREAK_HOUR = 20; // the "keep your streak" nudge, local time
export const STREAK_WINDOW_MIN = 180;
export const ROUND_SIZE = 10; // cards in one review round (src/quiz.js SESSION_SIZE)
export const DEFAULT_QUIET = ['22:00', '07:00']; // for rows saved before quiet hours had a value

export function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return typeof tz === 'string' && tz.length > 0;
  } catch {
    return false;
  }
}

// -> { date: 'YYYY-MM-DD', minutes: minutes since local midnight }
export function localParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function minutesOf(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || ''));

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function dayBefore(date) {
  const d = new Date(`${date}T12:00:00Z`);

  return new Date(d.getTime() - DAY_MS).toISOString().slice(0, 10);
}

// Is this person due their daily reminder now? Never inside their quiet hours.
export function dailyDue(settings, now) {
  if (!settings?.enabled || !validTimeZone(settings.timezone)) return false;

  const target = minutesOf(settings.remind_time);

  if (target === null) return false;

  const local = localParts(now, settings.timezone);
  const late = local.minutes - target;

  return late >= 0 && late < SEND_WINDOW_MIN && settings.last_sent_on !== local.date && !quiet(settings, local.minutes);
}

// Is it the evening window for the streak nudge, and does tonight matter? The
// one streak rule (src/glow/streak.js): only when the streak is alive, nothing
// is done today and both free rest days in the last 7 are used (atRisk). With a
// rest day left, today is a rest day and nothing is sent. `reviewDates` are the
// local dates (YYYY-MM-DD) with any learning in the last 14 days. Not inside
// quiet hours.
export function streakWindow(settings, reviewDates, now) {
  if (!settings?.enabled || !settings.streak_nudge || !validTimeZone(settings.timezone)) return false;

  const local = localParts(now, settings.timezone);
  const since = local.minutes - STREAK_HOUR * 60;

  if (since < 0 || since >= STREAK_WINDOW_MIN || settings.last_streak_on === local.date) return false;
  if (quiet(settings, local.minutes)) return false;

  return streakFromKeys(reviewDates, local.date).atRisk;
}

// The streak nudge, only when there is something to review: with nothing due,
// "one quick review" is impossible and the push would be a dead end.
export function streakDue(settings, reviewDates, now, dueNow) {
  return Number(dueNow) > 0 && streakWindow(settings, reviewDates, now);
}

// ---- "cards are due" alerts during the day --------------------------------

export const ALERT_GAP_MIN = 180; // at least this long between any two pushes
export const ALERT_DAILY_CAP = 3; // at most this many due-alerts per day
export const ACTIVE_MIN = 60; // not while they are reviewing right now

// Is `minutes` (since local midnight) inside quiet hours? Handles 22:00 to 07:00.
export function inQuietHours(minutes, start, end) {
  const a = minutesOf(start);
  const b = minutesOf(end);

  if (a === null || b === null || a === b) return false;

  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

// Every reminder type respects the person's quiet hours.
export function quiet(settings, minutes) {
  return inQuietHours(minutes, settings?.quiet_start || DEFAULT_QUIET[0], settings?.quiet_end || DEFAULT_QUIET[1]);
}

// Should we alert this person that cards are due, right now?
// `dueNow` is how many cards are due; `lastReviewAt` the latest review time (Date or null).
export function alertDue(settings, dueNow, lastReviewAt, now) {
  if (!settings?.enabled || settings.due_alerts === false || !validTimeZone(settings.timezone)) return false;

  const local = localParts(now, settings.timezone);

  if (quiet(settings, local.minutes)) return false;
  if (dueNow < Math.max(1, Number(settings.due_min) || 5)) return false;

  const sentToday = settings.alerts_on === local.date ? Number(settings.alerts_today) || 0 : 0;

  if (sentToday >= ALERT_DAILY_CAP) return false;

  if (settings.last_alert_at && now.getTime() - new Date(settings.last_alert_at).getTime() < ALERT_GAP_MIN * 60 * 1000) return false;
  if (lastReviewAt && now.getTime() - lastReviewAt.getTime() < ACTIVE_MIN * 60 * 1000) return false;

  return true;
}

// The texts, in Jonaki's voice, rotated by day (api/_pushCopy.js). `lang` is the
// row's reminder_settings.lang; anything but 'bn' gets English.
const dueLine = (due, now, lang) =>
  due === 1 ? pushLine('due_one', { n: 1 }, now, lang) : pushLine('due', { n: due }, now, lang);

export function alertMessage(due, now = new Date(), lang = 'en') {
  return { ...dueLine(due, now, lang), url: '/#/review', tag: 'mnemoq-due' };
}

export function dailyMessage(due, now = new Date(), lang = 'en') {
  if (due <= 0) return null;

  const line = due >= ROUND_SIZE ? pushLine('many', { n: due, size: ROUND_SIZE }, now, lang) : dueLine(due, now, lang);

  return { ...line, url: '/#/review', tag: 'mnemoq-daily' };
}

export function streakMessage(now = new Date(), lang = 'en') {
  return { ...pushLine('streak', {}, now, lang), url: '/#/review', tag: 'mnemoq-streak' };
}

export function testMessage(now = new Date(), lang = 'en') {
  return { ...pushLine('test', {}, now, lang), url: '/#/review', tag: 'mnemoq-test' };
}

// ---- sending ---------------------------------------------------------------

export async function loadWebPush() {
  const mod = await import('web-push');

  return mod.default || mod;
}

export function vapidReady(env) {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

// Browsers' push services. A saved "device" whose address is anywhere else is
// refused, so nobody can make this server send requests to a site of their choice.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.apple\.com$/,
];

export function isPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);

    return url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

// Sends one message to each device. Returns the endpoints that are gone for good.
export async function sendToDevices(webpush, env, devices, message) {
  webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:admin@example.com', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  const dead = [];
  let sent = 0;

  await Promise.all(
    devices.map(async (device) => {
      if (!isPushEndpoint(device.endpoint)) {
        dead.push(device.endpoint);
        return;
      }

      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          JSON.stringify(message),
          { TTL: 6 * 60 * 60 }
        );
        sent += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) dead.push(device.endpoint);
      }
    })
  );

  return { sent, dead };
}

// ---- Supabase with the service role key ---------------------------------------

export function adminConfig(env) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return url && key ? { url, key } : null;
}

export async function rest(cfg, path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Supabase ${res.status}`);

  return method === 'GET' || prefer?.includes('return=representation') ? res.json() : null;
}

export async function dueCount(cfg, userId, now) {
  const iso = encodeURIComponent(now.toISOString());
  const res = await fetch(
    `${cfg.url}/rest/v1/mistakes?select=id&user_id=eq.${userId}&or=(next_review_at.is.null,next_review_at.lte.${iso})`,
    { method: 'HEAD', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, Prefer: 'count=exact' } }
  );

  if (!res.ok) throw new Error(`Supabase ${res.status}`);

  const range = res.headers.get('content-range') || '';

  return Number(range.split('/')[1]) || 0;
}
