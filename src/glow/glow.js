// Glow v1, the rules (pure, no storage). Spec: company/product/phase2-glow-memory-map.md §2.
// Glow is a whole number added to a lifetime total. It pays most for real
// recall, is never sold, never decays and unlocks only Jonaki's look and name.
//
//   award(action, ctx) -> { amount, reason, key, exempt, capped }
//   levelFor(G)        -> { level, from, next, toNext }
//   jonakiGlow(G)      -> 0.30 .. 1, Jonaki's brightness
//
// `ctx.day` is this Dhaka day's record on this device:
//   { glow: capped Glow so far, keys: [awarded keys], snaps: Glow-paying snaps }
// `ctx.ever` is the list of keys that pay once ever (diagnostics, mocks).

export const DAILY_CAP = 100;
export const SNAPS_PER_DAY = 3;

export const AMOUNTS = {
  'review.recalled': 3, // a due card, rated good/easy
  'review.missed': 1, // a due card tried and missed, answer seen
  'review.notDue': 0, // manual review of a card that is not due
  'daily.lantern': 2, // per lit lantern
  'daily.sure': 3, // a lit lantern bet "sure"
  'daily.finish': 2, // all 5 answered
  'practice.correct': 2, // practice or drill question
  'card.practiceMiss': 1, // a missed practice question kept as a card
  'card.snap': 5, // a card made from a snap
  'card.manual': 0, // quick add, CSV import, bulk save
  'round.finish': 10, // every step of Today's round done
  diagnostic: 30, // outside the cap
  mock: 20, // outside the cap
};

// Kinds that pay outside the daily cap.
const EXEMPT = new Set(['diagnostic', 'mock']);

const nothing = (reason, key = null) => ({ amount: 0, reason, key, exempt: false, capped: false });

// Which row of the table an action is, and the key that stops it paying twice.
//   { type: 'review', cardId, due, recalled }
//   { type: 'daily', puzzle, index, correct, sure }   one lantern
//   { type: 'daily.finish', puzzle }
//   { type: 'practice', questionId, correct }         practice or drill
//   { type: 'card', method, cardId, ok }              method: snap | snap_offline | practice_miss | other
//   { type: 'round' }
//   { type: 'diagnostic', path, kind }
//   { type: 'mock', source, id }                      source 'prepared:x' pays once per paper
function classify(action = {}) {
  switch (action.type) {
    case 'review':
      if (action.cardId == null) return null;
      if (!action.due) return { row: 'review.notDue', key: null };
      return { row: action.recalled ? 'review.recalled' : 'review.missed', key: `card:${action.cardId}` };
    case 'daily':
      if (!action.correct) return { row: null, key: null, reason: 'miss' };
      return { row: action.sure ? 'daily.sure' : 'daily.lantern', key: `daily:${action.puzzle}:${action.index}`, once: true };
    case 'daily.finish':
      return { row: 'daily.finish', key: `dailyDone:${action.puzzle}`, once: true };
    case 'practice':
      if (!action.correct) return { row: null, key: null, reason: 'miss' };
      return { row: 'practice.correct', key: `q:${action.questionId}` };
    case 'card':
      if (action.method === 'snap' || action.method === 'snap_offline') {
        return action.ok === false ? { row: 'card.manual', key: null } : { row: 'card.snap', key: null, snap: true };
      }
      if (action.method === 'practice_miss') return { row: 'card.practiceMiss', key: `save:${action.cardId}` };
      return { row: 'card.manual', key: null };
    case 'round':
      return { row: 'round.finish', key: 'round' };
    case 'diagnostic':
      return { row: 'diagnostic', key: `diag:${action.path}:${action.kind}`, once: true };
    case 'mock': {
      const prepared = String(action.source || '').startsWith('prepared:');

      return { row: 'mock', key: prepared ? `mock:${action.source}` : `mock:custom:${action.id}`, once: true };
    }
    default:
      return null;
  }
}

export function award(action, ctx = {}) {
  const kind = classify(action);

  if (!kind) return nothing('unknown');
  if (!kind.row) return nothing(kind.reason || 'none');

  const day = ctx.day || {};
  const keys = day.keys || [];
  const ever = ctx.ever || [];
  const base = AMOUNTS[kind.row] || 0;

  if (base === 0) return nothing(kind.row === 'review.notDue' ? 'notDue' : 'free', kind.key);
  // Daily lanterns, mocks and diagnostics pay once ever; everything else once a day.
  if (kind.key && (kind.once ? ever.includes(kind.key) || keys.includes(kind.key) : keys.includes(kind.key))) return nothing('again', kind.key);
  if (kind.snap && (day.snaps || 0) >= SNAPS_PER_DAY) return nothing('snapLimit');

  if (EXEMPT.has(kind.row)) return { amount: base, reason: kind.row, key: kind.key, exempt: true, capped: false, once: true };

  const room = Math.max(0, DAILY_CAP - (day.glow || 0));
  const amount = Math.min(base, room);

  return { amount, reason: amount === 0 ? 'cap' : kind.row, key: kind.key, exempt: false, capped: amount < base, once: Boolean(kind.once), snap: Boolean(kind.snap) };
}

// The day record after an award. Keys are kept even at the cap, so a capped
// card does not pay later the same day either.
export function applyAward(day = {}, result) {
  const next = { glow: day.glow || 0, extra: day.extra || 0, keys: [...(day.keys || [])], snaps: day.snaps || 0 };

  if (result.key && result.reason !== 'again' && !next.keys.includes(result.key)) next.keys.push(result.key);
  if (result.exempt) next.extra += result.amount;
  else next.glow += result.amount;
  if (result.snap && result.amount > 0) next.snaps += 1;

  return next;
}

// ---- levels and Jonaki ------------------------------------------------------

export const LEVELS = [0, 100, 400, 1000, 2500];

export function levelFor(G = 0) {
  const g = Math.max(0, Number(G) || 0);
  let level = 1;

  for (let i = 0; i < LEVELS.length; i += 1) if (g >= LEVELS[i]) level = i + 1;

  const next = LEVELS[level] ?? null;

  return { level, from: LEVELS[level - 1], next, toNext: next === null ? 0 : next - g };
}

// 0.30 at 0, about 0.38 at 100, 0.57 at 400, 0.80 at 1000, 0.97 at 2500.
export function jonakiGlow(G = 0) {
  const g = Math.max(0, Number(G) || 0);

  return 0.3 + 0.7 * (1 - Math.exp(-g / 800));
}
