// The misses from the sample round (played on the landing page before signing
// up), waiting to become the new account's first review cards. Same pattern
// as guestResult.js: kept in this browser and, compactly, in the sign-up
// details, so they survive a confirmation link opened on another device.
// No Supabase import here, so the landing page stays light.

const KEY = 'mnemoq-sample-misses';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const FIELDS = ['subject', 'category', 'question', 'yourAnswer', 'correctAnswer', 'explanation'];

const clean = (card) => Object.fromEntries(FIELDS.map((key) => [key, String(card?.[key] || '').slice(0, 600)]));

export function saveSampleMisses(cards) {
  const entry = { cards: cards.slice(0, 3).map(clean), at: new Date().toISOString() };

  try {
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Private mode: the copy sent with sign-up still works.
  }

  return entry;
}

export function readSampleMisses() {
  try {
    const entry = JSON.parse(localStorage.getItem(KEY) || 'null');

    return entry && Array.isArray(entry.cards) && Date.now() - new Date(entry.at).getTime() < MAX_AGE_MS ? entry : null;
  } catch {
    return null;
  }
}

// Sent with sign-up (user metadata): at most three short cards.
export function sampleMetadata() {
  const entry = readSampleMisses();

  return entry && entry.cards.length > 0 ? { sample_misses: entry } : {};
}

// The cards waiting for this signed-in person, if any.
export function pendingSampleCards(user) {
  const entry = readSampleMisses() || user?.user_metadata?.sample_misses || null;

  return entry && Array.isArray(entry.cards) && entry.cards.length > 0 ? entry.cards.map(clean) : [];
}

export function clearSampleMisses() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Did this browser finish the sample round in the last 14 days (with or
// without misses)? Marks the sign-up event with from: 'sample'.
export function playedSample() {
  return readSampleMisses() !== null;
}
