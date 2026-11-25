// The app's calls to /api/referral actions (wave 3d-2), with the signed-in
// token. In the dev preview (?preview) there is no API, so sample answers
// stand in (src/devPreview.js has the same idea for Supabase).

import { previewMode } from '../devPreview';

const SAMPLE = {
  invite: { refcode: 'k3m9qa', granted: 1, month: 1, held: 1, cap: null, pending: [{ name: 'Rafi', days: 1 }, { name: null, days: 0 }] },
  friends: { friends: 3, days: {} },
  admin: {
    rows: [
      { friend_id: '00000000-0000-4000-8000-000000000002', friend: 'friend.one@example.com', referrer: 'owner@example.com', refcode: 'k3m9qa', status: 'held', reason: 'burst', at: new Date().toISOString(), days_referrer: 0, days_friend: 0 },
      { friend_id: '00000000-0000-4000-8000-000000000003', friend: 'friend.two@example.com', referrer: 'owner@example.com', refcode: 'k3m9qa', status: 'granted', reason: null, at: new Date().toISOString(), days_referrer: 7, days_friend: 7 },
    ],
    visits: [{ refcode: 'k3m9qa', visitors: 4, owner: 'owner@example.com' }],
  },
};

// -> the reply body, or null on any failure (callers show their error line)
export async function callReferral(client, body, request = globalThis.fetch) {
  const mode = previewMode();

  if (mode) {
    if (['admin', 'release', 'revoke'].includes(body.action) && mode !== 'admin') return null;
    if (body.action === 'release') return { status: 'granted' };
    if (body.action === 'revoke') return { status: 'revoked' };

    return SAMPLE[body.action] ? structuredClone(SAMPLE[body.action]) : null;
  }

  try {
    const { data } = (await client?.auth?.getSession?.()) || {};
    const token = data?.session?.access_token;

    if (!token) return null;

    const res = await request('/api/referral', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return res.ok ? await res.json().catch(() => null) : null;
  } catch {
    return null;
  }
}
