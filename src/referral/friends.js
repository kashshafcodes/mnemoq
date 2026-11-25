// Friend-opened Glow on this device: asks the server (action 'friends') at
// most every 6 hours, keeps the friend count for the Light-passer charm, and
// puts the server's friend Glow into the pulled account days so the Glow
// total and the next upload include it. Rules: ./friendGlow.js.

import { glowChanged } from '../glow/store';
import { saveServerFriendGlow } from '../sync/queue';
import { callReferral } from './api';
import { FRIEND_GLOW } from './friendGlow';

const EVERY_MS = 6 * 60 * 60 * 1000;
const key = (user) => `mnemoq-ref-friends-${user}`;

let notice = 0; // new friend Glow waiting for Celebrations to show once

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function knownFriends(user, store = storage()) {
  try {
    const saved = JSON.parse(store?.getItem(key(user)) || 'null');

    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

// How many new friends' Glow (in +5s) arrived since it was last shown.
export function takeFriendNotice() {
  const n = notice;

  notice = 0;
  return n;
}

const sum = (days) => Object.values(days || {}).reduce((a, n) => a + (Number(n) || 0), 0);

// -> the reply, or null when not asked / failed
export async function syncFriends(client, user, { store = storage(), now = Date.now(), call = callReferral, force = false } = {}) {
  if (!user) return null;

  const before = knownFriends(user, store);

  if (!force && before && now - (Number(before.at) || 0) < EVERY_MS) return null;

  const body = await call(client, { action: 'friends' });

  if (!body || typeof body.friends !== 'number') return null;

  // The Glow already seen is kept per day, so a new week doesn't re-announce.
  const seenDays = { ...(before?.days || {}) };
  let fresh = 0;

  for (const [day, n] of Object.entries(body.days || {})) {
    const value = Number(n) || 0;

    if (before && value > (Number(seenDays[day]) || 0)) fresh += value - (Number(seenDays[day]) || 0);
    seenDays[day] = Math.max(value, Number(seenDays[day]) || 0);
  }

  const keep = Object.fromEntries(Object.entries(seenDays).sort().slice(-21));

  try {
    store?.setItem(key(user), JSON.stringify({ at: now, friends: body.friends, days: keep, total: sum(keep) }));
  } catch {
    // Storage blocked: asked again next time.
  }

  const changed = saveServerFriendGlow(user, body.days, store);

  if (fresh > 0) notice += Math.round(fresh / FRIEND_GLOW);
  if (changed || fresh > 0 || (body.friends || 0) !== (before?.friends || 0)) glowChanged();

  return body;
}

