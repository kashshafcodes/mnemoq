import { describe, expect, it } from 'vitest';
import { SITE, slugTag, trackedLink } from '../src/links.js';

describe('tracked links (Phase 3 wave 3-A)', () => {
  it('builds a production link with only the tags given, in a fixed order', () => {
    expect(trackedLink('daily', { source: 'friend', medium: 'share_card', campaign: 'card_daily', content: 'ab12cd' })).toBe(
      `${SITE}/daily?utm_source=friend&utm_medium=share_card&utm_campaign=card_daily&utm_content=ab12cd`
    );
    expect(trackedLink('', { source: 'reddit', content: 'r_dhaka' })).toBe(`${SITE}/?utm_source=reddit&utm_content=r_dhaka`);
    expect(trackedLink('sample')).toBe(`${SITE}/sample`);
  });

  it('cleans tag values so the Stats page groups them', () => {
    expect(slugTag('  SAT Group, Nov!  ')).toBe('sat-group-nov');
    expect(slugTag('r_dhaka')).toBe('r_dhaka');
    expect(slugTag('x'.repeat(80))).toHaveLength(40);
    expect(slugTag(null)).toBe('');
    expect(trackedLink('', { source: 'Facebook', content: 'DU Admission 2027' })).toBe(`${SITE}/?utm_source=facebook&utm_content=du-admission-2027`);
  });

  it('takes another site, including an empty one for same-site links', () => {
    expect(trackedLink('/sample', { source: 'friend' }, 'http://localhost:5173/')).toBe('http://localhost:5173/sample?utm_source=friend');
    expect(trackedLink('', { source: 'daily', medium: 'result' }, '')).toBe('/?utm_source=daily&utm_medium=result');
  });
});

describe('the /daily link preview (D1)', async () => {
  const { pageWithMeta, DAILY_META } = await import('../scripts/pageMeta.js');
  const base = `<head><title>Mnemoq · Stop making the same mistake twice</title>
    <meta name="description" content="old" />
    <meta property="og:title" content="old" />
    <meta property="og:description" content="old" />
    <meta property="og:image" content="https://mnemoq-two.vercel.app/og.png" />
  </head>`;

  it('swaps the title, description and image, and adds og:url', () => {
    const html = pageWithMeta(base, DAILY_META);

    expect(html).toContain('<title>Mnemoq Daily · Five lanterns, one night</title>');
    expect(html).toContain('<meta property="og:image" content="https://mnemoq-two.vercel.app/og-daily.png" />');
    expect(html).toContain('এক রাতে পাঁচটি লণ্ঠন');
    expect(html).toContain('<meta property="og:url" content="https://mnemoq-two.vercel.app/daily" />');
    expect(html).not.toContain('content="old"');
  });

  it('escapes quotes in the copy', () => {
    expect(pageWithMeta(base, { ...DAILY_META, description: 'say "hi"' })).toContain('content="say &quot;hi&quot;"');
  });
});
