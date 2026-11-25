import { supabase } from '../supabaseClient';
import { AiError } from '../aiSuggest';
import { previewMode } from '../devPreview';

export { tomorrowMorningDhaka } from './due';

// Talks to api/snap.js. Throws AiError with a short `code` the sheet turns
// into text: auth, limit, busy, failed, config, input, too_long, too_big,
// network. The photo is sent once and kept nowhere.

const TIMEOUT_MS = 25000;
async function token() {
  const { data } = await supabase.auth.getSession();
  const value = data?.session?.access_token;

  if (!value) throw new AiError('auth', 'auth');

  return value;
}

// ---- the development preview (?preview) has no server: a stand-in ----------
// Words in typed text pick the state, so every screen can be reached:
//   "unsure" -> unsure card, "blurry" -> unreadable, "busy" -> busy error,
//   "limit" -> quota reached, "fail" -> failed, "many" -> several questions.
const mockState = { left: 5 };

function mockReply(body) {
  const text = String(body.text || '').toLowerCase();
  const has = (word) => text.includes(word);

  if (has('limit') || mockState.left <= 0) {
    throw Object.assign(new AiError('limit', 'limit'), { remaining: 0, limit: 5, pro: false, proLimit: 50, resetsAt: new Date(Date.now() + 4.4 * 3600000).toISOString() });
  }
  if (has('busy')) throw new AiError('busy', 'busy');
  if (has('fail')) throw new AiError('failed', 'failed');
  if (has('blurry')) return { readable: false, reason: 'blurry', remaining: mockState.left, limit: 5, pro: false };

  mockState.left -= 1;

  const bn = body.language === 'bn';
  const card = {
    question: body.mode === 'photo' ? 'What is the SI unit of power?' : String(body.text).slice(0, 200),
    answer: 'Watt (W)',
    yourAnswer: 'Joule',
    distractors: ['Joule', 'Newton', 'Pascal'],
    hook: bn ? 'ওয়াট = জুল প্রতি সেকেন্ড। Joule হলো শক্তি, power নয়।' : 'Watt = joule per second. Joule is energy, not power.',
    concept: 'Units of power',
    subject: 'Physics',
    category: 'Units',
    sure: !has('unsure'),
    multi: has('many'),
    srcLang: 'en',
  };

  return { readable: true, card, remaining: mockState.left, limit: 5, pro: false, proLimit: 50, resetsAt: mockState.left === 0 ? new Date(Date.now() + 4.4 * 3600000).toISOString() : null, model: 'preview', tokens: null };
}

function previewCall(body, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        resolve(mockReply(body));
      } catch (error) {
        reject(error);
      }
    }, body.text?.toLowerCase().includes('slow') ? 9500 : 1200);

    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
}

// ---- the real calls ----------------------------------------------------------

// -> { remaining, limit, pro, resetsAt } or null when unknown.
export async function snapAllowance() {
  if (previewMode()) return { remaining: mockState.left, limit: 5, pro: false, proLimit: 50, resetsAt: null };

  try {
    const response = await fetch('/api/snap', { cache: 'no-store', headers: { Authorization: `Bearer ${await token()}` } });

    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// body: { mode: 'photo'|'text', image?, text?, subjects, language }
// -> { readable, reason?, card?, remaining, limit, pro, resetsAt, model, tokens }
export async function requestSnap(body, outerSignal) {
  if (previewMode()) return previewCall(body, outerSignal);

  const auth = await token();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();

  outerSignal?.addEventListener?.('abort', onAbort);

  try {
    let response;

    try {
      response = await fetch('/api/snap', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (outerSignal?.aborted) throw error;
      throw new AiError('network', error?.name === 'AbortError' ? 'busy' : 'network');
    }

    const data = await response.json().catch(() => null);

    if (!data) throw new AiError('failed', response.status === 503 ? 'config' : 'failed');

    if (!response.ok) {
      throw Object.assign(new AiError(data.code || 'failed', data.code || 'failed'), {
        remaining: data.remaining,
        limit: data.limit,
        pro: data.pro,
        proLimit: data.proLimit,
        resetsAt: data.resetsAt,
      });
    }

    return data;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener?.('abort', onAbort);
  }
}
