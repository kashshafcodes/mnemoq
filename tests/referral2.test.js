import { afterEach, describe, expect, it, vi } from 'vitest';
import { cappedFriendGlow, CHARM_ID, friendGlow, weekOf } from '../src/referral/friendGlow.js';
import { dueCelebrations } from '../src/glow/milestones.js';
import { friends, invite, isAdmin, review } from '../src/referral/server.js';
import { act } from '../api/referral.js';
import handler from '../api/referral.js';
import { friendOnlyDay } from '../api/remind.js';
import { refT, inviteLink } from '../src/referral/strings.js';
import { syncFriends } from '../src/referral/friends.js';
import { capState } from '../src/referral/rules.js';

// Wave 3d-2: friend-opened Glow caps, own visitors ignored, the charm once,
// admin-only Release and Revoke.

const at = (day, hour = 10, min = 0) => `${day}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+06:00`;

describe('friend-opened Glow (pure)', () => {
  it('pays 2 a Dhaka day at most', () => {
    const rows = ['v1', 'v2', 'v3'].map((v, i) => ({ visitor_id: v, at: at('2026-12-02', 9 + i) }));

    expect(friendGlow({ rows })).toEqual({ friends: 3, days: { '2026-12-02': 10 } });
  });

  it('pays 10 a Dhaka week (Monday to Sunday) at most', () => {
    // Mon 30 Nov .. Sun 6 Dec 2026: 2 a day for 7 days = 14 visitors, 10 paid.
    const rows = [];

    for (let d = 0; d < 7; d += 1) {
      const day = new Date(Date.UTC(2026, 10, 30 + d)).toISOString().slice(0, 10);

      rows.push({ visitor_id: `a${d}`, at: at(day, 9) }, { visitor_id: `b${d}`, at: at(day, 11) });
    }

    const out = friendGlow({ rows });
    const total = Object.values(out.days).reduce((a, n) => a + n, 0);

    expect(weekOf('2026-12-06')).toBe('2026-11-30');
    expect(total).toBe(50);
    expect(out.days['2026-12-05']).toBeUndefined(); // the week was full by Friday
    expect(out.friends).toBe(14);
  });

  it('ignores your own visitor ids, and counts each visitor once on their first answer', () => {
    const rows = [
      { visitor_id: 'mine', at: at('2026-12-02', 8) },
      { visitor_id: 'v1', at: at('2026-12-03', 9) },
      { visitor_id: 'v1', at: at('2026-12-02', 23, 30) }, // first answer, late on the 2nd in Dhaka
      { visitor_id: 'v1', at: at('2026-12-04', 9) },
    ];

    expect(friendGlow({ rows, own: ['mine'] })).toEqual({ friends: 1, days: { '2026-12-02': 5 } });
  });

  it('returns only days since the given day', () => {
    const rows = [
      { visitor_id: 'v1', at: at('2026-11-10') },
      { visitor_id: 'v2', at: at('2026-12-02') },
    ];

    expect(friendGlow({ rows, since: '2026-11-23' })).toEqual({ friends: 2, days: { '2026-12-02': 5 } });
  });

  it('stays inside the 100 a day cap and never lowers what was written', () => {
    expect(cappedFriendGlow(10, { a: 95 })).toBe(5);
    expect(cappedFriendGlow(10, { a: 100, friend: 5 })).toBe(5);
    expect(cappedFriendGlow(10, { a: 20 })).toBe(10);
  });

  it('a friend-only day is not a learning day (reminder rule)', () => {
    expect(friendOnlyDay({ glow: { friend: 5 } })).toBe(true);
    expect(friendOnlyDay({ glow: { friend: 5, dev1: 3 } })).toBe(false);
    expect(friendOnlyDay({ daily: 1, glow: { friend: 5 } })).toBe(false);
  });
});

describe('over a cap: friend paid, referrer 0', () => {
  it('a row that paid the referrer 0 frees no slot and uses none', () => {
    const q = '2026-12-02T10:00:00+06:00';
    const rows = [
      { status: 'granted', qualified_at: q, days_referrer: 7 },
      { status: 'granted', qualified_at: q, days_referrer: 0, reason: 'cap_month' },
      { status: 'revoked', qualified_at: q, days_referrer: 7 },
    ];

    expect(capState(rows, new Date('2026-12-03T12:00:00+06:00'))).toMatchObject({ total: 2, month: 2 });
  });
});

describe('the Light-passer charm', () => {
  it('fires once at 3 friends, and is kept in milestones_seen', () => {
    expect(dueCelebrations({ friends: 2 }).charm).toBe(false);

    const first = dueCelebrations({ friends: 3 });

    expect(first.charm).toBe(true);
    expect(first.seen.milestones).toContain(CHARM_ID);
    expect(dueCelebrations({ friends: 5, seen: first.seen }).charm).toBe(false);
  });

  it('syncFriends announces new friend Glow once, not old Glow on a first run', async () => {
    const mem = new Map();
    const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
    let reply = { friends: 1, days: { '2026-12-02': 5 } };
    const call = async () => reply;

    await syncFriends(null, 'u1', { store, call, now: 0 });
    expect(JSON.parse(mem.get('mnemoq-ref-friends-u1'))).toMatchObject({ friends: 1, total: 5 });

    // Too soon: not asked again.
    expect(await syncFriends(null, 'u1', { store, call, now: 1000 })).toBeNull();

    reply = { friends: 2, days: { '2026-12-02': 10 } };
    await syncFriends(null, 'u1', { store, call, now: 7 * 3600 * 1000 });
    expect(JSON.parse(mem.get('mnemoq-ref-friends-u1'))).toMatchObject({ friends: 2, total: 10 });
  });
});

// A fake `rest` over in-memory tables, for src/referral/server.js.
function fakeRest(state) {
  const calls = [];
  const rest = vi.fn(async (_cfg, path, opts = {}) => {
    calls.push([path, opts]);
    const [table] = path.split('?');
    const q = new URLSearchParams(path.split('?')[1] || '');

    if (table === 'rpc/ensure_refcode') return 'x';
    if (table === 'refcodes') return [{ refcode: state.refcode }];
    if (table === 'site_admins') return state.admins.includes(q.get('email')?.slice(3)) ? [{ email: 'ok' }] : [];
    if (table === 'site_events' && q.get('user_id')) return state.own.map((v) => ({ visitor_id: v }));
    if (table === 'site_events') return state.events;
    if (table === 'learning_days' && opts.method === 'POST') {
      state.upserts.push(...opts.body);
      return null;
    }
    if (table === 'learning_days') return state.days;
    if (table === 'referral_rewards') return state.rewards;
    if (table === 'referral_claims') return state.claims;
    if (table.startsWith('rpc/referral_')) return { status: table.endsWith('release') ? 'granted' : 'revoked' };

    return [];
  });

  return { rest, calls };
}

describe('server actions (fake Supabase)', () => {
  const cfg = { url: 'https://db.example.com', key: 'service' };
  const NOW = new Date('2026-12-03T12:00:00+06:00');

  it('friends: writes sources.glow.friend next to the other devices, ignoring own visitors', async () => {
    const state = {
      refcode: 'abc123',
      own: ['mine'],
      events: [
        { visitor_id: 'mine', at: at('2026-12-02', 8) },
        { visitor_id: 'v1', at: at('2026-12-02', 9) },
        { visitor_id: 'v2', at: at('2026-12-02', 10) },
        { visitor_id: 'v3', at: at('2026-12-02', 11) },
      ],
      days: [{ day: '2026-12-02', sources: { daily: 1, glow: { dev1: 40 } }, actions: 1 }],
      upserts: [],
    };
    const { rest } = fakeRest(state);
    const out = await friends(rest, cfg, { id: 'u1' }, { now: NOW });

    expect(out).toEqual({ friends: 3, days: { '2026-12-02': 10 } });
    expect(state.upserts).toEqual([
      { user_id: 'u1', day: '2026-12-02', sources: { daily: 1, glow: { dev1: 40, friend: 10 } }, glow: 50, actions: 1 },
    ]);

    // Run again with the row already written: nothing new to write.
    state.days = [{ day: '2026-12-02', sources: state.upserts[0].sources, actions: 1 }];
    state.upserts = [];
    await friends(rest, cfg, { id: 'u1' }, { now: NOW });
    expect(state.upserts).toEqual([]);
  });

  it('invite: your stored code and first names only, never ids or emails', async () => {
    const state = {
      refcode: 'x1a2b3c4',
      rewards: [{ friend_id: 'f9', status: 'held' }, { friend_id: 'f8', status: 'granted', days_referrer: 7, qualified_at: NOW.toISOString() }],
      claims: [{ friend_id: 'f1', created_at: '2026-12-01T10:00:00Z' }, { friend_id: 'f9', created_at: '2026-12-01T10:00:00Z' }],
      days: [{ user_id: 'f1', day: '2026-12-02' }],
    };
    const { rest } = fakeRest(state);
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'f1', email: 'rafi@example.com', created_at: '2026-12-01T09:00:00Z', user_metadata: { name: 'Rafi Ahmed' } }) }));
    const out = await invite(rest, cfg, { id: 'u1' }, { now: NOW, request });

    expect(out).toEqual({ refcode: 'x1a2b3c4', granted: 1, month: 1, held: 1, cap: null, pending: [{ name: 'Rafi', days: 1 }] });
    expect(JSON.stringify(out)).not.toMatch(/f1|example\.com/);
  });

  it('only site admins may Release or Revoke', async () => {
    const state = { admins: ['owner@example.com'] };
    const { rest } = fakeRest(state);
    const owner = { email: 'Owner@example.com', email_confirmed_at: 'x' };

    expect(await isAdmin(rest, cfg, owner)).toBe(true);
    expect(await isAdmin(rest, cfg, { email: 'owner@example.com' })).toBe(false); // unconfirmed
    expect(await isAdmin(rest, cfg, { email: 'someone@example.com', email_confirmed_at: 'x' })).toBe(false);
    expect(await review(rest, cfg, 'release', 'not-a-uuid')).toEqual({ status: 'invalid' });
    expect(await review(rest, cfg, 'revoke', '00000000-0000-4000-8000-000000000002')).toEqual({ status: 'revoked' });
  });
});

describe('api/referral actions (fake fetch)', () => {
  const admin = { url: 'https://db.example.com', key: 'service' };
  const friendId = '00000000-0000-4000-8000-000000000002';

  afterEach(() => vi.unstubAllGlobals());

  function stub(admins) {
    const rpcs = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init = {}) => {
        const u = new URL(url);
        const path = u.pathname.replace('/rest/v1/', '');
        const json = (body) => ({ ok: true, status: 200, json: async () => body });

        if (u.pathname === '/auth/v1/user') return json({ id: 'u1', email: init.headers.Authorization.includes('owner') ? 'owner@example.com' : 'a@example.com', email_confirmed_at: 'x' });
        if (path === 'site_admins') return json(admins.includes(u.searchParams.get('email').slice(3)) ? [{ email: 'x' }] : []);
        if (path.startsWith('rpc/')) {
          rpcs.push([path, JSON.parse(init.body)]);
          return json({ status: path.endsWith('release') ? 'granted' : 'revoked' });
        }

        return json([]);
      })
    );

    return rpcs;
  }

  it('refuses Release and Revoke for a non-admin, and never calls the SQL', async () => {
    const rpcs = stub(['owner@example.com']);

    await expect(act(admin, { id: 'u1', email: 'a@example.com', email_confirmed_at: 'x' }, { action: 'release', friend: friendId })).rejects.toMatchObject({ status: 403 });
    await expect(act(admin, { id: 'u1', email: 'a@example.com', email_confirmed_at: 'x' }, { action: 'revoke', friend: friendId })).rejects.toMatchObject({ status: 403 });
    expect(rpcs).toEqual([]);
  });

  it('the handler answers 403 to a non-admin and runs Release for the owner', async () => {
    const rpcs = stub(['owner@example.com']);
    const env = { SUPABASE_URL: 'https://db.example.com', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' };
    const res = () => {
      const r = { code: 0, body: null };

      r.status = (c) => ((r.code = c), r);
      r.json = (b) => ((r.body = b), r);
      return r;
    };

    const denied = res();

    await handler({ method: 'POST', headers: { authorization: 'Bearer user' }, body: { action: 'revoke', friend: friendId } }, denied, env);
    expect(denied.code).toBe(403);

    const ok = res();

    await handler({ method: 'POST', headers: { authorization: 'Bearer owner' }, body: JSON.stringify({ action: 'release', friend: friendId }) }, ok, env);
    expect(ok.code).toBe(200);
    expect(ok.body).toEqual({ status: 'granted' });
    expect(rpcs).toEqual([['rpc/referral_release', { p_friend: friendId }]]);
  });
});

describe('invite copy', () => {
  it('fills the link untouched in Bangla, and numbers in Bangla digits', () => {
    const link = inviteLink('https://mnemoq-two.vercel.app', 'x1a2b3c4');

    expect(link).toBe('https://mnemoq-two.vercel.app/sample?utm_source=friend&utm_medium=invite&utm_campaign=invite&utm_content=x1a2b3c4');
    expect(refT('bn')('ref.message.friend', { link })).toContain(link);
    expect(refT('bn')('ref.progress.named', { name: 'Rafi', n: 1 })).toBe('Rafi: ২ দিনের মধ্যে ১ দিন');
    expect(refT('en')('ref.progress.anon', { n: 0 })).toBe('A friend: 0 of 2 days');
  });
});
