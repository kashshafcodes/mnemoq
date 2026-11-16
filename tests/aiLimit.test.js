import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiAllowance, limitMessage, usedFreeAnalysis } from '../api/_aiLimit.js';

const cfg = { url: 'https://db', key: 'anon' };
const user = { id: 'u1', email: 'a@b.c' };

// A fake Supabase: the person's plan, their AI uses today, and past analyses.
function fakeDb({ proUntil = null, ai = 0, coach = 0, analysed = false }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const u = String(url);
      const counted = (n) => ({ ok: true, headers: new Headers({ 'content-range': `0-0/${n}` }), json: async () => [] });

      if (u.includes('/user_plans')) return { ok: true, json: async () => (proUntil ? [{ pro_until: proUntil }] : []) };
      if (u.includes('/ai_usage')) return counted(ai);
      if (u.includes('/coach_usage')) return counted(coach);
      if (u.includes('/diagnostics')) return { ok: true, json: async () => (analysed ? [{ id: 1 }] : []) };

      return { ok: false };
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('daily AI allowance', () => {
  it('gives free accounts 5 a day, counting every AI feature together', async () => {
    fakeDb({ ai: 3, coach: 2 });

    const a = await aiAllowance({}, cfg, 'token', user);

    expect(a).toMatchObject({ pro: false, limit: 5, used: 5 });
    expect(limitMessage(a)).toMatch(/5 free AI uses.*Pro gives you 50/);
  });

  it('gives Pro accounts 50 a day', async () => {
    fakeDb({ proUntil: new Date(Date.now() + 86400000).toISOString(), ai: 10 });

    expect(await aiAllowance({}, cfg, 'token', user)).toMatchObject({ pro: true, limit: 50, used: 10 });
  });

  it('can be changed from Vercel settings', async () => {
    fakeDb({});

    expect((await aiAllowance({ AI_FREE_DAILY_LIMIT: '8' }, cfg, 'token', user)).limit).toBe(8);
  });

  it('knows when the one free coach analysis has been used', async () => {
    fakeDb({ analysed: true });
    expect(await usedFreeAnalysis(cfg, 'token')).toBe(true);

    fakeDb({ analysed: false });
    expect(await usedFreeAnalysis(cfg, 'token')).toBe(false);
  });
});
