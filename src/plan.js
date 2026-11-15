import { supabase } from './supabaseClient';

// Mnemoq Pro on the client: is this person Pro, until when, and redeeming an
// access code (supabase/stage5.sql).
//
// The server is the authority. This file only reads the person's own plan row
// and asks the server for Pro content; a free account cannot get Pro
// questions or Pro AI features by editing anything in the browser.

const DAY_MS = 24 * 60 * 60 * 1000;

export const FREE_PLAN = { pro: false, proUntil: null, daysLeft: null, setup: false };

function missingTable(error) {
  return Boolean(
    error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' || /does not exist|schema cache/i.test(error.message || ''))
  );
}

export function describePlan(proUntil, now = new Date()) {
  const until = proUntil ? new Date(proUntil) : null;
  const active = Boolean(until && until.getTime() > now.getTime());

  return {
    pro: active,
    proUntil: active ? until : null,
    daysLeft: active ? Math.max(1, Math.ceil((until.getTime() - now.getTime()) / DAY_MS)) : null,
  };
}

// -> { pro, proUntil, daysLeft, setup }. `setup` is true when stage5.sql has not been run.
export async function loadPlan(userId) {
  const { data, error } = await supabase.from('user_plans').select('pro_until').eq('user_id', userId).maybeSingle();

  if (error) return { ...FREE_PLAN, setup: missingTable(error) };

  return { ...describePlan(data?.pro_until), setup: false };
}

const REDEEM_MESSAGES = {
  invalid: 'That code was not recognised. Check it and try again.',
  used: 'That code has already been used.',
  slow_down: 'Too many attempts. Please wait an hour and try again.',
  auth: 'Please log in again.',
};

// -> { plan, days } | { error }
export async function redeemCode(code) {
  const cleaned = String(code || '').trim();

  if (cleaned.replace(/[^a-z0-9]/gi, '').length < 8) return { error: 'Enter the full code you were given.' };

  const { data, error } = await supabase.rpc('redeem_pro_code', { p_code: cleaned });

  if (error) {
    return { error: missingTable(error) ? 'Mnemoq Pro is not switched on yet. Please try again later.' : 'The code could not be checked. Try again.' };
  }

  if (!data?.ok) return { error: REDEEM_MESSAGES[data?.reason] || 'That code could not be used.' };

  return { plan: { ...describePlan(data.pro_until), setup: false }, days: data.days };
}

// Asks the server for the Pro SAT questions.
// -> { pro: true, questions } | { pro: false } | { unavailable: true }
export async function fetchProBank() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { pro: false };

  try {
    const response = await fetch('/api/sat-bank', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => null);

    // The site's own page comes back instead of JSON when the function is not
    // deployed (for example on a plain development server).
    if (!body) return { unavailable: true };
    if (!response.ok) return { pro: false };

    return body.pro && Array.isArray(body.questions) ? { pro: true, questions: body.questions } : { pro: false };
  } catch {
    return { unavailable: true };
  }
}

// Reports a bKash / Nagad payment (api/pay.js).
// -> { status: 'granted', plan, days } | { status: 'waiting' } | { status, error }
export async function claimPayment(trxId, last4) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { status: 'auth', error: 'Please log in again.' };

  try {
    const response = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trxId, last4 }),
    });
    const body = await response.json().catch(() => null);

    if (!body) return { status: 'failed', error: 'Payments are not available yet. Try again in a minute.' };
    if (body.status === 'granted') return { status: 'granted', days: body.days, plan: { ...describePlan(body.proUntil), setup: false } };

    return { status: body.status || 'failed', error: body.error || 'Could not check the payment.' };
  } catch {
    return { status: 'failed', error: 'Could not reach the server. Check your connection.' };
  }
}
