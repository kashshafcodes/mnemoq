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

// Asks for the suggestions. On a good connection the answer streams in, so the
// hook can show before the questions are ready: `onPart` is called as each
// finished part arrives ({ type: 'hook', concept, hook } then
// { type: 'similar', similar }). Phones on weak or switching networks often
// cut a streamed reply short or never hand it over in pieces, so when the
// stream fails before anything arrived, the same request is sent once more as
// a plain request that returns everything at the end. Resolves with the final
// { remaining, missing } line.
const TIMEOUT_MS = 40000;

export async function requestSuggestions(card, onPart, signal) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) throw new AiError(MESSAGES.auth, 'auth');

  let delivered = false;
  const track = (part) => {
    delivered = true;
    onPart?.(part);
  };

  try {
    return await attempt(card, token, true, track, signal);
  } catch (error) {
    if (error?.name === 'AbortError' && signal?.aborted) throw error;

    // Real answers from the server (log in again, daily limit, busy...) are
    // final. Only a dropped connection, a timeout or a broken stream is retried.
    const retryable = error?.code === 'network' || error?.code === 'stream' || error?.name === 'AbortError';

    if (!retryable || delivered) {
      throw error?.name === 'AbortError'
        ? new AiError('The AI took too long. Try again.', 'failed')
        : error;
    }
  }

  return attempt(card, token, false, track, signal);
}

async function attempt({ question, answer, hook, wrong, subject, category }, token, stream, onPart, outerSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();

  outerSignal?.addEventListener?.('abort', onOuterAbort);

  try {
    let response;

    try {
      response = await fetch('/api/suggest', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, answer, hook, wrong, subject, category, stream }),
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new AiError('Could not reach the AI. Check your connection and try again.', 'network');
    }

    const type = response.headers.get('content-type') || '';
    const isStream = type.includes('ndjson');

    // Plain JSON: either an error found before any writing started (login,
    // daily limit, not set up), or, for the non-streaming request, the whole
    // answer in one piece. The site's own page comes back instead of JSON when
    // the function isn't deployed (for example with only `npm run dev`).
    if (!response.ok || !isStream) {
      const body = await response.json().catch(() => null);

      if (response.ok && body && (body.hook || (body.similar && body.similar.length))) {
        if (body.hook || body.concept) onPart?.({ type: 'hook', concept: body.concept || '', hook: body.hook || '' });
        if (body.similar?.length) onPart?.({ type: 'similar', similar: body.similar });

        return {
          remaining: body.remaining,
          missing: [body.hook ? null : 'hook', body.similar?.length ? null : 'similar'].filter(Boolean),
        };
      }

      if (!body) {
        // 404 means the function is not deployed; anything else (a gateway
        // timeout page, a proxy error) is a failed try, not a missing feature.
        throw response.status === 404
          ? new AiError(MESSAGES.config, 'config')
          : new AiError(MESSAGES.failed, 'stream');
      }

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

    try {
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
    } catch (error) {
      if (error instanceof AiError) throw error;
      // The connection dropped part-way through the reply.
      throw new AiError(MESSAGES.failed, 'stream');
    }

    if (!final) throw new AiError(MESSAGES.failed, 'stream');

    return final;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener?.('abort', onOuterAbort);
  }
}
