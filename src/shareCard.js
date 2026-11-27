// Share links (spec company/product/phase2-share-card.md §4). The card itself
// is drawn by src/share/drawCard.js and shared by src/share/ShareSheet.jsx.
//
// Every share link:
//   https://mnemoq-two.vercel.app/<path>?utm_source=friend&utm_medium=share_card
//     &utm_campaign=card_<variant>&utm_content=<refcode>
// The refcode is a short hash of the account id: stable for that person, and it
// reveals nothing. Old links (utm_campaign=f-<code>) stay readable.

import { SITE, trackedLink } from './links';

export { SITE };

// Exams that have a free, no-sign-up check a friend can take.
const TRY_PATHS = { sat: 'sat', nsu: 'nsu', brac: 'brac' };
// Where each card sends a friend: the Daily, the free check, a playable round.
const CARD_PATHS = { daily: 'daily', recap: 'sample' };

export const VARIANTS = ['daily', 'diag', 'recap'];

export function refCode(userId) {
  let h = 2166136261;

  for (const ch of String(userId || 'guest')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }

  return (h >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

export function cardPath(variant, pathId) {
  return variant === 'diag' ? TRY_PATHS[pathId] || '' : CARD_PATHS[variant] || '';
}

export function shareLink(variant, pathId, userId) {
  return trackedLink(cardPath(variant, pathId), {
    source: 'friend',
    medium: 'share_card',
    campaign: `card_${VARIANTS.includes(variant) ? variant : 'diag'}`,
    content: refCode(userId),
  });
}

// What the link looks like printed on the card (no tracking tags).
export const printedLink = (variant, pathId) => `mnemoq-two.vercel.app/${cardPath(variant, pathId)}`.replace(/\/$/, '');

export const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
