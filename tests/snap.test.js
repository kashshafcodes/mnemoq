import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { makeSnap, readSnapInput, sanitizeSnap, scriptOf } from '../api/snap.js';
import { aiResetsAt, attemptAllowed, attemptCap } from '../api/_aiLimit.js';
import { base64Bytes, fitWithin, MAX_SIDE } from '../src/snap/resizeImage.js';
import { snapT, waitText } from '../src/snap/strings.js';
import { computeStreaks } from '../src/analytics.js';
import { loadActivity, recordActivity, streakTimes } from '../src/streak/activity.js';

const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD';

const good = {
  readable: true,
  question: 'What is the SI unit of power?',
  answer: 'Watt',
  yourAnswer: 'Joule',
  distractors: ['Joule', 'Newton', 'Pascal', 'Watt', ''],
  hook: 'Watt = joule per second.',
  concept: 'Units of power',
  subject: 'physics',
  category: 'Units',
  sure: true,
  multi: false,
};

describe('sanitizeSnap', () => {
  it('keeps a good card and spells the subject as the student does', () => {
    const out = sanitizeSnap(good, { subjects: ['Physics'] });

    expect(out.readable).toBe(true);
    expect(out.card).toMatchObject({ question: good.question, answer: 'Watt', yourAnswer: 'Joule', subject: 'Physics', sure: true });
  });

  it('drops duplicate, empty and answer-equal distractors', () => {
    const { card } = sanitizeSnap(good, {});

    expect(card.distractors).toEqual(['Joule', 'Newton', 'Pascal']);
  });

  it('sends no distractors when fewer than 3 good ones remain', () => {
    const { card } = sanitizeSnap({ ...good, yourAnswer: '', distractors: ['Newton', 'newton!', 'Watt'] }, {});

    expect(card.distractors).toEqual([]);
  });

  it('rejects an over-long question instead of cutting it', () => {
    expect(sanitizeSnap({ ...good, question: 'x'.repeat(601) }, {})).toBeNull();
    expect(sanitizeSnap({ ...good, question: 'x'.repeat(600) }, {})).not.toBeNull();
  });

  it('marks unsure cards so the sheet does not auto-save them', () => {
    expect(sanitizeSnap({ ...good, sure: false }, {}).card.sure).toBe(false);
    expect(sanitizeSnap({ ...good, sure: 'yes' }, {}).card.sure).toBe(false);
  });

  it('returns unreadable with a known reason and no text', () => {
    const out = sanitizeSnap({ readable: false, reason: 'not_study', question: 'private text' }, {});

    expect(out).toEqual({ readable: false, reason: 'not_study' });
    expect(sanitizeSnap({ readable: false, reason: 'weird' }, {}).reason).toBe('no_text');
    expect(sanitizeSnap({ ...good, answer: '' }, {})).toEqual({ readable: false, reason: 'no_answer' });
  });

  it('drops a "your answer" that equals the right answer', () => {
    expect(sanitizeSnap({ ...good, yourAnswer: 'watt' }, {}).card.yourAnswer).toBe('');
  });

  it('knows the script of the source', () => {
    expect(scriptOf('What is power?')).toBe('en');
    expect(scriptOf('ক্ষমতার একক কী?')).toBe('bn');
    expect(scriptOf('ক্ষমতার SI একক')).toBe('mixed');
  });
});

describe('readSnapInput', () => {
  it('accepts text up to 600 characters and refuses longer', () => {
    expect(readSnapInput({ mode: 'text', text: 'a'.repeat(600) }).input.text).toHaveLength(600);
    expect(readSnapInput({ mode: 'text', text: 'a'.repeat(601) }).error).toBe('too_long');
    expect(readSnapInput({ mode: 'text', text: '   ' }).error).toBe('input');
  });

  it('accepts a JPEG or PNG photo, strips a data: prefix, refuses junk and big bodies', () => {
    expect(readSnapInput({ mode: 'photo', image: `data:image/jpeg;base64,${JPEG}` }).input).toMatchObject({ mimeType: 'image/jpeg', image: JPEG });
    expect(readSnapInput({ mode: 'photo', image: 'iVBORw0KGgo=' }).input.mimeType).toBe('image/png');
    expect(readSnapInput({ mode: 'photo', image: 'R0lGODlh' }).error).toBe('input');
    expect(readSnapInput({ mode: 'photo', image: '<script>' }).error).toBe('input');
    expect(readSnapInput({ mode: 'photo', image: `/9j/${'A'.repeat(2 * 1024 * 1024)}` }).error).toBe('too_big');
  });

  it('keeps at most 12 distinct subjects and a known language', () => {
    const many = Array.from({ length: 20 }, (_, i) => `S${i}`);
    const { input } = readSnapInput({ mode: 'text', text: 'q', subjects: [...many, 'S1'], language: 'xx' });

    expect(input.subjects).toHaveLength(12);
    expect(input.language).toBe('en');
  });
});

describe('resizeImage bounds', () => {
  it('fits the longest side within 1280 px and never enlarges', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_SIDE, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: MAX_SIDE });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 10)).toEqual({ width: 1280, height: 1 });
    expect(fitWithin(0, 500)).toEqual({ width: 0, height: 0 });
  });

  it('counts base64 bytes', () => {
    expect(base64Bytes('QUJD')).toBe(3);
    expect(base64Bytes('QUI=')).toBe(2);
    expect(base64Bytes('QQ==')).toBe(1);
  });
});

// ---- the endpoint with a fake Supabase and a fake Gemini -------------------

const env = { VITE_SUPABASE_URL: 'https://db', VITE_SUPABASE_PUBLISHABLE_KEY: 'anon', GEMINI_API_KEY: 'k' };

function fakeWorld({ used = 0, pro = false, gemini = good, geminiStatus = 200, oldest = null, attempts = null } = {}) {
  const calls = { recorded: 0, gemini: [], attempts: 0 };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const u = String(url);
      const counted = (n) => ({ ok: true, headers: new Headers({ 'content-range': `0-0/${n}` }), json: async () => [] });

      if (u.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1', email: 'a@b.c' }) };
      if (u.includes('/user_plans')) return { ok: true, json: async () => (pro ? [{ pro_until: new Date(Date.now() + 864e5).toISOString() }] : []) };
      if (u.includes('/ai_usage') && init.method === 'POST') {
        calls.recorded += 1;
        return { ok: true };
      }
      if (u.includes('/snap_attempts') && attempts === null) return { ok: false, status: 404 };
      if (u.includes('/snap_attempts') && init.method === 'POST') {
        calls.attempts += 1;
        return { ok: true };
      }
      if (u.includes('/snap_attempts')) return counted(attempts);
      if (u.includes('order=created_at.asc')) return { ok: true, json: async () => (oldest && u.includes('/ai_usage') ? [{ created_at: oldest }] : []) };
      if (u.includes('/ai_usage')) return counted(used);
      if (u.includes('/coach_usage')) return counted(0);
      if (u.includes('generativelanguage')) {
        calls.gemini.push({ url: u, body: JSON.parse(init.body) });
        if (geminiStatus !== 200) return { ok: false, status: geminiStatus };
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemini) }] } }], usageMetadata: { totalTokenCount: 1234 } }) };
      }

      return { ok: false, status: 404 };
    })
  );

  return calls;
}

function fakeRes() {
  return {
    statusCode: 0,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const post = (body) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body });

afterEach(() => vi.unstubAllGlobals());

describe('/api/snap quota paths', () => {
  it('a card uses one snap and reports what is left', async () => {
    const calls = fakeWorld({ used: 2 });
    const res = await handler(post({ mode: 'text', text: 'SI unit of power?' }), fakeRes(), env);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ readable: true, remaining: 2, limit: 5, tokens: 1234 });
    expect(calls.recorded).toBe(1);
    expect(calls.gemini[0].url).toContain('gemini-flash-lite-latest');
  });

  it('an unreadable photo costs nothing and echoes no text', async () => {
    const calls = fakeWorld({ gemini: { readable: false, reason: 'blurry', question: 'secret', answer: '', sure: false } });
    const res = await handler(post({ mode: 'photo', image: JPEG }), fakeRes(), env);

    expect(res.body).toMatchObject({ readable: false, reason: 'blurry', remaining: 5 });
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(calls.recorded).toBe(0);
  });

  it('photos go to the flash model with the image inline, and have no Groq fallback', async () => {
    const calls = fakeWorld({ geminiStatus: 429 });
    const res = await handler(post({ mode: 'photo', image: JPEG }), fakeRes(), { ...env, GROQ_API_KEY: 'g' });

    expect(calls.gemini[0].url).toContain('gemini-flash-latest');
    expect(calls.gemini[0].body.contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: JPEG });
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('busy');
    expect(calls.recorded).toBe(0);
  });

  it('the last snap returns remaining 0 and when they come back', async () => {
    const oldest = new Date(Date.now() - 19 * 3600000).toISOString();
    fakeWorld({ used: 4, oldest });
    const res = await handler(post({ mode: 'text', text: 'q?' }), fakeRes(), env);

    expect(res.body.remaining).toBe(0);
    expect(Date.parse(res.body.resetsAt) - Date.now()).toBeGreaterThan(4.9 * 3600000);
  });

  it('a 6th attempt is refused before any AI call', async () => {
    const calls = fakeWorld({ used: 5 });
    const res = await handler(post({ mode: 'text', text: 'q?' }), fakeRes(), env);

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ code: 'limit', remaining: 0, pro: false, limit: 5 });
    expect(calls.gemini).toHaveLength(0);
  });

  it('Pro gets 50 a day', async () => {
    fakeWorld({ used: 5, pro: true });
    const res = await handler(post({ mode: 'text', text: 'q?' }), fakeRes(), env);

    expect(res.body).toMatchObject({ readable: true, remaining: 44, limit: 50, pro: true });
  });

  it('GET reports the allowance for the quota chip', async () => {
    fakeWorld({ used: 3 });
    const res = await handler({ method: 'GET', headers: { authorization: 'Bearer t' } }, fakeRes(), env);

    expect(res.body).toMatchObject({ remaining: 2, limit: 5, pro: false });
  });

  it('needs a login, and says "too long" without counting', async () => {
    fakeWorld({});
    expect((await handler({ method: 'POST', headers: {}, body: {} }, fakeRes(), env)).statusCode).toBe(401);
    expect((await handler(post({ mode: 'text', text: 'a'.repeat(700) }), fakeRes(), env)).body.code).toBe('too_long');
  });

  it('a reply that cannot be used is "failed" and costs nothing', async () => {
    const calls = fakeWorld({ gemini: { ...good, question: 'x'.repeat(700) } });
    const res = await handler(post({ mode: 'text', text: 'q?' }), fakeRes(), env);

    expect(res.statusCode).toBe(502);
    expect(calls.recorded).toBe(0);
  });

  it('turns thinking off and leaves room for the card', async () => {
    const calls = fakeWorld();
    await handler(post({ mode: 'photo', image: JPEG }), fakeRes(), env);

    const config = calls.gemini[0].body.generationConfig;
    expect(config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(config.maxOutputTokens).toBeGreaterThanOrEqual(2048);
  });

  it('a photo that fails on the vision model gets a second try on the lite model', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const calls = fakeWorld({ geminiStatus: 400 });
    const res = await handler(post({ mode: 'photo', image: JPEG }), fakeRes(), env);

    expect(res.statusCode).toBe(502);
    expect(calls.gemini.map((c) => c.url.match(/models\/([^:]+)/)[1])).toEqual(['gemini-flash-latest', 'gemini-flash-lite-latest']);
    expect(calls.gemini[1].body.contents[0].parts[0].inlineData).toBeTruthy();
    // Each failure is logged with its reason and never with the image or text.
    expect(warn).toHaveBeenCalledTimes(2);
    for (const [, line] of warn.mock.calls) {
      expect(line).toContain('"stage":"http"');
      expect(line).not.toContain(JPEG);
    }
    warn.mockRestore();
  });

  it('makeSnap says not configured without keys', async () => {
    expect(await makeSnap({}, { mode: 'text', text: 'q' })).toEqual({ notConfigured: true });
  });

  it('counts every call as an attempt, card or not', async () => {
    const calls = fakeWorld({ attempts: 3, gemini: { readable: false, reason: 'blurry', question: '', answer: '', sure: false } });
    const res = await handler(post({ mode: 'photo', image: JPEG }), fakeRes(), env);

    expect(res.body.readable).toBe(false);
    expect(calls.attempts).toBe(1);
    expect(calls.recorded).toBe(0);
  });

  it('past 3 x the snap limit of attempts in 24 h, says busy before any AI call', async () => {
    const calls = fakeWorld({ attempts: 15 });
    const res = await handler(post({ mode: 'text', text: 'q?' }), fakeRes(), env);

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ code: 'busy', remaining: 5 });
    expect(calls.gemini).toHaveLength(0);
    expect(calls.attempts).toBe(0);
  });

  it('Pro gets a bigger attempt cap (150)', async () => {
    const calls = fakeWorld({ attempts: 100, pro: true });
    const res = await handler(post({ mode: 'text', text: 'q?' }), fakeRes(), env);

    expect(res.body.readable).toBe(true);
    expect(calls.gemini).toHaveLength(1);
  });

  it('skips the attempt cap while the counter table is missing (fail open)', async () => {
    const calls = fakeWorld({ attempts: null });
    const res = await handler(post({ mode: 'text', text: 'q?' }), fakeRes(), env);

    expect(res.statusCode).toBe(200);
    expect(calls.gemini).toHaveLength(1);
  });

  it('attemptCap and attemptAllowed', () => {
    expect(attemptCap(5)).toBe(15);
    expect(attemptCap(50)).toBe(150);
    expect(attemptAllowed(14, 5)).toBe(true);
    expect(attemptAllowed(15, 5)).toBe(false);
    expect(attemptAllowed(null, 5)).toBe(true);
    expect(attemptAllowed(999, Infinity)).toBe(true);
  });

  it('aiResetsAt is null when nothing was used', async () => {
    fakeWorld({});
    expect(await aiResetsAt({ url: 'https://db', key: 'anon' }, 't')).toBeNull();
  });
});

describe('snap copy', () => {
  it('fills numbers, uses Bangla digits in Bangla, and says how long to wait', () => {
    const en = snapT('en');
    const bn = snapT('bn');

    expect(en('snap.left', { n: 1 })).toBe('1 snap left today');
    expect(en('snap.left', { n: 2 })).toBe('2 snaps left today');
    expect(bn('snap.left', { n: 2 })).toBe('আজ আর ২টি স্ন্যাপ বাকি');

    const now = Date.parse('2026-11-25T10:00:00Z');

    expect(waitText(en, '2026-11-25T15:00:00Z', now)).toEqual({ soon: true, text: '5h' });
    expect(waitText(en, '2026-11-26T08:00:00Z', now).soon).toBe(false);
    expect(waitText(en, '2026-11-25T09:00:00Z', now)).toBeNull();
  });

  it('never says Google does not use the photo', () => {
    for (const lang of ['en', 'bn']) expect(snapT(lang)('snap.privacy')).not.toMatch(/google/i);
  });
});

// ---- the one streak counts drills and snaps --------------------------------

function memoryStore() {
  const data = {};

  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)) };
}

describe('streak sources', () => {
  const now = new Date(2026, 10, 25, 20);
  const daysAgo = (n) => new Date(2026, 10, 25 - n, 12);

  it('a finished drill and a snapped card each count as a day', () => {
    const store = memoryStore();

    recordActivity('drill', daysAgo(0), store);
    recordActivity('snap', daysAgo(1), store);
    recordActivity('drill', daysAgo(0), store); // same day again: one entry

    expect(loadActivity(store)).toHaveLength(2);

    const extra = streakTimes({ plays: [], activity: loadActivity(store) });

    expect(computeStreaks([], now, extra)).toMatchObject({ current: 2, reviewedToday: true });
  });

  it('reviews, Daily plays, drills and snaps join into one streak', () => {
    const store = memoryStore();

    recordActivity('snap', daysAgo(2), store);
    recordActivity('drill', daysAgo(0), store);

    const reviews = [{ at: daysAgo(3) }];
    const extra = streakTimes({ plays: [daysAgo(1).toISOString()], activity: loadActivity(store) });

    expect(computeStreaks(reviews, now, extra).current).toBe(4);
  });

  it('ignores unknown kinds', () => {
    const store = memoryStore();

    recordActivity('login', daysAgo(0), store);
    expect(loadActivity(store)).toEqual([]);
  });
});

describe('new snapped cards are due right away', () => {
  it('saves with no review date, which the app reads as due now (like Quick add)', async () => {
    const { firstReviewAt } = await import('../src/snap/due.js');

    expect(firstReviewAt()).toBeNull();
  });
});
