// Which exam did this person come for? Guessed from the link they arrived by
// (/sat, /nsu, /brac, or ?exam= / utm_campaign= naming one), remembered on
// this device, and used to pre-select that exam when they choose a path.
// Only a default: the person can always pick another.

const KEY = 'mnemoq-entry-exam';
const EXAMS = ['sat', 'nsu', 'brac'];

export function guessExam({ pathname = '', search = '' } = {}) {
  const fromPath = /^\/(sat|nsu|brac)\/?$/i.exec(pathname);

  if (fromPath) return fromPath[1].toLowerCase();

  const params = new URLSearchParams(search);

  for (const name of ['exam', 'utm_campaign', 'utm_content', 'ref']) {
    const value = String(params.get(name) || '').toLowerCase();
    const found = EXAMS.find((exam) => new RegExp(`(^|[^a-z])${exam}([^a-z]|$)`).test(value));

    if (found) return found;
  }

  return null;
}

// Called once at start-up. A newer entry link replaces an older guess.
export function rememberEntryExam(location = typeof window !== 'undefined' ? window.location : {}) {
  const exam = guessExam(location);

  if (!exam) return null;

  try {
    localStorage.setItem(KEY, exam);
  } catch {
    // Private mode: no default, that is fine.
  }

  return exam;
}

export function entryExam() {
  try {
    const saved = localStorage.getItem(KEY);

    return EXAMS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}
