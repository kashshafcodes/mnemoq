// Google Analytics 4. Kept in its own file so the Content-Security-Policy in
// vercel.json can forbid inline scripts. Events: ANALYTICS_EVENTS.md.
window.dataLayer = window.dataLayer || [];
window.gtag = function gtag() {
  window.dataLayer.push(arguments);
};
window.gtag('js', new Date());
window.gtag('config', 'G-ZC0907DDRK', { anonymize_ip: true });
