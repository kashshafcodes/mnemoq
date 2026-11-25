// Today's round record, kept on this device only (no database table):
// localStorage `mnemoq-round-YYYY-MM-DD` (the Dhaka day). Written the first
// time the round opens that day; records older than 7 days are pruned.

const PREFIX = 'mnemoq-round-';
const KEEP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const roundKey = (date) => `${PREFIX}${date}`;

export function loadRound(date, user, store = storage()) {
  try {
    const saved = JSON.parse(store?.getItem(roundKey(date)) || 'null');

    // Another account used this device today: its round is not yours.
    if (!saved || !Array.isArray(saved.steps) || (saved.user && user && saved.user !== user)) return null;

    return { skipped: [], lit: [], ...saved, date };
  } catch {
    return null;
  }
}

export function saveRound(record, store = storage()) {
  try {
    store?.setItem(roundKey(record.date), JSON.stringify(record));
  } catch {
    // Storage full or blocked: the round still works for this visit.
  }

  return record;
}

// Removes records more than a week older than `date`.
export function pruneRounds(date, store = storage()) {
  if (!store) return;

  const limit = Date.parse(date) - KEEP_DAYS * DAY_MS;

  try {
    for (let i = store.length - 1; i >= 0; i -= 1) {
      const key = store.key(i);

      if (key?.startsWith(PREFIX) && Date.parse(key.slice(PREFIX.length)) < limit) store.removeItem(key);
    }
  } catch {
    // ignore
  }
}
