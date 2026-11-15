import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { runReminders } from '../api/remind.js';
import { isPushEndpoint } from '../api/_push.js';

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
function fakeDb({ people, devices, due = 4 }) {
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
      if (u.includes('/reviews?select')) return json([]);
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
    expect(JSON.parse(webpush.sendNotification.mock.calls[0][1]).title).toBe('4 cards are ready to review');
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
