import { track } from './track';

// Sends an event to both GA4 (gtag in index.html) and Mnemoq's own tracking
// (src/track.js, shown on the Stats page). Keep parameters anonymous: never
// send emails, names, or question content.
export function trackEvent(eventName, parameters = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, parameters);
  }

  track(eventName, parameters);
}

// GA4 loads after the app is usable: the queue (window.gtag) exists at once,
// so early events are kept, but the ~180 kB gtag script waits until the page
// has loaded and the browser is idle. Mnemoq's own tracking does not wait.
const GA_ID = 'G-ZC0907DDRK';

export function startGoogleAnalytics() {
  if (typeof window === 'undefined' || window.gtag) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true });

  const inject = () => {
    const script = document.createElement('script');

    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  };
  const whenIdle = () => setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(inject, { timeout: 4000 }) : inject()), 1500);

  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}
