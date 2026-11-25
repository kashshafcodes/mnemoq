import { ALIASES } from './routes';

// The "this page moved" notice (src/nav/MovedToast.jsx), once per old name per
// browser. The redirect can happen before the toast is on screen (first load
// on an old link), so the notice waits here until the toast takes it.

export const MOVED_EVENT = 'mnemoq:moved';
const SEEN_KEY = 'mnemoq-moved-seen';

let waiting = null;

function readSeen(store) {
  try {
    const list = JSON.parse(store?.getItem(SEEN_KEY) || '[]');

    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Pure: should this redirect show the notice? Only real old names (not a typo
// sent to Today, not a case change), and only the first time for each.
export function shouldNoticeMove(from, seen = []) {
  const name = String(from || '').split('/')[0];

  return Boolean(ALIASES[name]) && !seen.includes(name);
}

export function noteMoved({ from, to }, store = typeof localStorage === 'undefined' ? null : localStorage) {
  const seen = readSeen(store);

  if (!shouldNoticeMove(from, seen)) return false;

  try {
    store?.setItem(SEEN_KEY, JSON.stringify([...seen, String(from).split('/')[0]]));
  } catch {
    // Storage blocked: the notice may show again next time, which is harmless.
  }

  waiting = to;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MOVED_EVENT));

  return true;
}

export function takeMoved() {
  const to = waiting;

  waiting = null;

  return to;
}
