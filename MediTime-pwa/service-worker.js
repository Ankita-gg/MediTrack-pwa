// Basic service worker: cache static assets & fallback
const CACHE_NAME = 'meditrack-cache-v2';
const ASSETS = [
  '/', '/index.html', '/style.css', '/script.js', '/manifest.json',
  '/icon-192.png', '/icon-512.png'
];

// install -> cache
self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

// activate -> cleanup
self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

// fetch -> respond with cache-first, then network
self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  ev.respondWith(
    caches.match(ev.request).then(cached => {
      if (cached) return cached;
      return fetch(ev.request).then(resp => {
        if (ev.request.method === 'GET' && resp && resp.status === 200 && resp.type !== 'opaque') {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(ev.request, respClone));
        }
        return resp;
      }).catch(() => {
        if (ev.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});

// notificationclick handler
self.addEventListener('notificationclick', ev => {
  ev.notification.close();
  ev.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length > 0) return list[0].focus();
    return clients.openWindow('/');
  }));
});

// optional push handler (server must send push with VAPID)
self.addEventListener('push', ev => {
  let payload = { title: 'MediTrack', body: 'Reminder', icon: '/icon-192.png' };
  try { payload = ev.data.json(); } catch(e){}
  ev.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: payload.icon }));
});
