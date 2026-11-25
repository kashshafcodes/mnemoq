import { levelFor } from './glow';
import { CHARM_FRIENDS, CHARM_ID } from '../referral/friendGlow';

// Streak milestones and Glow level-ups (pure). Spec §3 "Milestones", §2 levels.
// Each fires once per account, ever. If someone is already past several
// milestones the first time this runs (an older streak), only the highest is
// celebrated and the rest are marked seen, so nothing fires in a burst.

export const MILESTONES = [3, 7, 14, 30, 60, 100];
export const SHARE_AT = [7, 30, 100];

export const milestoneId = (days) => `streak.m${days}`;

// The Light-passer charm (src/referral/friendGlow.js): 3 friends opened your
// links. Kept in the same milestones_seen list, so it fires once, ever.
export { CHARM_FRIENDS, CHARM_ID };

// -> { milestone: days | null, levelUp: level | null, charm: boolean, seen: next seen }
export function dueCelebrations({ streak = 0, glow = 0, seen = null, friends = 0 } = {}) {
  const had = new Set(seen?.milestones || []);
  const charm = Number(friends) >= CHARM_FRIENDS && !had.has(CHARM_ID);
  const reached = MILESTONES.filter((days) => streak >= days && !had.has(milestoneId(days)));
  const level = levelFor(glow).level;
  const seenLevel = Math.max(1, Number(seen?.level) || 1);

  return {
    milestone: reached.length ? reached[reached.length - 1] : null,
    levelUp: level > seenLevel ? level : null,
    charm,
    seen: { milestones: [...new Set([...had, ...reached.map(milestoneId), ...(charm ? [CHARM_ID] : [])])].sort(), level: Math.max(level, seenLevel) },
  };
}
