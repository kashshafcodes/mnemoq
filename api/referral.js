// POST /api/referral   (no body; the login token says who is asking)
//
// The referral check for the signed-in person as the FRIEND: did they arrive
// through someone's link, and have they now learned on 2 separate Dhaka days
// within 14 days of signing up? The app calls this after a sync that added a
// learning day, at most once a day (src/referral/client.js).
//
// Spec: company/growth/share-referral-perks.md §2, §5. Rules: src/referral/rules.js.
// Data: supabase/referrals.sql (refcodes, referral_claims, referral_rewards,
// referral_settle). Days are granted by referral_settle with grant_pro_days,
// in one transaction, so a retry can't pay twice.
//
// Privacy: the reply never carries the other person's id, email or code.
//   -> { status: 'none' | 'pending' | 'held' | 'granted' | 'rejected', days?, reward? }
//
// Wave 3d-2 adds actions in the JSON body (one function: Hobby allows 12):
//   { action: 'invite' }   the invite card (src/referral/server.js invite)
//   { action: 'friends' }  friend-opened Glow, written to learning_days
//   { action: 'admin' }    the owner's list            (site_admins only)
//   { action: 'release' | 'revoke', friend }  owner review (site_admins only)

import { adminConfig, rest } from './_push.js';
import { getUser, supabaseConfig, isGuestUser } from './suggest.js';
import { REWARD_DAYS, decide, learningWindow, validRefcode } from '../src/referral/rules.js';
import { adminList, friends, invite, isAdmin, review } from '../src/referral/server.js';

export const config = { maxDuration: 15 };

const send = (res, status, body) => res.status(status).json(body);
const enc = encodeURIComponent;

async function rpc(cfg, name, args) {
  return rest(cfg, `rpc/${name}`, { method: 'POST', body: args, prefer: 'return=representation' });
}

async function first(cfg, path) {
  const rows = await rest(cfg, path);

  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// The referrer's email, for the "same person, second address" check. Null
// when the admin API can't be reached (the check is then skipped).
async function emailOf(cfg, userId) {
  try {
    const res = await fetch(`${cfg.url}/auth/v1/admin/users/${enc(userId)}`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });

    if (!res.ok) return null;

    const user = await res.json().catch(() => null);

    return user?.email || null;
  } catch {
    return null;
  }
}

// Gathers the facts with the service key, decides, and settles a final result.
// friend: the user from /auth/v1/user. -> the reply body
export async function checkReferral(admin, friend, now = new Date()) {
  // Every active account gets its own code (the sign-up trigger may have missed).
  await rpc(admin, 'ensure_refcode', { p_user: friend.id }).catch(() => null);

  const existing = await first(admin, `referral_rewards?select=status,reason,days_friend&friend_id=eq.${enc(friend.id)}&limit=1`);

  if (existing) return reply(existing);

  const claim = await first(admin, `referral_claims?select=refcode,clicked_at,created_at&friend_id=eq.${enc(friend.id)}&limit=1`);

  if (!claim) return { status: 'none' };

  const { from, to } = learningWindow(friend.created_at);
  const days = await rest(
    admin,
    `learning_days?select=day&user_id=eq.${enc(friend.id)}&day=gte.${from}&day=lt.${to}&actions=gt.0&limit=60`
  );

  // Not enough days yet: answer without looking up the referrer at all.
  const early = decide({ friend, claim, days }, now);

  if (early.status === 'pending') return { status: 'pending', days: early.days || 0 };

  const referrer = validRefcode(claim.refcode)
    ? await first(admin, `refcodes?select=user_id,shared&refcode=eq.${enc(claim.refcode)}&limit=1`)
    : null;
  let rewards = [];
  let burst = 1;
  let referrerEmail = null;

  if (referrer?.user_id && referrer.user_id !== friend.id) {
    const since = new Date(Date.parse(claim.created_at) - 24 * 60 * 60 * 1000).toISOString();

    [rewards, burst, referrerEmail] = await Promise.all([
      rest(admin, `referral_rewards?select=status,qualified_at,days_referrer&referrer_id=eq.${enc(referrer.user_id)}&status=in.(granted,revoked)&limit=100`),
      rest(
        admin,
        `referral_claims?select=friend_id&refcode=eq.${enc(claim.refcode)}&created_at=gte.${enc(since)}&created_at=lte.${enc(claim.created_at)}&limit=50`
      ).then((rows) => Math.max(1, Array.isArray(rows) ? rows.length : 1)),
      emailOf(admin, referrer.user_id),
    ]);
  }

  const result = decide({ friend, claim, referrer, referrerEmail, days, burst, rewards }, now);

  if (!result.write) return { status: result.status, days: result.days || 0 };

  const settled = await rpc(admin, 'referral_settle', {
    p_friend: friend.id,
    p_referrer: referrer?.user_id || null,
    p_refcode: claim.refcode,
    p_status: result.status,
    p_reason: result.reason,
    p_signup_at: friend.created_at,
    p_days: REWARD_DAYS,
  });

  return reply(settled || {});
}

// Only what the friend may see: the status, and the days when granted.
function reply(row) {
  const status = ['held', 'granted', 'rejected', 'revoked'].includes(row.status) ? row.status : 'pending';

  return status === 'granted' ? { status, reward: Number(row.days_friend) || REWARD_DAYS } : { status };
}

export default async function handler(req, res, env = process.env) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }

  const publicCfg = supabaseConfig(env);
  const admin = adminConfig(env);

  if (!publicCfg || !admin) return send(res, 503, { status: 'config' });

  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = token ? await getUser(publicCfg, token).catch(() => null) : null;

  if (!user) return send(res, 401, { status: 'auth' });

  // Guests earn nothing yet; the client asks again on a later day.
  if (isGuestUser(user)) return send(res, 200, { status: 'guest' });

  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  try {
    return send(res, 200, await act(admin, user, body || {}));
  } catch (err) {
    if (err?.status === 403) return send(res, 403, { status: 'forbidden' });
    return send(res, 500, { status: 'failed' });
  }
}

// One place that picks the action; the admin ones are checked here, on the
// server, against site_admins (hiding the list in the app is not enough).
export async function act(admin, user, body = {}) {
  const action = String(body.action || '');

  if (!action) return checkReferral(admin, user);
  if (action === 'invite') return invite(rest, admin, user);
  if (action === 'friends') return friends(rest, admin, user);

  if (['admin', 'release', 'revoke'].includes(action)) {
    if (!(await isAdmin(rest, admin, user))) throw Object.assign(new Error('forbidden'), { status: 403 });
    if (action === 'admin') return adminList(rest, admin);

    return review(rest, admin, action, body.friend);
  }

  return { status: 'invalid' };
}
