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

// Pieces of a signature header: "abc", "sha256=abc", "t=123,v1=abc", "sha256=abc; ts=1".
function signatureParts(value) {
  const text = String(value || '').trim();
  const parts = new Set([text]);

  for (const piece of text.split(/[,;\s]+/)) {
    if (!piece) continue;
    parts.add(piece);
    if (piece.includes('=')) parts.add(piece.slice(piece.indexOf('=') + 1));
  }

  return [...parts].filter((p) => p.length >= 32);
}

export function signatureValid(headers, data, rawBody, secret) {
  const sigHeaders = Object.entries(headers || {}).filter(([name]) => /signature|hmac/i.test(name));
  const given = sigHeaders.flatMap(([, value]) => signatureParts(value));

  if (given.length === 0) return false;

  const timestamps = [
    ...Object.entries(headers || {})
      .filter(([name]) => /timestamp|-ts$|-time$/i.test(name))
      .map(([, v]) => String(v).trim()),
    ...sigHeaders.flatMap(([, v]) => [...String(v).matchAll(/\b(?:t|ts|timestamp)=([^,;\s]+)/gi)].map((m) => m[1])),
  ];
  const bodies = [canonical(data), JSON.stringify(data)];

  if (typeof rawBody === 'string' && rawBody) bodies.push(rawBody);

  for (const t of timestamps) for (const b of [...bodies]) bodies.push(`${t}.${b}`, `${t}${b}`);

  for (const body of bodies) {
    const digest = createHmac('sha256', secret).update(body, 'utf8').digest();
    const forms = [digest.toString('hex'), digest.toString('base64'), digest.toString('base64url')];

    if (given.some((g) => forms.some((f) => timingSafeEqual(g, f) || timingSafeEqual(g.toLowerCase(), f)))) return true;
  }

  return false;
}

// The exact bytes the app sent (signatures are made over these). Falls back to
// the already-parsed body where the platform has read it.
async function readRaw(req) {
  if (typeof req.on === 'function' && !req.readableEnded) {
    const chunks = [];

    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);

    const text = Buffer.concat(chunks).toString('utf8');

    if (text) return text;
  }

  return typeof req.body === 'string' ? req.body : null;
}

function parseRaw(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

export default async function handler(req, res, env = process.env) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }

  // Pasted secrets often carry a trailing space or line break: ignore it.
  const secret = String(env.SMS_HOOK_SECRET || '').trim();

  if (secret.length < 16) {
    return send(res, 503, { error: 'Not set up: add SMS_HOOK_SECRET (16+ characters) in Vercel and redeploy.', reason: 'server-secret-missing' });
  }

  const raw = await readRaw(req).catch(() => null);
  const data = raw ? parseRaw(raw) : readBody(req);
  const key = String(req.headers?.['x-hook-secret'] || req.query?.key || '').trim();
  const sigHeaders = Object.keys(req.headers || {}).filter((name) => /signature|hmac/i.test(name));

  if (!timingSafeEqual(key, secret) && !signatureValid(req.headers, data, raw, secret)) {
    // Say which check failed (never the secret itself) so setup problems are easy to fix.
    const reason = key ? 'key-does-not-match' : sigHeaders.length ? 'signature-does-not-match' : 'no-key-or-signature';

    return send(res, 401, { error: 'Not allowed.', reason, signatureHeaders: sigHeaders });
  }

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
