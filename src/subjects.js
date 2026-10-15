// Subjects and their categories. Add a new subject here and it shows up
// everywhere (form and filters) with no other code changes.
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

// Match a subject name ignoring case/extra spaces; falls back to `fallback`.
export function normalizeSubject(raw, fallback = DEFAULT_SUBJECT) {
  const wanted = String(raw || '').trim().toLowerCase();
  return SUBJECT_NAMES.find((name) => name.toLowerCase() === wanted) || fallback;
}

// Match a category inside a subject; falls back to "Other" if the subject has
// one, otherwise to the subject's first category.
export function normalizeCategory(subject, raw) {
  const list = SUBJECTS[subject] || SUBJECTS[DEFAULT_SUBJECT];
  const wanted = String(raw || '').trim().toLowerCase();
  const match = list.find((name) => name.toLowerCase() === wanted);
  if (match) return match;
  return list.includes('Other') ? 'Other' : list[0];
}
