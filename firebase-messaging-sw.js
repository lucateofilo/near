importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Stessa configurazione di js/firebase-config.js, duplicata qui: un service worker non può
// importare in modo affidabile moduli ES di terze parti su iOS, quindi va ripetuta.
// IMPORTANTE: quando incolli i valori reali di Firebase, aggiornali in ENTRAMBI i file.
firebase.initializeApp({
  apiKey: 'INSERISCI_API_KEY',
  authDomain: 'INSERISCI_AUTH_DOMAIN',
  projectId: 'INSERISCI_PROJECT_ID',
  messagingSenderId: 'INSERISCI_SENDER_ID',
  appId: 'INSERISCI_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Near';
  const options = {
    body: payload.notification?.body || '',
    icon: 'icons/icon-192.png',
  };
  self.registration.showNotification(title, options);
});
