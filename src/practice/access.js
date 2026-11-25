// Which practice-library sets are free (owner decisions D3/D4, 25 Nov 2026):
// in each collection the first half of the sets, rounded up, is free and the
// rest are Pro. One rule, used by the server gate (api/library.js), the set
// locks on the practice page, the drill rotation and the Home / Pro copy.
//
// Plain JavaScript with no imports, so the serverless API can load it too.

// sets = the collection's number of sets (catalog.json).
export function freeSetCount(sets) {
  const total = Math.max(0, Math.floor(Number(sets) || 0));

  return Math.ceil(total / 2);
}

export function isFreeSet(sets, n) {
  return Number.isInteger(n) && n >= 1 && n <= freeSetCount(sets);
}

// Real totals for honest copy: how many sets and questions are free in the
// whole catalog (before any hidden overlay items, which are few).
export function freeTotals(catalog) {
  let sets = 0;

  for (const c of catalog.collections) sets += freeSetCount(c.sets);

  return { sets, questions: sets * catalog.setSize };
}
