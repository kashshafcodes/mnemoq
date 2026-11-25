// Guest mode: anyone who opens the main link goes straight into the real app,
// with no sign-up. Under the hood this is a Supabase anonymous account, so
// every feature that saves to the database (cards, reviews, paths, streaks)
// works exactly as for a signed-up person, and keeps working after they save
// their progress: adding an email turns the same account into a normal one,
// with the same id and all of its data.
//
// What guests cannot do (checked on the server too, api/_guestGate.js):
// AI features, payments and referral rewards. Those need a saved account.
//
// Needs "Allow anonymous sign-ins" switched on in Supabase (Authentication >
// Sign In / Providers). While it is off, startGuest fails quietly and visitors
// see the landing page as before.

import { supabase } from '../supabaseClient';
import { trafficSource, track } from '../track';

// Set when someone chooses to log out or log in to an existing account, so we
// do not drop them straight back into a fresh guest account.
const OFF_KEY = 'mnemoq-guest-off';

export const isGuest = (user) => Boolean(user?.is_anonymous);

// A guest who added an email still needs a password to log in elsewhere.
export const needsPassword = (user) => Boolean(user && !user.is_anonymous && user.user_metadata?.needs_password);

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Blocked storage: worst case we start a guest account again.
  }
}

// Only the plain app link starts a guest. The free checks (/sat, /nsu, /brac)
// and the /sample round keep their own signed-out flow.
export function shouldAutoGuest() {
  if (read(OFF_KEY)) return false;

  const path = window.location.pathname.replace(/\/+$/, '');

  return path === '' || path === '/index.html';
}

export const guestLeaveText = (lang) =>
  lang === 'bn'
    ? 'অতিথি মোড থেকে বের হবেন? সংরক্ষণ না করলে এই অগ্রগতি হারিয়ে যাবে।'
    : 'Leave guest mode? Your progress here will be lost unless you save it first.';

export const guestOff = () => write(OFF_KEY, '1');
export const guestOn = () => write(OFF_KEY, null);

// -> { session } or { error }
export async function startGuest(where = 'auto') {
  if (typeof supabase.auth.signInAnonymously !== 'function') return { error: 'unsupported' };

  const src = trafficSource();
  const { data, error } = await supabase.auth
    .signInAnonymously({ options: { data: { source: src.source, campaign: src.campaign || null, guest: true } } })
    .catch((e) => ({ data: null, error: e }));

  if (error || !data?.session) return { error: error?.message || 'no session' };

  track('guest_start', { where });
  return { session: data.session };
}

// Save progress, step 1: attach an email to the guest account. Supabase sends
// a confirmation link; once opened, the account is a normal one (same id).
export async function saveWithEmail(email) {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim(), data: { needs_password: true } },
    { emailRedirectTo: `${window.location.origin}/` }
  );

  if (!error) {
    track('guest_save', { step: 'email' });
    return { ok: true };
  }

  const text = /already|registered|exists/i.test(error.message || '')
    ? 'That email already has a Mnemoq account. Log in to it instead (this guest progress stays here and will not move over).'
    : /rate limit|too many/i.test(error.message || '')
      ? 'Too many tries. Please wait a minute and try again.'
      : error.message || 'Something went wrong. Please try again.';

  return { error: text };
}

// Save progress, step 2 (after the email is confirmed): choose a password.
export async function choosePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password, data: { needs_password: null } });

  if (error) return { error: error.message || 'Could not save the password. Please try again.' };

  track('guest_save', { step: 'password' });
  return { user: data?.user || null };
}
