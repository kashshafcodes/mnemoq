import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import handler, { loadOverlay } from '../api/library.js';
import { freeSetCount, freeTotals, isFreeSet } from '../src/practice/access.js';

const catalog = JSON.parse(readFileSync('library/catalog.json', 'utf8'));
const call = async (query, headers = {}, env = {}) => {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };

  await handler({ method: 'GET', query, headers }, res, env);

  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('practice library', () => {
  it('has thousands of well-formed questions', () => {
    expect(catalog.total).toBeGreaterThan(10000);

    for (const c of catalog.collections) {
      const set = JSON.parse(readFileSync(`library/sets/${c.id}/1.json`, 'utf8'));

      expect(set).toHaveLength(catalog.setSize);
      for (const q of set) {
        expect(q.options.length).toBeGreaterThanOrEqual(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
    }
  });

  it('gives set 1 to anyone', async () => {
    const { status, body } = await call({ c: 'physics', n: '1' });

    expect(status).toBe(200);
    expect(body.questions).toHaveLength(20);
  });

  it('gives the first half of every collection to anyone and keeps the rest for Pro', async () => {
    for (const c of catalog.collections) {
      const free = freeSetCount(c.sets);
      const last = await call({ c: c.id, n: String(free) });

      expect(last.status).toBe(200);
      if (free < c.sets) expect((await call({ c: c.id, n: String(free + 1) })).status).toBe(401);
    }

    // A token that does not check out is still refused.
    expect((await call({ c: 'physics', n: '33' }, { authorization: 'Bearer nope' })).status).toBe(401);
  });

  it('splits sets by one rule: half, rounded up', () => {
    expect([0, 1, 2, 5, 16, 17, 198].map(freeSetCount)).toEqual([0, 1, 1, 3, 8, 9, 99]);
    expect(isFreeSet(17, 9)).toBe(true);
    expect(isFreeSet(17, 10)).toBe(false);
    expect(isFreeSet(17, 0)).toBe(false);
    expect(isFreeSet(17, 1.5)).toBe(false);
    expect(freeTotals(catalog).sets).toBe(catalog.collections.reduce((n, c) => n + Math.ceil(c.sets / 2), 0));
    expect(freeTotals(catalog).questions).toBe(freeTotals(catalog).sets * catalog.setSize);
  });

  it('joins the curated overlay: corrected taka, explanation, Bangla, and hidden items dropped', async () => {
    const quant = (await call({ c: 'quant', n: '1' })).body.questions;
    const q12 = quant.find((q) => q.id === 'quant-12');

    expect(q12.options[4]).toBe('513');
    expect(q12.answer).toBe(4);
    expect(q12.question).toContain('৳');
    expect(q12.curated).toBe(true);
    expect(q12.bn.question).toBeTruthy();
    expect(q12.explain).toBeTruthy();
    expect(q12.changes).toBeUndefined();

    const vocab = (await call({ c: 'vocab', n: '1' })).body.questions;

    expect(vocab).toHaveLength(19);
    expect(vocab.find((q) => q.id === 'vocab-8')).toBeUndefined();
  });

  it('reads no overlay when there is none', () => {
    expect(loadOverlay('tests/fixtures/overlay', 'quant', 2)).toBe(null);
    expect(loadOverlay('tests/fixtures/no-such-dir', 'quant', 1)).toBe(null);
    expect(loadOverlay('tests/fixtures/overlay', 'quant', 1).items['quant-2'].skill).toBe('line-segments');
  });

  it('refuses made-up collections and paths', async () => {
    expect((await call({ c: '../catalog', n: '1' })).status).toBe(404);
    expect((await call({ c: 'physics', n: '1.5' })).status).toBe(404);
    expect((await call({ c: 'physics', n: '99999' })).status).toBe(404);
  });
});
