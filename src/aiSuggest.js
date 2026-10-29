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

// Streams the answer: `onPart` is called as each finished part arrives
// ({ type: 'hook', concept, hook } then { type: 'similar', similar }), so the
// hook can show before the questions are ready. Resolves with the final
// { remaining, missing } line.
export async function requestSuggestions({ question, answer, hook, wrong, subject, category }, onPart, signal) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) throw new AiError(MESSAGES.auth, 'auth');

  let response;

  try {
    response = await fetch('/api/suggest', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question, answer, hook, wrong, subject, category, stream: true }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new AiError('Could not reach the AI. Check your connection and try again.', 'network');
  }

  const type = response.headers.get('content-type') || '';

  // Errors found before any writing starts (login, daily limit, not set up)
  // come back as ordinary JSON. The site's own page comes back instead of JSON
  // when the function isn't deployed (for example with only `npm run dev`).
  if (!response.ok || !type.includes('ndjson')) {
    const body = await response.json().catch(() => null);

    if (!body) throw new AiError(MESSAGES.config, 'config');

    throw new AiError(body.error || MESSAGES[body.code] || MESSAGES.failed, body.code || 'failed');
  }

  let final = null;

  function handle(line) {
    if (!line.trim()) return;

    let message;

    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.type === 'error') {
      throw new AiError(message.error || MESSAGES[message.code] || MESSAGES.failed, message.code || 'failed');
    }

    if (message.type === 'done') final = message;
    else onPart?.(message);
  }

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const pieces = buffer.split('\n');

      buffer = pieces.pop();
      pieces.forEach(handle);
    }

    handle(buffer + decoder.decode());
  } else {
    (await response.text()).split('\n').forEach(handle);
  }

  if (!final) throw new AiError(MESSAGES.failed, 'failed');

  return final;
}
