/* ═══════════════════════════════════════
   LIFEPLAN v6 — SERVICE WORKER
   service-worker.js
═══════════════════════════════════════ */
const CACHE_NAME  = 'lifeplan-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/setup.css',
  './css/layout.css',
  './js/core/storage.js',
  './js/core/state.js',
  './js/core/timezone.js',
  './js/features/auth.js',
  './js/features/badges.js',
  './js/features/widget.js',
  './js/app.js',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap',
];

/* ── INSTALL: cache all assets ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clear old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: serve from cache, fallback to network ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

/* ── PUSH NOTIFICATIONS ── */
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'LIFEPLAN', body: 'Your tasks are waiting!' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'LIFEPLAN', {
      body:    data.body    || 'Complete your daily tasks!',
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-192.png',
      tag:     'lifeplan-alert',
      renotify: true,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open',  title: 'Open App' },
        { action: 'snooze',title: 'Snooze 30min' },
      ],
      data: { url: './' }
    })
  );
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'snooze') return; // handled in app
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(all => {
      const existing = all.find(c => c.url.includes('index.html') && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow('./index.html');
    })
  );
});

/* ── BACKGROUND SYNC (alert checks) ── */
self.addEventListener('sync', e => {
  if (e.tag === 'lifeplan-check') {
    // App handles actual alert logic when foregrounded
    e.waitUntil(Promise.resolve());
  }
});

/* ── MESSAGE FROM APP ── */
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification('LIFEPLAN', {
      body:    e.data.body || 'Time to complete your tasks!',
      icon:    './icons/icon-192.png',
      tag:     'lifeplan-alert',
      vibrate: [200, 100, 200],
    });
  }
});
