// Lightweight GA4 event helper. The gtag.js snippet is initialized in index.html.
// Keep event parameters anonymous: never send emails, names, or question content.
export function trackEvent(eventName, parameters = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, parameters);
  }
}
