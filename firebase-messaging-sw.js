importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Stessa configurazione di js/firebase-config.js, duplicata qui: un service worker non può
// importare in modo affidabile moduli ES di terze parti su iOS, quindi va ripetuta.
// IMPORTANTE: quando incolli i valori reali di Firebase, aggiornali in ENTRAMBI i file.
firebase.initializeApp({
  apiKey: 'AIzaSyCh4RE3CMZNTV00ghWbemG0dYz5E4RphH0',
  authDomain: 'near-f4f99.firebaseapp.com',
  projectId: 'near-f4f99',
  messagingSenderId: '657269240343',
  appId: '1:657269240343:web:573f4e612196f47d2b2252',
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
