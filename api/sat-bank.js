// GET /api/sat-bank
//
// Sends the Pro SAT questions, and only to Pro accounts. The free questions
// ship inside the app; everything else lives in api/_satBank.js, which the
// browser never receives unless this function has checked the person's plan.
//
// Replies:
//   200 { pro: true, questions: [...] }
//   200 { pro: false }                    signed in, but on the free plan
//   401 { error, code: 'auth' }

import { PRO_BANK } from './_satBank.js';
import { hasPro, listedAsPro } from './_plan.js';
import { getUser, supabaseConfig } from './suggest.js';

function send(res, status, body) {
  // Never let a shared cache hold one person's answer for another.
  res.setHeader?.('Cache-Control', 'private, no-store');

  return res.status(status).json(body);
}

export default async function handler(req, res, env = process.env) {
  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return send(res, 405, { error: 'Use GET.', code: 'method' });
  }

  const cfg = supabaseConfig(env);

  if (!cfg) return send(res, 503, { error: 'Mnemoq Pro is not set up yet.', code: 'config' });

  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) return send(res, 401, { error: 'Please log in again.', code: 'auth' });

  const user = await getUser(cfg, token).catch(() => null);

  if (!user) return send(res, 401, { error: 'Please log in again.', code: 'auth' });

  const pro = await hasPro(env, cfg, token, user);

  if (!pro) return send(res, 200, { pro: false });

  return send(res, 200, { pro: true, listed: listedAsPro(env, user), questions: PRO_BANK });
}
