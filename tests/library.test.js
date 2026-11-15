import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import handler from '../api/library.js';

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

  it('keeps the other sets for Pro', async () => {
    expect((await call({ c: 'physics', n: '2' })).status).toBe(401);
  });

  it('refuses made-up collections and paths', async () => {
    expect((await call({ c: '../catalog', n: '1' })).status).toBe(404);
    expect((await call({ c: 'physics', n: '1.5' })).status).toBe(404);
    expect((await call({ c: 'physics', n: '99999' })).status).toBe(404);
  });
});
