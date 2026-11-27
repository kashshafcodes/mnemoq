// One builder for every tracked link we hand out: share cards, invites, the
// sample round, the Stats page's post links and the soft-launch invite groups
// (Phase 3 wave 3-A, company/growth/student-feedback-outreach.md §6).
//
//   trackedLink('daily', { source: 'friend', medium: 'share_card', campaign: 'card_daily', content: 'ab12cd' })
//   → https://mnemoq-two.vercel.app/daily?utm_source=friend&utm_medium=share_card&utm_campaign=card_daily&utm_content=ab12cd
//
// src/track.js reads these five tags on a visitor's first touch, so keep the
// names. Referral credit depends on utm_source=friend with the refcode in
// utm_content (src/referral/rules.js); don't change those links' source.

export const SITE = 'https://mnemoq-two.vercel.app';

// Lower case, a–z 0–9 _ and -, at most 40 characters (track.js clips at 60).
export const slugTag = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const TAGS = ['source', 'medium', 'campaign', 'content'];

export function trackedLink(path = '', tags = {}, site = SITE) {
  const params = new URLSearchParams();

  for (const key of TAGS) {
    const value = slugTag(tags[key]);

    if (value) params.set(`utm_${key}`, value);
  }

  const clean = String(path || '').replace(/^\/+/, '');
  const query = params.toString();

  return `${site.replace(/\/+$/, '')}/${clean}${query ? `?${query}` : ''}`;
}
