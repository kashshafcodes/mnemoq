import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cacheRule } from '../src/install/cacheRules.js';
import { DISMISS_DAYS, detectPlatform, installOffer, isStandalone } from '../src/install/installLogic.js';
import { cleanMessage, ignorable } from '../src/errors/report.js';

const ORIGIN = 'https://mnemoq-two.vercel.app';
const DAY = 24 * 60 * 60 * 1000;

const between = (text) => {
  const start = text.indexOf('// <cache-rules>');
  const end = text.indexOf('// </cache-rules>');

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  // The working tree may use CRLF (core.autocrlf); compare the code, not line endings.
  return text.slice(start, end).replace(/\r\n/g, '\n').trim();
};

const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
// eslint-disable-next-line no-new-func
const swRule = new Function(`${between(swSource)}\nreturn cacheRule;`)();

const CASES = [
  [{ url: '/assets/index-abc123.js' }, 'swr'],
  [{ url: '/assets/KaTeX_Main-Regular-B22Nviop.woff2' }, 'swr'],
  [{ url: 'https://fonts.googleapis.com/css2?family=Inter' }, 'swr'],
  [{ url: 'https://fonts.gstatic.com/s/inter/v1/a.woff2' }, 'swr'],
  [{ url: '/manifest.webmanifest' }, 'swr'],
  [{ url: '/icon-192.png?v=2' }, 'swr'],
  [{ url: '/', mode: 'navigate' }, 'page'],
  [{ url: '/daily?utm_source=share', mode: 'navigate' }, 'page'],
  [{ url: '/#/review', mode: 'navigate' }, 'page'],
  [{ url: '/api/pay', method: 'POST' }, 'none'],
  [{ url: '/api/coach' }, 'none'],
  [{ url: '/api/pay', mode: 'navigate' }, 'none'],
  [{ url: '/assets/index.js', method: 'POST' }, 'none'],
  [{ url: '/assets/index.js', method: 'HEAD' }, 'none'],
  [{ url: 'https://abcd.supabase.co/rest/v1/site_events' }, 'none'],
  [{ url: 'https://abcd.supabase.co/auth/v1/token' }, 'none'],
  [{ url: 'https://www.googletagmanager.com/gtag/js?id=G-1' }, 'none'],
  [{ url: 'https://region1.google-analytics.com/g/collect' }, 'none'],
  [{ url: '/sw.js' }, 'none'],
  [{ url: '/ga.js' }, 'none'],
  [{ url: '/src/main.jsx' }, 'none'],
  [{ url: '/og.png' }, 'none'],
  [{ url: 'chrome-extension://abc/x.js' }, 'none'],
];

describe('service worker cache rules', () => {
  it('caches only static files and pages, never API, Supabase, analytics or non-GET', () => {
    for (const [req, expected] of CASES) {
      expect(cacheRule({ method: 'GET', mode: 'cors', ...req }, ORIGIN), JSON.stringify(req)).toBe(expected);
    }
  });

  it('public/sw.js carries the same rule, word for word', () => {
    const src = readFileSync(new URL('../src/install/cacheRules.js', import.meta.url), 'utf8');

    expect(between(swSource)).toBe(between(src));

    for (const [req, expected] of CASES) {
      expect(swRule({ method: 'GET', mode: 'cors', ...req }, ORIGIN)).toBe(expected);
    }
  });

  it('keeps the push and notification handlers', () => {
    expect(swSource).toContain("addEventListener('push'");
    expect(swSource).toContain("addEventListener('notificationclick'");
    expect(swSource).toContain('showNotification');
  });
});

describe('install prompt timing', () => {
  const now = Date.parse('2026-12-01T10:00:00Z');
  const android = { canPrompt: true, platform: 'other', now };

  it('never shows on the first visit', () => {
    expect(installOffer({ visits: 1 }, android)).toBe(null);
    expect(installOffer({ visits: 0 }, android)).toBe(null);
    expect(installOffer({ visits: 2 }, android)).toBe('android');
  });

  it('never shows inside the installed app or after installing', () => {
    expect(installOffer({ visits: 5 }, { ...android, standalone: true })).toBe(null);
    expect(installOffer({ visits: 5, installed: true }, android)).toBe(null);
  });

  it(`waits ${DISMISS_DAYS} days after "Not now" (and at least 7)`, () => {
    expect(DISMISS_DAYS).toBeGreaterThanOrEqual(7);
    expect(installOffer({ visits: 5, dismissedAt: now - 3 * DAY }, android)).toBe(null);
    expect(installOffer({ visits: 5, dismissedAt: now - (DISMISS_DAYS - 0.1) * DAY }, android)).toBe(null);
    expect(installOffer({ visits: 5, dismissedAt: now - (DISMISS_DAYS + 0.1) * DAY }, android)).toBe('android');
  });

  it('shows the iPhone guide only in Safari, and nothing where install is impossible', () => {
    expect(installOffer({ visits: 3 }, { platform: 'ios-safari', now })).toBe('ios');
    expect(installOffer({ visits: 3 }, { platform: 'ios-other', now })).toBe(null);
    expect(installOffer({ visits: 3 }, { platform: 'other', canPrompt: false, now })).toBe(null);
  });

  it('tells iPhone Safari apart from other iPhone browsers and Android', () => {
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const crios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
    const fbApp = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]';
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    const android = 'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

    expect(detectPlatform(safari)).toBe('ios-safari');
    expect(detectPlatform(crios)).toBe('ios-other');
    expect(detectPlatform(fbApp)).toBe('ios-other');
    expect(detectPlatform(ipad, 5)).toBe('ios-safari');
    expect(detectPlatform(ipad, 0)).toBe('other');
    expect(detectPlatform(android)).toBe('other');
  });

  it('detects standalone mode', () => {
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: (q) => ({ matches: q.includes('standalone') }) })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false);
  });
});

describe('client error reports', () => {
  it('trims and scrubs messages', () => {
    expect(cleanMessage(new Error('Failed for kashshaf@example.com at https://x.y/z?a=1 id 01891966267'))).toBe('Failed for [email] at [url] id [n]');
    expect(cleanMessage('x'.repeat(200))).toHaveLength(80);
    expect(cleanMessage({ message: 'boom' })).toBe('boom');
  });

  it('skips noise', () => {
    expect(ignorable('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(ignorable('Script error.')).toBe(true);
    expect(ignorable('boom', 'chrome-extension://abc/content.js')).toBe(true);
    expect(ignorable('Cannot read properties of undefined')).toBe(false);
  });
});
