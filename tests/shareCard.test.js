import { describe, expect, it } from 'vitest';
import { printedLink, refCode, shareLink } from '../src/shareCard.js';

describe('share card links', () => {
  it('gives each account a stable six-character code', () => {
    expect(refCode('abc-123')).toBe(refCode('abc-123'));
    expect(refCode('abc-123')).toMatch(/^[0-9a-z]{6}$/);
    expect(refCode('abc-123')).not.toBe(refCode('abc-124'));
  });

  it('sends friends to the free check with tracking tags', () => {
    const url = new URL(shareLink('nsu', 'abc-123'));

    expect(url.pathname).toBe('/nsu');
    expect(url.searchParams.get('utm_source')).toBe('friend');
    expect(url.searchParams.get('utm_medium')).toBe('share_card');
    expect(url.searchParams.get('utm_campaign')).toBe(`f-${refCode('abc-123')}`);
  });

  it('falls back to the home page for exams without a free check', () => {
    expect(new URL(shareLink('buet', 'x')).pathname).toBe('/');
    expect(printedLink('buet')).toBe('mnemoq-two.vercel.app');
    expect(printedLink('sat')).toBe('mnemoq-two.vercel.app/sat');
  });
});
