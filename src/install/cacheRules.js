// What the service worker may cache. public/sw.js carries an exact copy of
// cacheRule() between the "cache-rules" markers (a service worker cannot
// import from src/), and tests/install.test.js checks the two copies match and
// behave the same.
//
//   'swr'      stale-while-revalidate: Vite's hashed /assets/*, Google Fonts,
//              and the static icons and manifest
//   'page'     navigation: network first, cached index.html when offline
//   'none'     never touch: /api/*, Supabase, analytics, non-GET, anything else

// <cache-rules>
function cacheRule(req, origin) {
  var method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET') return 'none';

  var url;
  try {
    url = new URL(req.url, origin);
  } catch (e) {
    return 'none';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'none';

  var host = url.hostname;
  if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') return 'swr';
  if (url.origin !== origin) return 'none';

  var path = url.pathname;
  if (path.indexOf('/api/') === 0 || path === '/api') return 'none';
  if (path === '/sw.js' || path === '/ga.js') return 'none';
  if (req.mode === 'navigate') return 'page';
  if (path.indexOf('/assets/') === 0) return 'swr';
  if (/^\/(manifest\.webmanifest|favicon\.png|apple-touch-icon\.png|icon-[a-z0-9-]+\.png|mnemoq-(logo|mark)\.png|icons\.svg)$/.test(path)) return 'swr';

  return 'none';
}
// </cache-rules>

export { cacheRule };
