// Helpers for reviewing a card: building multiple-choice options and checking
// typed answers. Pure functions (no React, no network) so they are easy to test.

// Lowercase, ignore punctuation/extra spaces. Letters from any language are
// kept as they are, so this is safe for non-English text too.
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/['’‘`"“”]/g, '')
    // Keep letters, combining marks (needed for Bangla, Hindi, etc.), digits.
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Edit distance where swapping two neighbouring letters counts as one slip
// ("recieve" is one slip away from "receive").
export function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[a.length][b.length];
}

// Returns 'empty' | 'correct' | 'close' | 'wrong'.
//
// 'close' means "probably right, but the spelling is off". It is only allowed
// for longer answers, because for short words one letter changes the meaning
// (affect/effect, went/want). If the person types the exact wrong answer they
// gave originally, that is always 'wrong'.
export function checkTypedAnswer(typed, correct, knownWrong = '') {
  const t = normalizeText(typed);
  const c = normalizeText(correct);
  const w = normalizeText(knownWrong);

  if (!t) return 'empty';
  if (t === c) return 'correct';
  if (w && t === w) return 'wrong';

  // A different number is a different answer ("Type 1" vs "Type 2"), never a
  // spelling slip.
  if (t.replace(/\D/g, '') !== c.replace(/\D/g, '')) return 'wrong';

  const allowedSlips = c.length >= 16 ? 2 : c.length >= 8 ? 1 : 0;

  if (allowedSlips > 0 && editDistance(t, c) <= allowedSlips) return 'close';

  return 'wrong';
}

function shuffle(list, rand) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

// Builds up to 4 options for a card: the correct answer plus wrong choices.
//
// Wrong choices come from the person's own library, no AI needed:
//   1. the wrong answer they originally gave (the mistake they really made),
//   2. correct answers of other cards in the same subject and category,
//   3. then the same subject, then anything else.
// Within each group, answers of a similar length are preferred so the right
// one doesn't stand out just by being longer or shorter.
//
// `available` is false when there aren't at least 2 wrong choices, in which
// case multiple choice shouldn't be offered for this card.
export function buildChoices(card, allCards, rand = Math.random, maxWrong = 3) {
  const correct = String(card.correctAnswer || '').trim();
  const seen = new Set([normalizeText(correct)]);
  const wrong = [];

  const ownMistake = String(card.yourAnswer || '').trim();

  if (ownMistake && !seen.has(normalizeText(ownMistake))) {
    wrong.push(ownMistake);
    seen.add(normalizeText(ownMistake));
  }

  const others = allCards.filter((other) => other.id !== card.id);

  const tiers = [
    others.filter(
      (other) => other.subject === card.subject && other.category === card.category
    ),
    others.filter((other) => other.subject === card.subject),
    others,
  ];

  for (const tier of tiers) {
    const needed = maxWrong - wrong.length;
    if (needed <= 0) break;

    const candidates = [];

    for (const other of tier) {
      const text = String(other.correctAnswer || '').trim();
      const key = normalizeText(text);

      if (!text || seen.has(key)) continue;

      seen.add(key);
      candidates.push(text);
    }

    const closest = candidates
      .map((text) => ({ text, gap: Math.abs(text.length - correct.length) }))
      .sort((x, y) => x.gap - y.gap)
      .slice(0, Math.max(needed * 2, 3))
      .map((entry) => entry.text);

    wrong.push(...shuffle(closest, rand).slice(0, needed));
  }

  const options = shuffle(
    [
      ...wrong.map((text) => ({ text, isCorrect: false })),
      { text: correct, isCorrect: true },
    ],
    rand
  );

  return { options, available: wrong.length >= 2 };
}

export const SESSION_SIZE = 10;

// Picks the cards for one short session: the most overdue ones first (new
// cards count as overdue), then shuffled so subjects are mixed together.
export function pickSessionCards(dueCards, size = SESSION_SIZE, rand = Math.random) {
  const overdueFirst = [...dueCards].sort((a, b) => {
    const aTime = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0;
    const bTime = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0;

    return aTime - bTime;
  });

  return shuffle(overdueFirst.slice(0, size), rand);
}

// ---- Scheduling ----
// What happens to a card after a rating. Used for the real save and for the
// "back in 3 days" hints, so they can never disagree.
//   again: 10 minutes, hard: same gap (at least 1 day),
//   good: double the gap (at least 1 day), easy: triple (at least 3 days).
export function scheduleNext(rating, currentIntervalDays = 0, now = new Date()) {
  const current = currentIntervalDays || 0;
  let intervalDays;
  let delayMs;

  switch (rating) {
    case 'again':
      intervalDays = 0;
      delayMs = 10 * 60 * 1000;
      break;
    case 'hard':
      intervalDays = Math.max(1, current);
      break;
    case 'good':
      intervalDays = Math.max(1, current * 2 || 1);
      break;
    case 'easy':
      intervalDays = Math.max(3, current * 3 || 3);
      break;
    default:
      return null;
  }

  if (delayMs === undefined) delayMs = intervalDays * 24 * 60 * 60 * 1000;

  return { intervalDays, nextReviewAt: new Date(now.getTime() + delayMs) };
}
