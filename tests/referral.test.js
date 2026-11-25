import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/track', () => ({ track: vi.fn(), trafficSource: () => ({ source: 'direct' }) }));

const { track } = await import('../src/track');
const { refCode } = await import('../src/shareCard.js');
const rules = await import('../src/referral/rules.js');
const { checkReferral } = await import('../api/referral.js');
const { afterDaysSynced, sendClaim } = await import('../src/referral/client.js');

const { capState, countLearningDays, decide, normalizeEmail, refFromSource } = rules;

// The SQL mnq_refcode() (supabase/referrals.sql), step for step in BigInt:
// unsigned 32-bit FNV-1a with `%` after the xor and the multiply, base36,
// lpad 6 then the first 6 characters.
function sqlRefcode(id) {
  const M = 4294967296n;
  let h = 2166136261n;

  for (const ch of id) {
    h = (h ^ BigInt(ch.charCodeAt(0))) % M;
    h = (h * 16777619n) % M;
  }

  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let res = h === 0n ? '0' : '';

  while (h > 0n) {
    res = digits[Number(h % 36n)] + res;
    h /= 36n;
  }

  return res.padStart(6, '0').slice(0, 6);
}

const NOW = new Date('2026-12-10T12:00:00+06:00');
const friend = {
  id: 'f1',
  email: 'friend@example.com',
  created_at: '2026-12-01T10:00:00+06:00',
  email_confirmed_at: '2026-12-01T10:05:00+06:00',
};
const claim = { refcode: 'abc123', clicked_at: '2026-12-01T09:50:00+06:00', created_at: '2026-12-01T10:06:00+06:00' };
const referrer = { user_id: 'r1', shared: false };
const twoDays = [{ day: '2026-12-01' }, { day: '2026-12-03' }];
const base = { friend, claim, referrer, referrerEmail: 'ref@example.com', days: twoDays, burst: 1, rewards: [] };
const granted = (at) => ({ status: 'granted', qualified_at: at });

describe('refcodes', () => {
  it('the SQL hash gives the same code as the app for any id', () => {
    expect(refCode('00000000-0000-4000-8000-000000000001')).toBe('1lk1m0'); // pinned in the SQL readback

    for (let i = 0; i < 300; i += 1) {
      const id = `${(i * 2654435761 >>> 0).toString(16).padStart(8, '0')}-1234-4abc-8def-${String(i).padStart(12, '0')}`;

      expect(sqlRefcode(id)).toBe(refCode(id));
    }
  });

  it('reads the first-touch refcode from share links and old links', () => {
    expect(refFromSource({ source: 'friend', content: 'ab12cd', landed_at: '2026-12-01T00:00:00Z' })).toEqual({
      refcode: 'ab12cd',
      clickedAt: '2026-12-01T00:00:00.000Z',
    });
    expect(refFromSource({ source: 'facebook', campaign: 'f-zz9911' })?.refcode).toBe('zz9911');
    expect(refFromSource({ source: 'facebook', content: 'ab12cd' })).toBeNull(); // a creator clip, not a friend
    expect(refFromSource({ source: 'friend', content: 'bad code!' })).toBeNull();
    expect(refFromSource(null)).toBeNull();
  });

  it('normalises Gmail dots and +tags', () => {
    expect(normalizeEmail('A.B.C+promo@Gmail.com')).toBe('abc@gmail.com');
    expect(normalizeEmail('a.b@googlemail.com')).toBe('ab@gmail.com');
    expect(normalizeEmail('a.b+x@yahoo.com')).toBe('a.b@yahoo.com');
  });
});

describe('2 separate Dhaka days within 14 days', () => {
  it('counts distinct Dhaka dates, not rows', () => {
    expect(countLearningDays(['2026-12-01', '2026-12-01'], friend.created_at)).toBe(1);
    expect(countLearningDays(twoDays, friend.created_at)).toBe(2);
  });

  it('starts on the Dhaka sign-up day and ends after 14 days', () => {
    // 20:00 UTC on 30 Nov is 2:00 on 1 Dec in Dhaka: 30 Nov doesn't count.
    const late = '2026-11-30T20:00:00Z';

    expect(countLearningDays(['2026-11-30', '2026-12-01'], late)).toBe(1);
    expect(countLearningDays(['2026-12-01', '2026-12-14'], late)).toBe(2);
    expect(countLearningDays(['2026-12-01', '2026-12-15'], late)).toBe(1);
  });

  it('one day is pending with progress; past the window it is rejected', () => {
    expect(decide({ ...base, days: [{ day: '2026-12-01' }] }, NOW)).toMatchObject({ status: 'pending', days: 1, write: false });
    expect(decide({ ...base, days: [{ day: '2026-12-01' }] }, new Date('2026-12-15T09:00:00+06:00'))).toMatchObject({
      status: 'rejected',
      reason: 'expired',
      write: true,
    });
  });

  it('waits for a confirmed email', () => {
    expect(decide({ ...base, friend: { ...friend, email_confirmed_at: null } }, NOW)).toMatchObject({ status: 'pending', reason: 'unconfirmed' });
  });
});

describe('who counts', () => {
  it('grants a real referral', () => {
    expect(decide(base, NOW)).toEqual({ status: 'granted', reason: null, write: true });
  });

  it('needs the account created after the click', () => {
    expect(decide({ ...base, claim: { ...claim, clicked_at: '2026-12-01T10:30:00+06:00' } }, NOW)).toMatchObject({ status: 'rejected', reason: 'before_click' });
    expect(decide({ ...base, claim: { ...claim, clicked_at: null } }, NOW)).toMatchObject({ reason: 'before_click' });
    // An old account that sends a claim weeks after sign-up.
    expect(decide({ ...base, claim: { ...claim, created_at: '2026-12-20T00:00:00+06:00' } }, NOW)).toMatchObject({ reason: 'late_claim' });
  });

  it('rejects self-referral by account and by a second Gmail address', () => {
    expect(decide({ ...base, referrer: { user_id: 'f1', shared: false } }, NOW)).toMatchObject({ status: 'rejected', reason: 'self' });
    expect(decide({ ...base, friend: { ...friend, email: 'r.e.f+2@gmail.com' }, referrerEmail: 'ref@gmail.com' }, NOW)).toMatchObject({
      reason: 'self_email',
    });
  });

  it('one referrer per friend: an existing row is returned, never re-decided', () => {
    expect(decide({ ...base, existing: { status: 'granted' } }, NOW)).toEqual({ status: 'granted', reason: null, write: false });
    expect(decide({ ...base, existing: { status: 'rejected', reason: 'self' } }, NOW)).toMatchObject({ write: false });
  });

  it('rejects unknown codes and answers none without a claim', () => {
    expect(decide({ ...base, referrer: null }, NOW)).toMatchObject({ status: 'rejected', reason: 'unknown_code' });
    expect(decide({ ...base, claim: null }, NOW)).toEqual({ status: 'none', write: false });
  });

  it('holds a burst of sign-ups and shared codes for the owner', () => {
    expect(decide({ ...base, burst: 3 }, NOW).status).toBe('granted');
    expect(decide({ ...base, burst: 4 }, NOW)).toMatchObject({ status: 'held', reason: 'burst' });
    expect(decide({ ...base, referrer: { user_id: 'r1', shared: true } }, NOW)).toMatchObject({ status: 'held', reason: 'shared_code' });
  });
});

describe('caps: 3 a Dhaka month, 10 in total', () => {
  it('counts granted and revoked, not held or rejected', () => {
    const rewards = [granted('2026-12-02T10:00:00+06:00'), { status: 'revoked', qualified_at: '2026-12-03T10:00:00+06:00' }, { status: 'held' }, { status: 'rejected' }];

    expect(capState(rewards, NOW)).toEqual({ total: 2, month: 2, totalFull: false, monthFull: false });
  });

  it('uses the Dhaka month (1 Dec 01:00 in Dhaka is still 30 Nov in UTC)', () => {
    const rewards = [granted('2026-11-30T19:00:00Z'), granted('2026-12-05T10:00:00+06:00'), granted('2026-12-06T10:00:00+06:00')];

    expect(capState(rewards, NOW).monthFull).toBe(true);
    expect(decide({ ...base, rewards }, NOW)).toMatchObject({ status: 'granted', reason: 'cap_month' });
    expect(capState(rewards, new Date('2027-01-01T00:30:00+06:00')).monthFull).toBe(false);
  });

  it('stops at 10 in total', () => {
    const old = Array.from({ length: 10 }, (_, i) => granted(`2026-0${(i % 9) + 1}-10T10:00:00+06:00`));

    expect(capState(old.slice(0, 9), NOW).totalFull).toBe(false);
    expect(decide({ ...base, rewards: old }, NOW)).toMatchObject({ status: 'granted', reason: 'cap_total' });
  });
});

// A fake Supabase: the REST paths api/referral.js uses, over in-memory tables,
// and referral_settle with the SQL function's rules (one row per friend).
function fakeSupabase(state) {
  const grants = [];
  const settles = [];

  const json = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const u = new URL(url);
      const path = u.pathname.replace('/rest/v1/', '');
      const q = u.searchParams;

      if (u.pathname.startsWith('/auth/v1/admin/users/')) return json({ email: state.referrerEmail });
      if (path === 'rpc/ensure_refcode') return json('code00');

      if (path === 'rpc/referral_settle') {
        const args = JSON.parse(init.body);

        settles.push(args);

        const had = state.rewards.find((r) => r.friend_id === args.p_friend);

        if (had) return json({ status: had.status, already: true, days_friend: had.days_friend });

        const row = {
          friend_id: args.p_friend,
          referrer_id: args.p_referrer,
          status: args.p_status,
          qualified_at: args.p_status === 'granted' ? NOW.toISOString() : null,
          days_friend: args.p_status === 'granted' ? args.p_days : 0,
        };

        state.rewards.push(row);
        if (row.status === 'granted') grants.push(args.p_referrer, args.p_friend);

        return json({ status: row.status, already: false, days_friend: row.days_friend });
      }

      if (path === 'referral_rewards') {
        const friendId = q.get('friend_id')?.slice(3);
        const referrerId = q.get('referrer_id')?.slice(3);

        if (friendId) return json(state.rewards.filter((r) => r.friend_id === friendId));

        return json(state.rewards.filter((r) => r.referrer_id === referrerId && ['granted', 'revoked'].includes(r.status)));
      }

      if (path === 'referral_claims') {
        if (q.get('friend_id')) return json(state.claims.filter((c) => c.friend_id === q.get('friend_id').slice(3)));

        return json(state.claims.filter((c) => c.refcode === q.get('refcode').slice(3)));
      }

      if (path === 'refcodes') return json(state.refcodes.filter((r) => r.refcode === q.get('refcode').slice(3)));
      if (path === 'learning_days') return json(state.days);

      return json({ error: path }, false);
    })
  );

  return { grants, settles };
}

describe('api/referral checkReferral (fake Supabase)', () => {
  const admin = { url: 'https://db.example.com', key: 'service' };
  let state;

  beforeEach(() => {
    state = {
      referrerEmail: 'ref@example.com',
      rewards: [],
      claims: [{ friend_id: 'f1', ...claim }],
      refcodes: [{ refcode: 'abc123', user_id: 'r1', shared: false }],
      days: twoDays,
    };
  });

  afterEach(() => vi.unstubAllGlobals());

  it('grants 7 days to both once; a retry pays nothing more', async () => {
    const { grants, settles } = fakeSupabase(state);

    expect(await checkReferral(admin, friend, NOW)).toEqual({ status: 'granted', reward: 7 });
    expect(await checkReferral(admin, friend, NOW)).toEqual({ status: 'granted', reward: 7 });
    expect(grants).toEqual(['r1', 'f1']);
    expect(settles).toHaveLength(1); // the retry read the existing row
    expect(settles[0]).toMatchObject({ p_friend: 'f1', p_referrer: 'r1', p_status: 'granted', p_days: 7 });
  });

  it('pending days never look up the referrer and write nothing', async () => {
    state.days = [{ day: '2026-12-01' }];
    const { settles } = fakeSupabase(state);

    expect(await checkReferral(admin, friend, NOW)).toEqual({ status: 'pending', days: 1 });
    expect(settles).toHaveLength(0);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('refcodes'))).toBe(false);
  });

  it('holds a burst, and the reply never carries the referrer', async () => {
    state.claims.push(...['f2', 'f3', 'f4'].map((id) => ({ friend_id: id, ...claim })));
    fakeSupabase(state);

    const body = await checkReferral(admin, friend, NOW);

    expect(body).toEqual({ status: 'held' });
    expect(JSON.stringify(body)).not.toContain('r1');
  });

  it('answers none without a claim', async () => {
    state.claims = [];
    fakeSupabase(state);

    expect(await checkReferral(admin, friend, NOW)).toEqual({ status: 'none' });
  });
});

describe('client: claim once, check once a day', () => {
  const memory = () => {
    const data = {};

    return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } };
  };

  function fakeClient({ insertError = null, rows = [] } = {}) {
    const insert = vi.fn(async () => ({ error: insertError }));
    const select = vi.fn(() => ({ eq: () => ({ limit: async () => ({ data: rows, error: null }) }) }));

    return {
      insert,
      from: () => ({ insert, select }),
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    };
  }

  const linkSource = () => ({ source: 'friend', content: 'abc123', landed_at: '2026-12-01T03:50:00Z' });

  it('sends the first-touch refcode once, and a duplicate counts as sent', async () => {
    const store = memory();
    const client = fakeClient();

    expect(await sendClaim(client, 'f1', { store, source: linkSource, now: NOW })).toBe('sent');
    expect(await sendClaim(client, 'f1', { store, source: linkSource, now: NOW })).toBe('sent');
    expect(client.insert).toHaveBeenCalledTimes(1);
    expect(client.insert.mock.calls[0][0]).toMatchObject({ refcode: 'abc123', clicked_at: '2026-12-01T03:50:00.000Z' });

    const dup = fakeClient({ insertError: { code: '23505' } });

    expect(await sendClaim(dup, 'f2', { store: memory(), source: linkSource, now: NOW })).toBe('sent');
    expect(await sendClaim(fakeClient({ insertError: { code: '42P01' } }), 'f3', { store: memory(), source: linkSource, now: NOW })).toBeNull();
  });

  it('without a link, asks whether another device sent one', async () => {
    expect(await sendClaim(fakeClient(), 'f1', { store: memory(), source: () => ({ source: 'direct' }), now: NOW })).toBe('none');
    expect(await sendClaim(fakeClient({ rows: [{ refcode: 'abc123' }] }), 'f1', { store: memory(), source: () => ({}), now: NOW })).toBe('sent');
  });

  it('checks at most once a Dhaka day, fires ref_progress, stops when final', async () => {
    const store = memory();
    const client = fakeClient();
    let reply = { status: 'pending', days: 1 };
    const request = vi.fn(async () => ({ ok: true, json: async () => reply }));
    const opts = { store, source: linkSource, request };

    expect(await afterDaysSynced(client, 'f1', { ...opts, now: NOW })).toEqual(reply);
    expect(track).toHaveBeenCalledWith('ref_progress', { days: 1 });
    expect(await afterDaysSynced(client, 'f1', { ...opts, now: new Date('2026-12-10T23:00:00+06:00') })).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);

    reply = { status: 'granted', reward: 7 };
    expect(await afterDaysSynced(client, 'f1', { ...opts, now: new Date('2026-12-11T08:00:00+06:00') })).toEqual(reply);
    expect(await afterDaysSynced(client, 'f1', { ...opts, now: new Date('2026-12-12T08:00:00+06:00') })).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('accounts without a link never call the server', async () => {
    const request = vi.fn();

    expect(await afterDaysSynced(fakeClient(), 'f9', { store: memory(), source: () => ({}), request, now: NOW })).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
