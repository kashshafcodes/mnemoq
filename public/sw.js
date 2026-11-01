// Mnemoq service worker: shows review reminders sent by the server (Web Push)
// and opens the app when one is tapped. It does not cache anything.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
