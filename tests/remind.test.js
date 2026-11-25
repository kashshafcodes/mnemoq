import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { runReminders } from '../api/remind.js';
import { alertDue, dailyDue, dailyMessage, isPushEndpoint, streakDue, streakMessage, testMessage } from '../api/_push.js';
import { PUSH_COPY, bnDigits, pushLine, variantIndex } from '../api/_pushCopy.js';

const cfg = { url: 'https://db.example', key: 'service' };
const env = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', CRON_SECRET: 'x'.repeat(20) };

function person(id, extra = {}) {
  return {
    user_id: id,
    enabled: true,
    remind_time: '18:00',
    timezone: 'Asia/Dhaka',
    streak_nudge: false,
    due_alerts: false,
    last_sent_on: null,
    ...extra,
  };
}

// A fake Supabase REST API, enough for the reminder job.
function fakeDb({ people, devices, due = 4, reviews = [] }) {
  const calls = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const u = String(url);

      calls.push([init.method || 'GET', u]);

      const json = (body) => ({ ok: true, status: 200, json: async () => body, headers: new Headers() });

      if (u.includes('/reminder_settings?select')) {
        const offset = Number(new URL(u).searchParams.get('offset') || 0);

        return json(people.slice(offset, offset + 1000));
      }
      if (u.includes('/push_subscriptions?select')) {
        const ids = decodeURIComponent(u).match(/in\.\(([^)]*)\)/)[1].split(',');

        return json(devices.filter((d) => ids.includes(d.user_id)));
      }
      if (u.includes('/reviews?select')) return json(reviews);
      if (u.includes('/mistakes?select')) return { ok: true, headers: new Headers({ 'content-range': `0-0/${due}` }) };

      return { ok: true, status: 204, json: async () => null, headers: new Headers() };
    })
  );

  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('reminder job', () => {
  // 18:05 in Dhaka (UTC+6).
  const now = new Date('2026-11-15T12:05:00Z');

  it('sends the daily reminder at the chosen time', async () => {
    fakeDb({ people: [person('a')], devices: [{ user_id: 'a', endpoint: 'https://fcm.googleapis.com/fcm/send/1' }] });
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) };

    const result = await runReminders({ env, now, webpush, cfg });

    expect(result.daily).toBe(1);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(JSON.parse(webpush.sendNotification.mock.calls[0][1]).title).toBe(pushLine('due', { n: 4 }, now).title);
  });

  it('handles thousands of people with short addresses', async () => {
    const people = Array.from({ length: 2300 }, (_, i) => person(`00000000-0000-0000-0000-${String(i).padStart(12, '0')}`, { last_sent_on: '2026-11-15' }));
    const calls = fakeDb({ people, devices: [] });

    const result = await runReminders({ env, now, webpush: { setVapidDetails() {}, sendNotification: vi.fn() }, cfg });

    expect(result.people).toBe(2300);
    expect(Math.max(...calls.map(([, u]) => u.length))).toBeLessThan(8000);
  });

  it('never sends to an address that is not a push service', async () => {
    fakeDb({ people: [person('a')], devices: [{ user_id: 'a', endpoint: 'https://169.254.169.254/latest' }] });
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn() };

    await runReminders({ env, now, webpush, cfg });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(isPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
  });

  it('refuses callers without the secret', async () => {
    const res = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };

    await handler({ method: 'POST', headers: { authorization: 'Bearer wrong' } }, res, env);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('reminder rules', () => {
  const device = (id) => ({ user_id: id, endpoint: `https://fcm.googleapis.com/fcm/send/${id}` });
  // 20:30 in Dhaka on 15 Nov; nothing yet today. Learning on 9, 10, 12 and 14
  // Nov: both free rest days of the last 7 are used (11 and 13), so tonight
  // matters (the one streak rule, atRisk).
  const evening = new Date('2026-11-15T14:30:00Z');
  const yesterday = ['09', '10', '12', '14'].map((d) => ({ user_id: 's', created_at: `2026-11-${d}T13:00:00Z` }));
  const atRiskDates = new Set(['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-14']);
  const streaker = person('s', { remind_time: '06:00', last_sent_on: '2026-11-15', streak_nudge: true });

  it('sends no streak reminder when nothing is due', async () => {
    fakeDb({ people: [streaker], devices: [device('s')], due: 0, reviews: yesterday });
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) };

    const result = await runReminders({ env, now: evening, webpush, cfg });

    expect(result.streak).toBe(0);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('sends the streak reminder when cards are due', async () => {
    fakeDb({ people: [streaker], devices: [device('s')], due: 3, reviews: yesterday });
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) };

    const result = await runReminders({ env, now: evening, webpush, cfg });

    expect(result.streak).toBe(1);
    expect(JSON.parse(webpush.sendNotification.mock.calls[0][1]).title).toBe(streakMessage(evening).title);
    expect(streakDue(streaker, atRiskDates, evening, 0)).toBe(false);
    expect(streakDue(streaker, atRiskDates, evening, 2)).toBe(true);
  });

  it('respects quiet hours for every reminder type', () => {
    // 22:40 in Dhaka.
    const late = new Date('2026-11-15T16:40:00Z');
    const dates = atRiskDates;

    expect(dailyDue(person('q', { remind_time: '22:30', quiet_start: '23:30', quiet_end: '07:00' }), late)).toBe(true);
    expect(dailyDue(person('q', { remind_time: '22:30', quiet_start: '22:00', quiet_end: '07:00' }), late)).toBe(false);
    expect(dailyDue(person('q', { remind_time: '22:30' }), late)).toBe(false); // old rows: quiet from 22:00
    expect(streakDue(person('q', { streak_nudge: true }), dates, late, 5)).toBe(false); // old rows: quiet from 22:00
    expect(streakDue(person('q', { streak_nudge: true, quiet_start: '23:30', quiet_end: '07:00' }), dates, late, 5)).toBe(true);
    expect(alertDue(person('q', { due_alerts: true, quiet_start: '22:00', quiet_end: '07:00' }), 9, null, late)).toBe(false);
    expect(alertDue(person('q', { due_alerts: true, quiet_start: '23:30', quiet_end: '07:00' }), 9, null, late)).toBe(true);
  });

  it('rotates Jonaki lines by day, with the singular and the round of 10', () => {
    const day1 = new Date('2026-11-15T12:00:00Z');
    const day2 = new Date('2026-11-16T12:00:00Z');

    expect(dailyMessage(4, day1).title).not.toBe(dailyMessage(4, day2).title);
    expect(dailyMessage(1, day1).title).toBe('1 card is starting to fade');
    expect(dailyMessage(0, day1)).toBe(null);
    expect(dailyMessage(25, day1).body).toContain('10');
    expect(testMessage(day1).title).not.toBe(testMessage(day2).title);
    expect(variantIndex('due', 6, day2)).toBe((variantIndex('due', 6, day1) + 1) % 6);

    // Every line stays within the notification limits (title 40, body 110).
    for (const list of Object.values(PUSH_COPY.en)) {
      for (const [title, body] of list) {
        const fill = (t) => t.replaceAll('{n}', '99').replaceAll('{size}', '10');

        expect(fill(title).length).toBeLessThanOrEqual(40);
        expect(fill(body).length).toBeLessThanOrEqual(110);
      }
    }
  });
});

describe('reminder language', () => {
  const now = new Date('2026-11-15T12:05:00Z'); // 18:05 in Dhaka
  const device = (id) => ({ user_id: id, endpoint: `https://fcm.googleapis.com/fcm/send/${id}` });
  const banglaOnly = /^[^A-Za-z0-9]*$/; // no Latin letters or Western digits (Mnemoq aside)

  it('sends a Bangla row its reminder in Bangla, with Bangla digits', async () => {
    fakeDb({ people: [person('b', { lang: 'bn' })], devices: [device('b')], due: 4 });
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) };

    await runReminders({ env, now, webpush, cfg });

    const sent = JSON.parse(webpush.sendNotification.mock.calls[0][1]);

    expect(sent).toMatchObject(pushLine('due', { n: 4 }, now, 'bn'));
    expect(sent.title + sent.body).toMatch(banglaOnly);
    expect(sent.title.length).toBeLessThanOrEqual(40);
    expect(sent.body.length).toBeLessThanOrEqual(110);
  });

  it('falls back to English when lang is missing or unknown', async () => {
    fakeDb({ people: [person('m'), person('u', { lang: 'fr' }), person('z', { lang: null })], devices: [device('m'), device('u'), device('z')] });
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) };

    await runReminders({ env, now, webpush, cfg });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(3);
    for (const call of webpush.sendNotification.mock.calls) {
      expect(JSON.parse(call[1]).title).toBe(pushLine('due', { n: 4 }, now).title);
    }
    expect(pushLine('streak', {}, now, 'xx')).toEqual(pushLine('streak', {}, now, 'en'));
  });

  it('has Bangla for every key, same rotation, within the limits', () => {
    expect(Object.keys(PUSH_COPY.bn).sort()).toEqual(Object.keys(PUSH_COPY.en).sort());
    for (const type of Object.keys(PUSH_COPY.en)) expect(PUSH_COPY.bn[type].length).toBe(PUSH_COPY.en[type].length);

    expect(bnDigits('99 / 10')).toBe('৯৯ / ১০');
    expect(dailyMessage(25, now, 'bn').body).toContain('১০');
    expect(dailyMessage(1, now, 'bn').title).toBe('১টি কার্ড ঝাপসা হয়ে আসছে');
    expect(streakMessage(now, 'bn').title).toBe(pushLine('streak', {}, now, 'bn').title);
    expect(testMessage(now, 'bn').title).toMatch(banglaOnly);

    for (const list of Object.values(PUSH_COPY.bn)) {
      for (const [title, body] of list) {
        const fill = (t) => t.replaceAll('{n}', bnDigits(99)).replaceAll('{size}', bnDigits(10));

        expect(fill(title).length).toBeLessThanOrEqual(40);
        expect(fill(body).length).toBeLessThanOrEqual(110);
        expect(fill(title + body).replace('Mnemoq', '')).toMatch(banglaOnly);
      }
    }
  });
});
