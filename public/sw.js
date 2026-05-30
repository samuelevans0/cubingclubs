const CACHE = 'cubingclubs-v1';
const PRECACHE = ['/', '/dashboard', '/signup'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
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
