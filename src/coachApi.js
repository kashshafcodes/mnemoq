import { supabase } from './supabaseClient';

// Talks to the AI coach on the server (api/coach.js).
// Throws a CoachError whose message is safe to show to the person.

export class CoachError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const MESSAGES = {
  auth: 'Please log in again to use the AI coach.',
  limit: 'You have used your AI coach for today. It comes back within 24 hours.',
  busy: 'The AI coach is busy right now. Try again in a minute.',
  failed: 'The AI coach could not finish that this time. Try again.',
  config: 'The AI coach is not available yet. If the site was just updated, try again in a minute.',
};

const TIMEOUT_MS = 58000;

export async function coachRequest(body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) throw new CoachError(MESSAGES.auth, 'auth');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response;

    try {
      response = await fetch('/api/coach', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new CoachError('The AI coach took too long. Try again.', 'timeout');
      throw new CoachError('Could not reach the AI coach. Check your connection and try again.', 'network');
    }

    const json = await response.json().catch(() => null);

    // The site's own page (or a gateway error page) comes back instead of JSON
    // when the function is not deployed.
    if (!json) throw new CoachError(response.status >= 500 ? MESSAGES.failed : MESSAGES.config, 'config');

    if (!response.ok) throw new CoachError(json.error || MESSAGES[json.code] || MESSAGES.failed, json.code || 'failed');

    return json;
  } finally {
    clearTimeout(timer);
  }
}

export const requestDiagnostic = (path = 'nsu') => coachRequest({ action: 'diagnostic', path });
export const requestEssayGrade = (prompt, essay) => coachRequest({ action: 'grade_essay', prompt, essay });
export const requestAnalysis = (payload) => coachRequest(payload);
export const requestMock = (sections, path = 'nsu') => coachRequest({ action: 'mock', path, sections });
export const requestImport = (section, text) => coachRequest({ action: 'import_questions', section, text });
