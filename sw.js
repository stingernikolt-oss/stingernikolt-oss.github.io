/* KODUS PWA: полный офлайн-кеш + Web Push.
   Стратегии:
   - навигация и статика приложения (js/css/шрифты/иконки/манифест): cache-first + фоновое обновление;
   - аватары из публичного bucket: cache-first + фоновое обновление (лимит 200);
   - API Supabase (rest/auth/functions/realtime/private storage): только сеть, не кешируется;
   - офлайн-фолбэк навигации: /offline.html. */
const CACHE = 'kodus-offline-v4';
const SHELL = ['/', '/index.html', '/offline.html', '/kodus-icon.png', '/manifest.json'];
const API_PREFIXES = ['/rest/v1/', '/auth/v1/', '/functions/v1/', '/realtime/v1/', '/storage/v1/object/authenticated'];
const AVATARS = '/storage/v1/object/public/kodus-avatars/';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('kodus-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(prefix, max) {
  const cache = await caches.open(CACHE);
  const keys = (await cache.keys()).filter(r => new URL(r.url).pathname.startsWith(prefix));
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                    // Supabase и CDN — не кешируем
  if (API_PREFIXES.some(p => url.pathname.startsWith(p))) return;    // API — только сеть

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cached => {
        const network = fetch(req).then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => null);
        return cached || network || caches.match('/offline.html');
      })
    );
    return;
  }

  // Статика, шрифты, иконки, аватары: мгновенно из кеша, обновление в фоне.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy).then(() => {
            if (url.pathname.startsWith(AVATARS)) void trim(AVATARS, 200);
            else if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/')) void trim(url.pathname.startsWith('/_expo/') ? '/_expo/' : '/assets/', 120);
          }));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// === Web Push: входящие push-сообщения ===
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: 'KODUS', body: event.data ? event.data.text() : '' }; }

  const show = async () => {
    // Если приложение открыто и видимо — баннер даст GlobalNotifier, пуш не дублируем.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.some(c => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(payload.title ?? 'KODUS', {
      body: payload.body ?? '',
      icon: payload.icon ?? '/kodus-icon.png',
      badge: '/kodus-icon.png',
      tag: payload.tag ?? 'kodus-message',
      renotify: true,
      data: payload.data ?? {},
      vibrate: [200, 100, 200],
      actions: payload.actions ?? [],
    });
  };
  event.waitUntil(show());
});

// Клик по уведомлению — открываем чат
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const targetUrl = chatId ? `/chat/${chatId}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});