// POST /api/pay   { trxId, last4 }
//
// A logged-in student reports a bKash / Nagad payment. If the payment SMS has
// already arrived (api/sms-hook.js) and matches, Pro starts at once; if not,
// the claim waits and is completed the moment the SMS arrives. The browser
// asks again every few seconds while it waits.

import { settleClaim } from './_payments.js';
import { adminConfig } from './_push.js';
import { getUser, supabaseConfig, isGuestUser, GUEST_MESSAGE } from './suggest.js';

export const config = { maxDuration: 20 };

const send = (res, status, body) => res.status(status).json(body);

const MESSAGES = {
  waiting: 'Waiting for the payment to arrive. This usually takes under a minute.',
  used: 'This transaction ID has already been used.',
  amount: 'The amount received does not match any plan. Contact us and we will sort it out.',
  mismatch: 'The phone number does not match this payment. Check the last 4 digits of the number you paid from.',
  slow_down: 'Too many tries. Please wait an hour, or contact us.',
  invalid: 'Check the transaction ID and the 4 digits.',
};

export default async function handler(req, res, env = process.env) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }

  const publicCfg = supabaseConfig(env);
  const admin = adminConfig(env);

  if (!publicCfg || !admin) return send(res, 503, { error: 'Payments are not set up yet.', status: 'config' });

  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = token ? await getUser(publicCfg, token).catch(() => null) : null;

  if (!user) return send(res, 401, { error: 'Please log in again.', status: 'auth' });

  if (isGuestUser(user)) return send(res, 403, { error: GUEST_MESSAGE, status: 'guest' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const trxId = String(body.trxId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const last4 = String(body.last4 || '').replace(/\D/g, '').slice(-4);

  if (!/^[A-Z0-9]{6,20}$/.test(trxId) || !/^\d{4}$/.test(last4)) {
    return send(res, 400, { error: MESSAGES.invalid, status: 'invalid' });
  }

  try {
    const result = await settleClaim(admin, user.id, trxId, last4);

    if (result?.status === 'granted') {
      return send(res, 200, { status: 'granted', days: result.days, proUntil: result.pro_until || null, offer: result.offer || null });
    }

    const status = result?.status || 'waiting';

    return send(res, status === 'waiting' ? 202 : 400, { status, error: MESSAGES[status] || MESSAGES.invalid });
  } catch {
    return send(res, 500, { status: 'failed', error: 'Could not check the payment. Try again in a minute.' });
  }
}
