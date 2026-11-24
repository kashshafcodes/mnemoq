import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
vi.mock('../src/track.js', () => ({ track: (event, props) => calls.push([event, props]) }));

const { MAX_PER_LOAD, reportError, resetErrorReporting } = await import('../src/errors/report.js');

describe('client_error rate limit', () => {
  beforeEach(() => {
    calls.length = 0;
    resetErrorReporting();
  });

  it(`sends at most ${MAX_PER_LOAD} per page load, one per distinct message`, () => {
    reportError(new Error('same'));
    reportError(new Error('same'));
    expect(calls).toHaveLength(1);

    for (let i = 0; i < 20; i += 1) reportError(new Error(`boom ${String.fromCharCode(97 + i)}`));

    expect(calls).toHaveLength(MAX_PER_LOAD);
    expect(calls.every(([event]) => event === 'client_error')).toBe(true);
  });

  it('sends the page and kind, never the raw message', () => {
    reportError(new Error('bad user a@b.com'), 'boundary', { page: 'pro', where: 'at PayBox' });

    expect(calls[0]).toEqual(['client_error', { kind: 'boundary', message: 'bad user [email]', page: 'pro', where: 'at PayBox' }]);
  });
});
