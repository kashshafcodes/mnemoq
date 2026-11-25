import { localizeQuestion } from './overlay';

// Misses come back automatically (owner decision D1, practice-library-uses.md
// idea 1): every wrong answer in a practice set or the drill becomes a review
// card, due now, with its explanation. At most MISS_CAP per session, explained
// ones first, and never the same question twice (duplicate guard by source id,
// the question's id such as `quant-461`).
//
// The cards table has no source_id column yet (no database change in this
// wave), so the guard keeps { sourceId: cardId } per account in this browser
// and also skips a miss whose question text is already one of the cards.

export const MISS_CAP = 10;
const KEPT_KEY = 'mnemoq-kept-misses';

const SUBJECT_FOR = {
  vocab: 'English',
  'word-problems': 'Mathematics',
  quant: 'Mathematics',
  'school-maths': 'Mathematics',
  'higher-maths': 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  'computer-science': 'Computer Science',
  economics: 'Economics',
  geography: 'Geography',
};

// questions = the set as loaded (not localized); picked = { [id]: option index }.
// Returns the missed questions, explained ones first, in their set order.
export function missedInOrder(questions, picked) {
  const missed = questions.filter((q) => picked[q.id] !== q.answer);
  const explained = missed.filter((q) => String(q.explain || '').trim() !== '');

  return [...explained, ...missed.filter((q) => !explained.includes(q))];
}

// One card for one miss, in the language the student saw it in.
export function missCard(original, picked, collection, lang = 'en') {
  const q = localizeQuestion(original, lang);
  const useCard = original.card && !(lang === 'bn' && original.bn);
  const chosen = picked[original.id];

  return {
    sourceId: original.id,
    subject: SUBJECT_FOR[collection?.id] || collection?.title || 'Practice',
    category: String(original.topic || collection?.title || 'Practice').slice(0, 40),
    question: useCard ? original.card.question : q.question,
    correctAnswer: useCard ? original.card.answer : q.options[q.answer],
    yourAnswer: Number.isInteger(chosen) ? q.options[chosen] : '',
    explanation: String(q.explain || '').slice(0, 600),
    distractors: useCard ? [] : q.options.filter((_, i) => i !== q.answer).slice(0, 3),
    nextReviewAt: null, // due now, like every new card (src/snap/due.js)
    method: 'practice_miss',
  };
}

// cards = candidates in priority order; kept = { sourceId: cardId } for this
// account; cards = the account's current cards ({ id, question }).
// Returns the cards to add: not kept before (or kept but since deleted), not
// already a card with the same question, at most `cap`.
export function pickNewMisses(candidates, kept, cards, cap = MISS_CAP) {
  const ids = new Set(cards.map((c) => c.id));
  const texts = new Set(cards.map((c) => String(c.question || '').trim()));
  const seen = new Set();
  const out = [];

  for (const card of candidates) {
    if (out.length >= cap) break;
    if (seen.has(card.sourceId)) continue;
    seen.add(card.sourceId);
    if (kept[card.sourceId] && ids.has(kept[card.sourceId])) continue;
    if (texts.has(String(card.question || '').trim())) continue;
    out.push(card);
  }

  return out;
}

function readAll(storage) {
  try {
    return JSON.parse(storage?.getItem(KEPT_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function readKept(userId, storage = globalThis.localStorage) {
  return readAll(storage)[userId] || {};
}

// changes = { sourceId: cardId or null (forget) }.
export function writeKept(userId, changes, storage = globalThis.localStorage) {
  const all = readAll(storage);
  const mine = { ...(all[userId] || {}) };

  for (const [sourceId, cardId] of Object.entries(changes)) {
    if (cardId) mine[sourceId] = cardId;
    else delete mine[sourceId];
  }

  try {
    storage?.setItem(KEPT_KEY, JSON.stringify({ ...all, [userId]: mine }));
  } catch {
    // The guard is a convenience; the text check still catches most repeats.
  }
}
