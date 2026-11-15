// POST /api/sms-hook
//
// Called by an SMS-forwarder app on the owner's Android phone for every
// incoming SMS (see docs/payments.md). bKash / Nagad "money received" messages
// are saved and matched to students' TrxIDs; everything else is ignored and
// never stored.
//
// The app must prove it knows the secret, in any of these ways:
//   - in the address        /api/sms-hook?key=<secret>
//   - as a header           X-Hook-Secret: <secret>
//   - an HMAC-SHA256 signature of the JSON body (keys sorted), in a header whose
//     name contains "signature" or "hmac" (hex or base64, "sha256=" allowed).
//     This is what iPhone forwarder apps that "sign" webhooks do; use the same
//     secret as the app's signing key.
// Body: JSON { "from": "bKash", "text": "You have received Tk ..." }
// ("message", "body" or "sms" also work for the text; "sender" for from).
//
// Settings (Vercel > Environment Variables):
//   SMS_HOOK_SECRET            long random string, also typed into the app
//   SUPABASE_SERVICE_ROLE_KEY  already set for reminders

import { createHmac } from 'node:crypto';
import { parsePaymentSms, recordSms, timingSafeEqual } from './_payments.js';
import { adminConfig } from './_push.js';

export const config = { maxDuration: 20 };

const send = (res, status, body) => res.status(status).json(body);

function readBody(req) {
  const body = req.body;

  if (body && typeof body === 'object') return body;

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return Object.fromEntries(new URLSearchParams(body));
    }
  }

  return {};
}

// JSON with keys sorted at every level, compact: the "stable" form apps sign.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function signatureValid(headers, data, rawBody, secret) {
  const given = Object.entries(headers || {})
    .filter(([name]) => /signature|hmac/i.test(name))
    .map(([, value]) => String(value).trim().replace(/^sha256=/i, ''));

  if (given.length === 0) return false;

  const bodies = [canonical(data), JSON.stringify(data)];

  if (typeof rawBody === 'string') bodies.push(rawBody);

  for (const body of bodies) {
    const mac = createHmac('sha256', secret).update(body, 'utf8');
    const digest = mac.digest();
    const forms = [digest.toString('hex'), digest.toString('base64'), digest.toString('base64url')];

    if (given.some((g) => forms.some((f) => timingSafeEqual(g, f) || timingSafeEqual(g.toLowerCase(), f)))) return true;
  }

  return false;
}

export default async function handler(req, res, env = process.env) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }

  const secret = env.SMS_HOOK_SECRET || '';
  const given = String(req.headers?.['x-hook-secret'] || req.query?.key || '');
  const data = readBody(req);
  const allowed =
    secret.length >= 16 &&
    (timingSafeEqual(given, secret) || signatureValid(req.headers, data, typeof req.body === 'string' ? req.body : null, secret));

  if (!allowed) return send(res, 401, { error: 'Not allowed.' });

  const cfg = adminConfig(env);

  if (!cfg) return send(res, 503, { error: 'Payments are not set up yet.' });

  const from = data.from || data.sender || data.address || '';
  const text = data.text || data.message || data.body || data.sms || data.msg || '';
  const payment = parsePaymentSms(text, from);

  // Not a payment: answer 200 so the app does not keep retrying, and keep nothing.
  if (!payment) return send(res, 200, { ok: true, payment: false });

  try {
    const matched = await recordSms(cfg, payment);

    return send(res, 200, {
      ok: true,
      payment: true,
      trx: payment.trx_id,
      amount: payment.amount,
      granted: matched.filter((r) => r?.status === 'granted').length,
    });
  } catch (error) {
    // 500 makes the forwarder retry later, which is what we want.
    return send(res, 500, { error: 'Could not save the payment.', detail: String(error?.message || error).slice(0, 100) });
  }
}
