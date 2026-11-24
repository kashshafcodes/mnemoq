// App-wide plumbing for the installable, offline-ready app. Started once from
// main.jsx (startAppShell), before React renders:
//  - keeps the browser's install prompt (beforeinstallprompt) for later;
//  - registers the service worker for everyone (production builds only);
//  - stores today's Daily for offline play once the page has settled.
// Screens report a finished round with noteRoundDone(), which is the moment
// the install card may appear (InstallPrompt.jsx).

import { updateInstallState } from './installLogic';

export const RUNTIME_CACHE = 'mnemoq-runtime-v1'; // must match public/sw.js
const DAILY_READY_KEY = 'mnemoq-daily-offline';
const ROUND_EVENT = 'mnemoq:round-done';
const PROMPT_EVENT = 'mnemoq:install-ready';

let deferredPrompt = null;

export const getDeferredPrompt = () => deferredPrompt;
export const clearDeferredPrompt = () => {
  deferredPrompt = null;
};

export function noteRoundDone(kind) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(ROUND_EVENT, { detail: { kind } }));
}

export function onRoundDone(handler) {
  window.addEventListener(ROUND_EVENT, handler);

  return () => window.removeEventListener(ROUND_EVENT, handler);
}

export function onInstallReady(handler) {
  window.addEventListener(PROMPT_EVENT, handler);

  return () => window.removeEventListener(PROMPT_EVENT, handler);
}

export function dailyReadyOffline() {
  try {
    return window.localStorage.getItem(DAILY_READY_KEY) === '1';
  } catch {
    return false;
  }
}

// Copies the files this page has already loaded (all hashed /assets/*, so
// they never change) into the service worker's runtime cache, after loading
// the Daily's code. Then today's Daily opens offline, whichever page was
// opened first.
async function storeDailyForOffline() {
  if (!('caches' in window)) return;

  try {
    await import('../daily/Daily.jsx');

    const urls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.startsWith(`${window.location.origin}/assets/`));
    const cache = await caches.open(RUNTIME_CACHE);
    const missing = [];

    for (const url of new Set(urls)) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await cache.match(url))) missing.push(url);
    }

    await cache.addAll(missing);
    window.localStorage.setItem(DAILY_READY_KEY, '1');
  } catch {
    // Storage full or blocked: the app still works online.
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('/sw.js')
    .then(() => {
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));

      idle(() => storeDailyForOffline(), { timeout: 8000 });
    })
    .catch(() => {});
}

let started = false;

export function startAppShell() {
  if (started || typeof window === 'undefined') return;

  started = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.dispatchEvent(new Event(PROMPT_EVENT));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateInstallState({ installed: true });
  });

  // In development a service worker would fight Vite's hot reload.
  if (import.meta.env.PROD) {
    if (document.readyState === 'complete') registerServiceWorker();
    else window.addEventListener('load', registerServiceWorker, { once: true });
  }
}
