// Messaggistica push unita qui (invece che in un secondo service worker
// separato): due SW registrati sulla stessa scope '/' si scalzano a vicenda
// ad ogni apertura dell'app (questo file fa skipWaiting() ad ogni reload),
// quindi quello delle notifiche smetteva di ricevere i push non appena
// l'utente riapriva l'app. Un solo SW per tutta la scope elimina il problema.
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCh4RE3CMZNTV00ghWbemG0dYz5E4RphH0',
  authDomain: 'near-f4f99.firebaseapp.com',
  projectId: 'near-f4f99',
  messagingSenderId: '657269240343',
  appId: '1:657269240343:web:573f4e612196f47d2b2252',
});

firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Nearby';
  const options = {
    body: payload.notification?.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-notification.png',
    data: payload.data,
  };
  self.registration.showNotification(title, options);
});

// Tap sulla notifica: se l'app è già aperta in un tab, le manda la view giusta
// via postMessage invece di ricaricarla; altrimenti apre una finestra nuova
// con ?view= nell'URL, letto da app.js al bootstrap.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const view = event.notification.data?.type === 'note_received' ? 'notes' : 'home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => c.url.startsWith(self.registration.scope));
      if (client) {
        client.postMessage({ type: 'navigate', view });
        return client.focus();
      }
      return self.clients.openWindow(`${self.registration.scope}?view=${view}`);
    })
  );
});

const CACHE_NAME = 'near-shell-v10';
const SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-notification.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
