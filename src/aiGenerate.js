import { supabase } from './supabaseClient';
import { AiError } from './aiSuggest';

// Asks the server (api/generate.js) for a starter set on one topic.
// Throws an AiError whose message is safe to show to the person.
export async function requestStarterSet({ subject, topic, notes, count, language, categories }, signal) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) throw new AiError('Please log in again to use the AI.', 'auth');

  let response;

  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject, topic, notes, count, language, categories }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new AiError('Could not reach the AI. Check your connection and try again.', 'network');
  }

  const body = await response.json().catch(() => null);

  if (!body) throw new AiError('AI suggestions are not available yet.', 'config');

  if (!response.ok) throw new AiError(body.error || 'The AI could not write that set. Try again.', body.code || 'failed');

  return body;
}
