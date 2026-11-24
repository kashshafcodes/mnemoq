// Mnemoq service worker.
//  1. Shows review reminders sent by the server (Web Push) and opens the app
//     when one is tapped (unchanged from before caching was added).
//  2. Makes the app open offline: the app shell is stored on install, Vite's
//     hashed /assets/* and Google Fonts are served stale-while-revalidate, and
//     page loads try the network first and fall back to the stored page.
//     Never cached: /api/*, Supabase, analytics, and anything that is not GET
//     (the rule is cacheRule() below, tested in tests/install.test.js).

var VERSION = 'v1';
var SHELL_CACHE = 'mnemoq-shell-' + VERSION;
var RUNTIME_CACHE = 'mnemoq-runtime-v1'; // also written by src/install/runtime.js
var KEEP = [SHELL_CACHE, RUNTIME_CACHE];
var RUNTIME_MAX = 160;
var NAV_TIMEOUT_MS = 4000;
var SHELL = ['/', '/index.html', '/daily', '/manifest.webmanifest', '/favicon.png', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

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

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(function (cache) {
        // One missing file must not stop the worker from installing.
        return Promise.all(
          SHELL.map(function (path) {
            return cache.add(new Request(path, { cache: 'reload' })).catch(function () {});
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return key.indexOf('mnemoq-') === 0 && KEEP.indexOf(key) === -1 ? caches.delete(key) : null;
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function cacheable(response) {
  return response && (response.ok || response.type === 'opaque');
}

// Keep the runtime cache from growing forever as new builds add new hashes.
function trim(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - RUNTIME_MAX;
    return extra > 0 ? Promise.all(keys.slice(0, extra).map(function (k) { return cache.delete(k); })) : null;
  });
}

function staleWhileRevalidate(event) {
  return caches.open(RUNTIME_CACHE).then(function (cache) {
    // Look in every Mnemoq cache: the shell holds the manifest and icons.
    return caches.match(event.request, { ignoreVary: true }).then(function (hit) {
      var refresh = fetch(event.request)
        .then(function (response) {
          if (cacheable(response)) {
            event.waitUntil(cache.put(event.request, response.clone()).then(function () { return trim(cache); }));
          }
          return response;
        })
        .catch(function () {
          return hit || Response.error();
        });

      if (hit) {
        event.waitUntil(refresh.catch(function () {}));
        return hit;
      }

      return refresh;
    });
  });
}

function fromShell() {
  return caches.open(SHELL_CACHE).then(function (cache) {
    return cache.match('/index.html').then(function (page) {
      return page || cache.match('/');
    });
  });
}

// Network first (with a time limit, for slow connections), then the stored page.
function page(event) {
  var network = fetch(event.request).then(function (response) {
    if (response && response.ok && response.type === 'basic') {
      var copy = response.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then(function (cache) { return cache.put('/index.html', copy); }));
    }
    return response;
  });

  var timeout = new Promise(function (resolve) {
    setTimeout(function () {
      fromShell().then(function (cached) { if (cached) resolve(cached); });
    }, NAV_TIMEOUT_MS);
  });

  return Promise.race([
    network.catch(function () {
      return fromShell().then(function (cached) { return cached || Response.error(); });
    }),
    timeout,
  ]);
}

self.addEventListener('fetch', function (event) {
  var rule = cacheRule(event.request, self.location.origin);

  if (rule === 'swr') event.respondWith(staleWhileRevalidate(event));
  else if (rule === 'page') event.respondWith(page(event));
  // 'none': the browser handles it as if there were no service worker.
});

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Mnemoq';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || 'mnemoq',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/#/review' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url || '/#/review', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => ('navigate' in client ? client.navigate(target) : undefined));
        }
      }

      return self.clients.openWindow(target);
    })
  );
});
