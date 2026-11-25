// Server-only helpers for api/referral.js (wave 3d-2): the invite card's data,
// friend-opened Glow, and the owner's review. Imported by the API only, never
// by the app bundle. Every call uses the service key passed in as `cfg`, and
// `rest` from api/_push.js (injected, so tests can fake it).
//
// Privacy: invite() returns only a first name and a day count per pending
// friend, never an id, email or code of anyone but the caller. The admin
// actions return emails, and only after isAdmin() said yes.

import { addDays, dhakaDay, learningWindow, NEEDED_DAYS, validRefcode } from './rules.js';
import { cappedFriendGlow, FRIEND_DEVICE, friendGlow, PLAYED_EVENTS, weekOf } from './friendGlow.js';

const enc = encodeURIComponent;
const list = (rows) => (Array.isArray(rows) ? rows : []);
const inList = (ids) => `(${ids.map((id) => `"${String(id).replace(/["\\]/g, '')}"`).join(',')})`;

async function first(rest, cfg, path) {
  const rows = list(await rest(cfg, path));

  return rows.length ? rows[0] : null;
}

// Is the signed-in person an owner (supabase/analytics.sql site_admins)?
export async function isAdmin(rest, cfg, user) {
  const email = String(user?.email || '').toLowerCase();

  if (!email || !(user.email_confirmed_at || user.confirmed_at)) return false;

  const row = await first(rest, cfg, `site_admins?select=email&email=eq.${enc(email)}&limit=1`).catch(() => null);

  return Boolean(row);
}

// The caller's own code, as stored (fallback codes start with x).
export async function ownRefcode(rest, cfg, userId) {
  await rest(cfg, 'rpc/ensure_refcode', { method: 'POST', body: { p_user: userId }, prefer: 'return=representation' }).catch(() => null);

  const row = await first(rest, cfg, `refcodes?select=refcode&user_id=eq.${enc(userId)}&limit=1`);

  return validRefcode(row?.refcode) ? row.refcode : null;
}

async function authUser(cfg, id, request) {
  try {
    const res = await request(`${cfg.url}/auth/v1/admin/users/${enc(id)}`, { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } });

    return res.ok ? await res.json().catch(() => null) : null;
  } catch {
    return null;
  }
}

// Only the first word of the name the friend gave, never the email.
export function firstName(user) {
  const meta = user?.user_metadata || {};
  const name = String(meta.name || meta.full_name || meta.display_name || '').trim().split(/\s+/)[0] || '';

  return name.slice(0, 20) || null;
}

// The invite card: your code, what you've earned, who is on their way.
// -> { refcode, granted, month, held, cap: null | 'month' | 'total', pending: [{ name, days }] }
export async function invite(rest, cfg, user, { now = new Date(), request = globalThis.fetch } = {}) {
  const refcode = await ownRefcode(rest, cfg, user.id);

  if (!refcode) return { refcode: null, granted: 0, month: 0, held: 0, cap: null, pending: [] };

  const since = new Date(now.getTime() - 16 * 86400000).toISOString();
  const [rewards, claims] = await Promise.all([
    rest(cfg, `referral_rewards?select=friend_id,status,reason,qualified_at,days_referrer&referrer_id=eq.${enc(user.id)}&limit=200`).then(list),
    rest(cfg, `referral_claims?select=friend_id,created_at&refcode=eq.${enc(refcode)}&created_at=gte.${enc(since)}&order=created_at.desc&limit=20`).then(list),
  ]);

  const month = dhakaDay(now).slice(0, 7);
  const paid = rewards.filter((r) => ['granted', 'revoked'].includes(r.status) && Number(r.days_referrer) > 0);
  const granted = paid.filter((r) => r.status === 'granted').length;
  const thisMonth = paid.filter((r) => r.qualified_at && dhakaDay(r.qualified_at).slice(0, 7) === month).length;
  const settled = new Set(rewards.map((r) => r.friend_id));
  const open = claims.filter((c) => c.friend_id && c.friend_id !== user.id && !settled.has(c.friend_id)).slice(0, 5);
  let pending = [];

  if (open.length) {
    const ids = open.map((c) => c.friend_id);
    const [days, people] = await Promise.all([
      rest(cfg, `learning_days?select=user_id,day&user_id=in.${inList(ids)}&actions=gt.0&day=gte.${dhakaDay(since)}&limit=500`).then(list).catch(() => []),
      Promise.all(ids.map((id) => authUser(cfg, id, request))),
    ]);

    pending = open
      .map((c, i) => {
        const signup = people[i]?.created_at || c.created_at;
        const { from, to } = learningWindow(signup);
        const today = dhakaDay(now);
        const n = new Set(days.filter((d) => d.user_id === c.friend_id && d.day >= from && d.day < to).map((d) => String(d.day).slice(0, 10))).size;

        return today >= to ? null : { name: firstName(people[i]), days: Math.min(n, NEEDED_DAYS - 1) };
      })
      .filter(Boolean);
  }

  return {
    refcode,
    granted,
    month: thisMonth,
    held: rewards.filter((r) => r.status === 'held').length,
    cap: paid.length >= 10 ? 'total' : thisMonth >= 3 ? 'month' : null,
    pending,
  };
}

// Friend-opened Glow: recomputed from site_events, written into the caller's
// learning_days as sources.glow.friend for this week and last week.
// -> { friends, days: { day: glow } }
export async function friends(rest, cfg, user, { now = new Date() } = {}) {
  const refcode = await ownRefcode(rest, cfg, user.id);

  if (!refcode) return { friends: 0, days: {} };

  const rows = list(
    await rest(
      cfg,
      `site_events?select=visitor_id,at&source=eq.friend&props->>utm_content=eq.${enc(refcode)}&event=in.(${PLAYED_EVENTS.join(',')})&order=at.asc&limit=2000`
    )
  );
  const ids = [...new Set(rows.map((r) => r.visitor_id).filter(Boolean))];
  const own = new Set();

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const mine = list(await rest(cfg, `site_events?select=visitor_id&user_id=eq.${enc(user.id)}&visitor_id=in.${enc(inList(chunk))}&limit=1000`));

    for (const r of mine) own.add(r.visitor_id);
  }

  const since = addDays(weekOf(dhakaDay(now)), -7);
  const result = friendGlow({ rows, own, since });
  const days = Object.keys(result.days);
  const written = {};

  if (days.length) {
    const have = list(await rest(cfg, `learning_days?select=day,sources,actions&user_id=eq.${enc(user.id)}&day=in.(${days.join(',')})`));
    const byDay = Object.fromEntries(have.map((r) => [String(r.day).slice(0, 10), r]));
    const upserts = [];

    for (const day of days) {
      const row = byDay[day];
      const sources = row?.sources && typeof row.sources === 'object' ? { ...row.sources } : {};
      const glow = { ...(sources.glow || {}) };
      const n = cappedFriendGlow(result.days[day], glow);

      written[day] = n;
      if (n === Number(glow[FRIEND_DEVICE] || 0)) continue;

      glow[FRIEND_DEVICE] = n;
      sources.glow = glow;
      upserts.push({
        user_id: user.id,
        day,
        sources,
        glow: Object.values(glow).reduce((sum, v) => sum + (Number(v) || 0), 0),
        actions: Number(row?.actions) || 0,
      });
    }

    if (upserts.length) {
      await rest(cfg, 'learning_days?on_conflict=user_id,day', { method: 'POST', body: upserts, prefer: 'resolution=merge-duplicates,return=minimal' });
    }
  }

  return { friends: result.friends, days: written };
}

// The owner's list: held and granted referrals, and link visits per code.
// -> { rows: [{ friend_id, friend, referrer, refcode, status, reason, at, days_referrer, days_friend }], visits: [{ refcode, visitors, owner }] }
export async function adminList(rest, cfg, { now = new Date(), request = globalThis.fetch } = {}) {
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [rows, events, emails] = await Promise.all([
    rest(cfg, 'referral_rewards?select=friend_id,referrer_id,refcode,status,reason,qualified_at,created_at,days_referrer,days_friend&status=in.(held,granted,revoked)&order=created_at.desc&limit=100').then(list),
    rest(cfg, `site_events?select=visitor_id,code:props->>utm_content&source=eq.friend&at=gte.${enc(since)}&limit=5000`).then(list).catch(() => []),
    (async () => {
      try {
        const res = await request(`${cfg.url}/auth/v1/admin/users?per_page=1000`, { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } });
        const body = res.ok ? await res.json() : null;

        return new Map(list(body?.users).map((u) => [u.id, u.email]));
      } catch {
        return new Map();
      }
    })(),
  ]);

  const perCode = new Map();

  for (const e of events) {
    if (!validRefcode(e.code)) continue;
    if (!perCode.has(e.code)) perCode.set(e.code, new Set());
    perCode.get(e.code).add(e.visitor_id);
  }

  const codes = [...perCode.keys()];
  const owners = codes.length ? list(await rest(cfg, `refcodes?select=refcode,user_id&refcode=in.(${codes.join(',')})`).catch(() => [])) : [];
  const ownerOf = new Map(owners.map((o) => [o.refcode, emails.get(o.user_id) || null]));

  return {
    rows: rows.map((r) => ({
      friend_id: r.friend_id,
      friend: emails.get(r.friend_id) || null,
      referrer: emails.get(r.referrer_id) || null,
      refcode: r.refcode,
      status: r.status,
      reason: r.reason,
      at: r.qualified_at || r.created_at,
      days_referrer: r.days_referrer,
      days_friend: r.days_friend,
    })),
    visits: codes
      .map((code) => ({ refcode: code, visitors: perCode.get(code).size, owner: ownerOf.get(code) || null }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 50),
  };
}

// Release or Revoke one friend's referral (the SQL functions in referrals-2.sql).
export async function review(rest, cfg, action, friendId) {
  const fn = action === 'release' ? 'referral_release' : action === 'revoke' ? 'referral_revoke' : null;

  if (!fn || !/^[0-9a-f-]{36}$/i.test(String(friendId || ''))) return { status: 'invalid' };

  const out = await rest(cfg, `rpc/${fn}`, { method: 'POST', body: { p_friend: friendId }, prefer: 'return=representation' });

  return { status: out?.status || 'failed' };
}
