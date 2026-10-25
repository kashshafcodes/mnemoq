import { supabase } from './supabaseClient';

// Asks the server (api/suggest.js) for AI help with one card.
// Throws an AiError whose message is safe to show to the person.

export class AiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const MESSAGES = {
  auth: 'Please log in again to use AI suggestions.',
  limit: 'You have used your AI suggestions for today. They come back within 24 hours.',
  busy: 'The AI is busy right now. Try again in a minute.',
  failed: 'The AI could not make a good suggestion this time. Try again.',
  config: 'AI suggestions are not available yet.',
  input: 'Add a question and its correct answer first.',
};

export async function requestSuggestions({ question, answer, hook, subject, category }, signal) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) throw new AiError(MESSAGES.auth, 'auth');

  let response;

  try {
    response = await fetch('/api/suggest', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question, answer, hook, subject, category }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new AiError('Could not reach the AI. Check your connection and try again.', 'network');
  }

  // The site's own page comes back instead of JSON when the function isn't
  // deployed (for example when running only `npm run dev`).
  const body = await response.json().catch(() => null);

  if (!body) throw new AiError(MESSAGES.config, 'config');

  if (!response.ok) {
    throw new AiError(body.error || MESSAGES[body.code] || MESSAGES.failed, body.code || 'failed');
  }

  return body;
}
