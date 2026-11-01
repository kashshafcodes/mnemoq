// POST /api/push-test
//
// Sends a test reminder to the logged-in person's own devices, so they can
// check that reminders work before waiting for tomorrow.

import { adminConfig, loadWebPush, rest, sendToDevices, testMessage, vapidReady } from './_push.js';
import { getUser, supabaseConfig } from './suggest.js';

export const config = { maxDuration: 30 };

const send = (res, status, body) => res.status(status).json(body);

export default async function handler(req, res, env = process.env, deps = {}) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }

  const publicCfg = supabaseConfig(env);
  const admin = adminConfig(env);

  if (!publicCfg || !admin || !vapidReady(env)) {
    return send(res, 503, { error: 'Reminders are not set up on the server yet.', code: 'config' });
  }

  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = token ? await getUser(publicCfg, token).catch(() => null) : null;

  if (!user) return send(res, 401, { error: 'Please log in again.', code: 'auth' });

  try {
    const devices = await rest(admin, `push_subscriptions?select=*&user_id=eq.${user.id}`);

    if (devices.length === 0) {
      return send(res, 400, { error: 'This device is not signed up for reminders yet.', code: 'nodevice' });
    }

    const webpush = deps.webpush || (await loadWebPush());
    const { sent, dead } = await sendToDevices(webpush, env, devices, testMessage());

    for (const endpoint of dead) {
      await rest(admin, `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    }

    if (sent === 0) return send(res, 502, { error: 'The test could not be delivered. Turn reminders off and on again.', code: 'failed' });

    return send(res, 200, { ok: true, sent });
  } catch {
    return send(res, 500, { error: 'The test could not be sent. Try again.', code: 'failed' });
  }
}
