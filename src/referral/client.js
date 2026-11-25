// Referral Pro days, the app side (spec growth/share-referral-perks.md §5).
//   - sendClaim: once per account, saves the first-touch refcode and click time
//     (src/track.js trafficSource) into referral_claims, so the server check
//     never depends on this browser again.
//   - afterDaysSynced: after a sync that added a learning day, asks
//     /api/referral at most once a Dhaka day, and only for accounts that came
//     through a link. Fires ref_progress while the friend is on the way.
// src/sync/sync.js calls both; nothing here throws. src/track.js is loaded
// lazily so the sync module doesn't pull in the analytics client.

const tracking = () => import('../track');

import { dhakaDay, refFromSource } from './rules';

const claimKey = (user) => `mnemoq-ref-claim-${user}`; // 'sent' | 'none'
const checkKey = (user) => `mnemoq-ref-check-${user}`; // a Dhaka day, or 'done'
const FINAL = ['held', 'granted', 'rejected', 'revoked'];

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

const get = (store, key) => {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const set = (store, key, value) => {
  try {
    store?.setItem(key, value);
  } catch {
    // Blocked storage: we ask again next time, the server stays correct.
  }
};

// -> 'sent' | 'none' | null (null: try again later)
export async function sendClaim(client, user, { store = storage(), source = null, now = new Date() } = {}) {
  if (!client?.from || !user) return null;

  const saved = get(store, claimKey(user));

  if (saved) return saved;

  try {
    const ref = refFromSource((source || (await tracking()).trafficSource)());

    if (!ref) {
      // This browser has no link, but another device may have sent one.
      const { data, error } = await client.from('referral_claims').select('refcode').eq('friend_id', user).limit(1);

      if (error) return null;

      const value = Array.isArray(data) && data.length ? 'sent' : 'none';

      set(store, claimKey(user), value);
      return value;
    }

    // Never claim a click in the future (a fast clock), the server checks it.
    const clicked = Math.min(Date.parse(ref.clickedAt) || now.getTime(), now.getTime());
    const { error } = await client
      .from('referral_claims')
      .insert({ friend_id: user, refcode: ref.refcode, clicked_at: new Date(clicked).toISOString() });

    // 23505: a claim already exists for this account (first one wins).
    if (error && error.code !== '23505') return null;

    set(store, claimKey(user), 'sent');
    return 'sent';
  } catch {
    return null;
  }
}

// -> the server reply, or null when nothing was asked
export async function afterDaysSynced(client, user, { store = storage(), source = null, now = new Date(), request = globalThis.fetch } = {}) {
  if (!client?.auth || !user) return null;

  const today = dhakaDay(now);
  const last = get(store, checkKey(user));

  if (last === 'done' || last === today) return null;
  if ((await sendClaim(client, user, { store, source, now })) !== 'sent') return null;

  try {
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) return null;

    const res = await request('/api/referral', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) return null;

    const body = await res.json().catch(() => null);

    if (!body?.status) return null;

    set(store, checkKey(user), FINAL.includes(body.status) || body.status === 'none' ? 'done' : today);

    if (body.status === 'pending') (await tracking()).track('ref_progress', { days: Math.min(Number(body.days) || 0, 1) });

    return body;
  } catch {
    return null;
  }
}

// For the sign-up event: did this visit come through a friend's link?
export function fromRef(source) {
  try {
    return Boolean(refFromSource(source()));
  } catch {
    return false;
  }
}
