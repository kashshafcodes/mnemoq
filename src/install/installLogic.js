// When to offer "add Mnemoq to your home screen". Pure functions plus a tiny
// device-local store, so the timing rules are easy to test
// (tests/install.test.js).
//
// Rules:
//  - never when Mnemoq already runs as an installed app;
//  - never on someone's first visit;
//  - only right after a finished review session or Daily round;
//  - after "Not now", wait DISMISS_DAYS before asking again;
//  - once installed (or accepted), never again.

export const DISMISS_DAYS = 14; // Marketing asks 14; the board's floor is 7.
const DAY_MS = 24 * 60 * 60 * 1000;
const STORE_KEY = 'mnemoq-install';
const VISIT_FLAG = 'mnemoq-install-visit';

// 'ios-safari' (needs the Share → Add to Home Screen guide), 'ios-other'
// (Chrome/Firefox on iPhone: point them to Safari), or 'other' (Android and
// desktop Chromium use the browser's own install prompt when it fires).
export function detectPlatform(userAgent = '', maxTouchPoints = 0) {
  const ua = String(userAgent);
  const iPadOS = /Macintosh/.test(ua) && maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;

  if (!ios) return 'other';
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(ua)) return 'ios-other';

  return 'ios-safari';
}

export function isStandalone(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;

  try {
    if (win.navigator?.standalone === true) return true;

    return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.matchMedia?.('(display-mode: minimal-ui)').matches);
  } catch {
    return false;
  }
}

// Decide whether to show the card now.
//   state: { visits, dismissedAt, installed }
//   ctx:   { standalone, platform, canPrompt, now }
// -> 'android' | 'ios' | null
export function installOffer(state = {}, ctx = {}) {
  const now = ctx.now ?? Date.now();

  if (ctx.standalone || state.installed) return null;
  if ((state.visits || 0) < 2) return null;
  if (state.dismissedAt && now - state.dismissedAt < DISMISS_DAYS * DAY_MS) return null;
  if (ctx.canPrompt) return 'android';
  if (ctx.platform === 'ios-safari') return 'ios';

  return null;
}

// ── Device-local state (every access guarded: storage can be blocked) ──
export function loadInstallState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null') || { visits: 0 };
  } catch {
    return { visits: 0 };
  }
}

export function saveInstallState(next) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  return next;
}

export function updateInstallState(patch) {
  return saveInstallState({ ...loadInstallState(), ...patch });
}

// Counts a visit once per browser session (a tab that stays open is one visit).
export function countVisit() {
  try {
    if (window.sessionStorage.getItem(VISIT_FLAG)) return loadInstallState();
    window.sessionStorage.setItem(VISIT_FLAG, '1');
  } catch {
    // Without sessionStorage every page load counts; still never the very first.
  }

  const state = loadInstallState();

  return saveInstallState({ ...state, visits: (state.visits || 0) + 1 });
}
