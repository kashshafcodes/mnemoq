import { track } from '../track';

// Client error reporting: uncaught errors, unhandled promise rejections and
// crashes caught by PageErrorBoundary become one `client_error` event each
// (site_events; counted on the Stats page). Messages are trimmed and scrubbed
// of emails, long numbers and URLs, and at most MAX_PER_LOAD are sent per page
// load, so a crash loop cannot flood the table.

export const MAX_PER_LOAD = 5;
let sent = 0;
const seen = new Set();

// Pure: what we keep of an error message.
export function cleanMessage(value) {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : value?.message || String(value ?? '');

  return raw
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/\d{4,}/g, '[n]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// Chrome's harmless ResizeObserver note and errors from browser extensions or
// other sites' scripts say nothing about Mnemoq.
export function ignorable(message, source = '') {
  if (/ResizeObserver loop/i.test(message)) return true;
  if (/^Script error\.?$/i.test(message)) return true;
  if (/^(chrome|moz|safari)-extension:/i.test(source)) return true;

  return false;
}

export function reportError(error, kind = 'error', extra = {}) {
  if (sent >= MAX_PER_LOAD) return;

  const message = cleanMessage(error);

  if (!message || ignorable(message, extra.source)) return;

  const key = `${kind}:${message}`;

  if (seen.has(key)) return;

  seen.add(key);
  sent += 1;

  const props = { kind, message };

  if (extra.page) props.page = extra.page;
  if (extra.where) props.where = String(extra.where).slice(0, 60);

  track('client_error', props);
}

let started = false;

export function startErrorReporting() {
  if (started || typeof window === 'undefined') return;

  started = true;

  window.addEventListener('error', (event) => {
    // Failed <img>/<script> loads also fire 'error' without a message.
    if (!event.message && !event.error) return;
    reportError(event.error || event.message, 'error', { source: event.filename || '' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'rejection');
  });
}

// For tests.
export function resetErrorReporting() {
  sent = 0;
  seen.clear();
}
