import { levelFor } from './glow';

// Streak milestones and Glow level-ups (pure). Spec §3 "Milestones", §2 levels.
// Each fires once per account, ever. If someone is already past several
// milestones the first time this runs (an older streak), only the highest is
// celebrated and the rest are marked seen, so nothing fires in a burst.

export const MILESTONES = [3, 7, 14, 30, 60, 100];
export const SHARE_AT = [7, 30, 100];

export const milestoneId = (days) => `streak.m${days}`;

// -> { milestone: days | null, levelUp: level | null, seen: next seen }
export function dueCelebrations({ streak = 0, glow = 0, seen = null } = {}) {
  const had = new Set(seen?.milestones || []);
  const reached = MILESTONES.filter((days) => streak >= days && !had.has(milestoneId(days)));
  const level = levelFor(glow).level;
  const seenLevel = Math.max(1, Number(seen?.level) || 1);

  return {
    milestone: reached.length ? reached[reached.length - 1] : null,
    levelUp: level > seenLevel ? level : null,
    seen: { milestones: [...new Set([...had, ...reached.map(milestoneId)])].sort(), level: Math.max(level, seenLevel) },
  };
}
