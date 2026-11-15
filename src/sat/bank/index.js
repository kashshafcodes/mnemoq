// The SAT question bank as the app sees it.
//
// Everyone gets FREE_BANK, which ships inside the app. Pro accounts also get
// the rest, which the server sends only after checking the plan
// (api/sat-bank.js). The Pro questions are never part of the app bundle.

import { fetchProBank } from '../../plan';
import { BANK_TOTALS, FREE_BANK } from './free';

export { BANK_TOTALS, FREE_BANK };

// -> { bank, pro }. `pro` is what the server said, which is the final word.
export async function loadBank(plan) {
  const result = await fetchProBank();

  if (result.pro) return { bank: [...FREE_BANK, ...result.questions], pro: true };

  // A plain development server has no /api functions. So that Pro can be
  // tried while developing, read the questions straight from the server file.
  // `import.meta.env.DEV` is false in a real build, which removes this branch
  // (and the Pro questions with it) from what is shipped.
  if (import.meta.env.DEV && plan?.pro) {
    const { PRO_BANK } = await import('../../../api/_satBank.js');

    return { bank: [...FREE_BANK, ...PRO_BANK], pro: true };
  }

  return { bank: FREE_BANK, pro: false };
}

export const lockedCount = (bank) => BANK_TOTALS.rw + BANK_TOTALS.math - bank.length;
