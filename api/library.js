// GET /api/library?c=<collection>&n=<set number>
//
// Sends one 20-question practice set from library/ (built by
// scripts/build-library.mjs). Set 1 of every collection is free for anyone;
// every other set is sent only to Pro accounts, checked here on the server.
//
// Replies:
//   200 { collection, n, questions }
//   401 { error, code: 'auth' }   a Pro set without being logged in
//   402 { error, code: 'pro' }    a Pro set on the free plan
//   404 { error, code: 'missing' }

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasPro } from './_plan.js';
import { getUser, supabaseConfig } from './suggest.js';

const ROOT = join(process.cwd(), 'library');
let catalog = null;

function loadCatalog() {
  if (!catalog) catalog = JSON.parse(readFileSync(join(ROOT, 'catalog.json'), 'utf8'));

  return catalog;
}

export const FREE_SETS = 1;

function send(res, status, body, cache = 'private, no-store') {
  res.setHeader?.('Cache-Control', cache);

  return res.status(status).json(body);
}

export default async function handler(req, res, env = process.env) {
  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return send(res, 405, { error: 'Use GET.', code: 'method' });
  }

  const id = String(req.query?.c || '');
  const n = Number(req.query?.n);
  const entry = loadCatalog().collections.find((c) => c.id === id);

  if (!entry || !Number.isInteger(n) || n < 1 || n > entry.sets) return send(res, 404, { error: 'That practice set does not exist.', code: 'missing' });

  if (n > FREE_SETS) {
    const cfg = supabaseConfig(env);
    const header = String(req.headers?.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const user = cfg && token ? await getUser(cfg, token).catch(() => null) : null;

    if (!user) return send(res, 401, { error: 'Log in to open this set.', code: 'auth' });
    if (!(await hasPro(env, cfg, token, user))) return send(res, 402, { error: 'This set is part of Mnemoq Pro.', code: 'pro' });
  }

  // `id` was matched against the catalog and `n` is a checked integer, so this path is safe.
  const questions = JSON.parse(readFileSync(join(ROOT, 'sets', entry.id, `${n}.json`), 'utf8'));

  return send(res, 200, { collection: entry.id, n, questions }, n <= FREE_SETS ? 'public, max-age=3600' : 'private, no-store');
}
