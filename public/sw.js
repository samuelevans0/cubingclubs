// v3: the service worker must ONLY ever touch our own same-origin static assets.
//
// The real, long-standing "clubs never load" bug: once the worker was
// installed, it proxied EVERY subresource through its own fetch() — including
// the cross-origin Leaflet map library from cdnjs. A service-worker fetch() is
// governed by the page CSP's connect-src, which does not list cdnjs, so that
// fetch was blocked (net::ERR_FAILED). Leaflet never loaded, `L` was undefined,
// loadClubs() threw at L.marker(), and the list stayed stuck on skeletons —
// but only from the SECOND visit on (the first visit has no controlling worker,
// so the browser loads Leaflet directly). Hard reload / unregister "fixed" it
// only by bypassing the worker.
//
// Cross-origin requests (Leaflet, Google Fonts, CF beacon) are now passed
// straight through so the browser loads them directly under script-src /
// style-src / font-src, which DO allow them.
//
// (v2 also stopped caching the HTML shell so navigations always come fresh from
// the network; that's kept.)
const CACHE = 'cubingclubs-v3';

self.addEventListener('install', () => {
  // Nothing to precache — the page shell must always come fresh from the
  // network. Take over as soon as possible.
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Cross-origin requests (Leaflet/cdnjs, Google Fonts, CF beacon): never proxy
  // them. A worker fetch() is subject to the page CSP's connect-src, which does
  // not allow those hosts, so proxying gets them blocked. Let the browser load
  // them directly under script-src/style-src/font-src instead. This is THE fix
  // for the stuck-skeletons bug.
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) return;

  // HTML documents: stay out of the way entirely so every navigation comes
  // fresh from the network and no one is pinned to an old page shell.
  if (req.mode === 'navigate') return;

  // Our own static assets (JS, CSS, images, fonts): cache-first for speed,
  // refreshed in the background when the network has a newer copy.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('push', e => {
  let data = { title: 'CubingClubs.net', body: 'New club submission received.' };
  if (e.data) {
    try { Object.assign(data, JSON.parse(e.data.text())); } catch {}
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'club-submission',
      renotify: true,
      data: { url: data.url || '/admin' }
    }).then(() => {
      if ('setAppBadge' in self.navigator) {
        return self.navigator.setAppBadge(1);
      }
    })
  );
});

self.addEventListener('notificationclose', e => {
  if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge();
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge();
  const url = (e.notification.data && e.notification.data.url) || '/admin';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
