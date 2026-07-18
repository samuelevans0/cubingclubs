// v2: stop caching the HTML shell. v1 precached '/' and ran its network-first
// handler on navigations, so a back/forward navigation could be served the
// cached (old) page — stranding users on a stale build that never runs the
// latest code. Bumping the name purges the old cache, including that stale '/'.
const CACHE = 'cubingclubs-v2';

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
  if (req.url.includes('/api/')) return;

  // HTML documents: stay out of the way entirely. Let the browser fetch every
  // navigation straight from the network so a deploy takes effect immediately
  // and no one can be pinned to an old page shell. (Root cause of the "clubs
  // never load after clicking Log In and going Back" bug.)
  if (req.mode === 'navigate') return;

  // Static assets (JS, CSS, images, fonts): cache-first for speed, refreshed
  // in the background when the network has a newer copy.
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
