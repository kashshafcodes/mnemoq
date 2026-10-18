// Subjects and categories.
//
// The built-in subjects below always exist. People can also add their own
// subject or category. Those are not stored in a separate table: they are
// simply read from the person's own cards, so they follow the account to
// every device with no database change.

export const SUBJECTS = {
  English: ['Vocabulary', 'Grammar', 'Sentence structure'],
  Biology: [
    'Cell & molecular',
    'Genetics',
    'Human physiology',
    'Botany',
    'Zoology',
    'Other',
  ],
  'General Knowledge': [
    'History',
    'Geography',
    'Current affairs',
    'Science & technology',
    'Other',
  ],
};

export const SUBJECT_NAMES = Object.keys(SUBJECTS);
export const DEFAULT_SUBJECT = 'English';

// Category given to a brand-new custom subject until its owner adds more.
export const CUSTOM_DEFAULT_CATEGORY = 'General';

const MAX_NAME_LENGTH = 40;

// Tidy a name typed by a person: collapse spaces, trim, cap the length.
export function cleanName(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

// Case-insensitive comparison, so "chemistry" and "Chemistry" are one subject.
export function sameName(a, b) {
  return String(a ?? '').toLocaleLowerCase() === String(b ?? '').toLocaleLowerCase();
}

// "All" is used by the library filters, so it can't be a subject or category.
export function isReservedName(name) {
  return sameName(cleanName(name), 'All');
}

// Built-in subjects first, then any custom subjects found in the cards.
export function getSubjectNames(cards = []) {
  const names = [...SUBJECT_NAMES];

  for (const card of cards) {
    const subject = cleanName(card.subject);

    if (subject && !names.some((name) => sameName(name, subject))) {
      names.push(subject);
    }
  }

  return names;
}

// Categories for a subject: built-in ones, then custom ones found in the
// cards ("Other" stays last).
export function getCategories(subject, cards = []) {
  const builtIn = SUBJECT_NAMES.find((name) => sameName(name, subject));
  const list = builtIn ? [...SUBJECTS[builtIn]] : [];

  for (const card of cards) {
    if (!sameName(card.subject || DEFAULT_SUBJECT, subject)) continue;

    const category = cleanName(card.category);

    if (category && !list.some((name) => sameName(name, category))) {
      list.push(category);
    }
  }

  const otherIndex = list.findIndex((name) => sameName(name, 'Other'));

  if (otherIndex !== -1) list.push(list.splice(otherIndex, 1)[0]);
  if (list.length === 0) list.push(CUSTOM_DEFAULT_CATEGORY);

  return list;
}

// Reuse the spelling/capitalization that already exists, so typing
// "chemistry" when "Chemistry" exists doesn't create a second subject.
export function canonicalSubject(raw, cards = []) {
  const name = cleanName(raw);

  if (!name) return '';

  return getSubjectNames(cards).find((existing) => sameName(existing, name)) || name;
}

export function canonicalCategory(subject, raw, cards = []) {
  const name = cleanName(raw);

  if (!name) return '';

  return (
    getCategories(subject, cards).find((existing) => sameName(existing, name)) || name
  );
}

// ---- Looks: each subject gets its own accent color -------------------------
//
// The built-in colors avoid green, red and amber on purpose, because those
// already mean "correct", "wrong" and "almost" during review.

const SUBJECT_ACCENTS = {
  English: '#a78bfa', // violet
  Biology: '#fb923c', // orange
  'General Knowledge': '#38bdf8', // sky blue
};

const CUSTOM_ACCENTS = ['#f472b6', '#e879f9', '#818cf8', '#22d3ee', '#facc15', '#a8a29e'];

// Custom subjects get a color picked from their name, so the same subject
// always has the same color on every device.
export function subjectAccent(subject) {
  const name = cleanName(subject) || DEFAULT_SUBJECT;
  const builtIn = SUBJECT_NAMES.find((existing) => sameName(existing, name));

  if (builtIn) return SUBJECT_ACCENTS[builtIn];

  let hash = 0;

  for (const char of name.toLocaleLowerCase()) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }

  return CUSTOM_ACCENTS[hash % CUSTOM_ACCENTS.length];
}

// ---- Feels: subject-specific examples in the add-card boxes ----------------

const SUBJECT_HINTS = {
  English: {
    question: 'e.g. She ___ to school yesterday.',
    answer: 'e.g. went',
    hook: 'e.g. "went" is the past of "go". It skips the -ed rule.',
  },
  Biology: {
    question: "e.g. Which organelle makes most of the cell's ATP?",
    answer: 'e.g. Mitochondria',
    hook: "e.g. Mighty-chondria, the cell's power plant",
  },
  'General Knowledge': {
    question: 'e.g. What is the capital of Australia?',
    answer: 'e.g. Canberra',
    hook: 'e.g. Not Sydney! Canberra was a compromise between Sydney and Melbourne.',
  },
};

const GENERIC_HINTS = {
  question: 'What do you want to remember?',
  answer: 'What is the correct answer?',
  hook: 'A mnemonic, picture, or short reason that helps it stick',
};

export function subjectHints(subject) {
  const builtIn = SUBJECT_NAMES.find((name) => sameName(name, subject));

  return builtIn ? SUBJECT_HINTS[builtIn] : GENERIC_HINTS;
}
