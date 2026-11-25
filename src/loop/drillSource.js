import CATALOG from '../../library/catalog.json';
import { freeSetCount } from '../practice/access';

// Where the weakest-skill drill (step 3 of Today's round) gets its five
// questions: a practice-library collection for the weakest section's subject.
// A section with no matching collection has no drill, and the step does not
// appear (never fall back to re-reviewing cards that are not due yet).

export const DRILL_SIZE = 5;

// cardSubject (paths.js / sat blueprint) -> practice-library collection.
export const DRILL_COLLECTIONS = {
  Mathematics: 'quant',
  Physics: 'physics',
  Chemistry: 'chemistry',
  Biology: 'biology',
  English: 'vocab',
  'SAT Math': 'school-maths',
};

// weakest = readiness.weakest ({ name, cardSubject, ... }) or null.
// day = a number that changes once a day, so the five questions rotate.
// Free accounts rotate through the free half of the collection; Pro accounts
// through every set (the server still checks Pro, api/library.js).
export function drillSourceFor(weakest, { day = 0, pro = false } = {}) {
  const id = weakest ? DRILL_COLLECTIONS[weakest.cardSubject] : null;
  const collection = id ? CATALOG.collections.find((c) => c.id === id) : null;

  if (!collection) return null;

  const perSet = Math.max(1, Math.floor(CATALOG.setSize / DRILL_SIZE));
  const rotation = pro ? collection.sets : Math.max(1, freeSetCount(collection.sets));
  const set = 1 + (Math.floor(day / perSet) % rotation);
  const offset = (day % perSet) * DRILL_SIZE;

  return { collection: collection.id, title: collection.title, skill: weakest.name, set, offset, size: DRILL_SIZE };
}
