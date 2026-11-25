import { describe, expect, it } from 'vitest';
import { cardPath, printedLink, refCode, shareLink } from '../src/shareCard.js';

describe('share card links (spec §4)', () => {
  it('gives each account a stable six-character code', () => {
    expect(refCode('abc-123')).toBe(refCode('abc-123'));
    expect(refCode('abc-123')).toMatch(/^[0-9a-z]{6}$/);
    expect(refCode('abc-123')).not.toBe(refCode('abc-124'));
    expect(refCode(null)).toBe(refCode('guest'));
  });

  it('puts the card type in utm_campaign and the person in utm_content', () => {
    for (const [variant, pathId, path] of [
      ['daily', null, '/daily'],
      ['diag', 'nsu', '/nsu'],
      ['diag', 'sat', '/sat'],
      ['recap', null, '/sample'],
    ]) {
      const url = new URL(shareLink(variant, pathId, 'abc-123'));

      expect(url.origin).toBe('https://mnemoq-two.vercel.app');
      expect(url.pathname).toBe(path);
      expect(url.searchParams.get('utm_source')).toBe('friend');
      expect(url.searchParams.get('utm_medium')).toBe('share_card');
      expect(url.searchParams.get('utm_campaign')).toBe(`card_${variant}`);
      expect(url.searchParams.get('utm_content')).toBe(refCode('abc-123'));
      expect(url.search).not.toContain('abc-123');
      expect(url.search).not.toContain('f-');
    }
  });

  it('guests (the public Daily) share with the guest code', () => {
    expect(new URL(shareLink('daily', null, null)).searchParams.get('utm_content')).toBe(refCode('guest'));
  });

  it('falls back to the home page for exams without a free check; printed links carry no tags', () => {
    expect(new URL(shareLink('diag', 'buet', 'x')).pathname).toBe('/');
    expect(cardPath('diag', 'buet')).toBe('');
    expect(printedLink('diag', 'buet')).toBe('mnemoq-two.vercel.app');
    expect(printedLink('diag', 'sat')).toBe('mnemoq-two.vercel.app/sat');
    expect(printedLink('daily')).toBe('mnemoq-two.vercel.app/daily');
    expect(printedLink('recap')).toBe('mnemoq-two.vercel.app/sample');
  });
});
