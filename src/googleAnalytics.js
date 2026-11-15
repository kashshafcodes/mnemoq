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
