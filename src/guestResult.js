import { supabase } from './supabaseClient';

// A diagnostic taken before signing up (TryDiagnostic.jsx), waiting to be
// saved to the new account. Kept in two places:
//   - this browser (the full result), and
//   - the account's sign-up details (a compact copy), so the score is not lost
//     when the confirmation link is opened on another device or browser.

const KEY = 'mnemoq-guest-result';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Drops passages, options and explanations: enough for scores and the skill map.
export function compactResult(result) {
  return {
    ...result,
    sections: (result.sections || []).map((section) => ({
      ...section,
      missed: (section.missed || []).map((m) => ({ id: m.id, skill: m.skill, topic: m.topic, level: m.level, correct: m.correct, picked: m.picked })),
    })),
  };
}

export function saveGuestResult(exam, result) {
  const entry = { exam, result, at: new Date().toISOString() };

  try {
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Private mode: the compact copy on the account still works.
  }

  return entry;
}

export function readLocalGuestResult() {
  try {
    const entry = JSON.parse(localStorage.getItem(KEY) || 'null');

    return entry && Date.now() - new Date(entry.at).getTime() < MAX_AGE_MS ? entry : null;
  } catch {
    return null;
  }
}

// The compact copy to send with sign-up (user metadata).
export function guestMetadata() {
  const entry = readLocalGuestResult();

  if (!entry) return {};

  const compact = { exam: entry.exam, at: entry.at, result: compactResult(entry.result) };

  return JSON.stringify(compact).length < 16000 ? { guest_result: compact } : { guest_exam: entry.exam };
}

// The waiting result for this signed-in person, if any.
export function pendingGuestResult(user) {
  return readLocalGuestResult() || user?.user_metadata?.guest_result || null;
}

export async function clearGuestResult(user) {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }

  if (user?.user_metadata?.guest_result) {
    await supabase.auth.updateUser({ data: { guest_result: null } }).catch(() => {});
  }
}
