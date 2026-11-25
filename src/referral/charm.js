import { knownSeen } from '../sync/queue';
import { CHARM_ID } from './friendGlow';

// Does Jonaki wear the Light-passer charm? Once celebrated it stays: the
// celebration is kept in milestones_seen (queued and on the account).
// Small on purpose (no Glow store), so the invite card stays a light chunk.
export function hasCharm(user) {
  try {
    return knownSeen(undefined, user).seen.milestones.includes(CHARM_ID);
  } catch {
    return false;
  }
}
