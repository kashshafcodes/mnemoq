// GET /api/library?c=<collection>&n=<set number>
//
// Sends one 20-question practice set from library/ (built by
// scripts/build-library.mjs). The first half of each collection's sets
// (src/practice/access.js) is free for anyone; every other set is sent only to
// Pro accounts, checked here on the server. The curated-core overlay
// (library/overlay/<collection>/<set>.json, src/practice/overlay.js) is joined
// over the set before it is sent.
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
import { isFreeSet } from '../src/practice/access.js';
import { applyOverlay } from '../src/practice/overlay.js';

const ROOT = join(process.cwd(), 'library');
let catalog = null;

function loadCatalog() {
  if (!catalog) catalog = JSON.parse(readFileSync(join(ROOT, 'catalog.json'), 'utf8'));

  return catalog;
}

const overlays = new Map();

// The overlay file for one set, or null when there is none. A missing folder,
// a missing file or a file that does not parse changes nothing.
export function loadOverlay(dir, collection, n) {
  const key = `${dir}|${collection}|${n}`;

  if (overlays.has(key)) return overlays.get(key);

  let overlay = null;

  try {
    overlay = JSON.parse(readFileSync(join(dir, collection, `${n}.json`), 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error(`library overlay ${collection}/${n} ignored:`, error.message);
  }

  overlays.set(key, overlay);

  return overlay;
}

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

  const free = isFreeSet(entry.sets, n);

  if (!free) {
    const cfg = supabaseConfig(env);
    const header = String(req.headers?.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const user = cfg && token ? await getUser(cfg, token).catch(() => null) : null;

    if (!user) return send(res, 401, { error: 'Log in to open this set.', code: 'auth' });
    if (!(await hasPro(env, cfg, token, user))) return send(res, 402, { error: 'This set is part of Mnemoq Pro.', code: 'pro' });
  }

  // `id` was matched against the catalog and `n` is a checked integer, so this path is safe.
  const original = JSON.parse(readFileSync(join(ROOT, 'sets', entry.id, `${n}.json`), 'utf8'));
  const questions = applyOverlay(original, loadOverlay(join(ROOT, 'overlay'), entry.id, n));

  return send(res, 200, { collection: entry.id, n, questions }, free ? 'public, max-age=3600' : 'private, no-store');
}
