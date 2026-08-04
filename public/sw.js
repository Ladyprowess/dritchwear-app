const CACHE_VERSION = 'dritchwear-v9';
const APP_SHELL = ['/', '/manifest.json', '/admin-manifest.json', '/favicon.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ── App shell (navigations): NETWORK-FIRST ────────────────────────────────
  // A cold launch must always receive the CURRENT index.html so it references
  // the JS bundle hashes that are actually deployed. Serving a stale cached
  // shell was pointing the app at an evicted/renamed chunk -> blank white
  // screen on first open, which "fixed itself" only after a second launch.
  // We still fall back to the cached shell when the device is offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        // Cap the wait so a hung radio on cold-launch can't hold a white screen;
        // if the network is slow we serve the cached shell instead.
        const fresh = await Promise.race([
          fetch(request),
          new Promise((_, reject) => setTimeout(() => reject(new Error('shell-timeout')), 3500)),
        ]);
        if (fresh && fresh.ok) cache.put('/', fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match('/');
        if (cached) return cached;
        // Last resort: one more direct network attempt.
        return fetch(request).catch(() => Response.error());
      }
    })());
    return;
  }

  // ── Hashed static assets: cache-first (immutable), then network + populate ─
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
        return response;
      })
    )
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Dritchwear', body: event.data?.text() || 'You have a new notification.' };
  }

  const title = payload.title || 'Dritchwear';
  const options = {
    body: payload.body || payload.message || 'You have a new notification.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || payload.type || 'dritchwear-notification',
    data: {
      url: payload.url || payload.data?.url || '/',
      type: payload.type || payload.data?.type || 'system',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
