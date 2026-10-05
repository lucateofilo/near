import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getMessaging, isSupported } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js';

// Le foto vengono caricate su Cloudinary (vedi js/cloudinary-config.js), non su Firebase Storage:
// i nuovi progetti Firebase richiedono il piano Blaze (carta di credito) anche solo per attivare
// Storage, indipendentemente dall'uso — scelta scartata per restare a costo zero.

// Valori pubblici per design: la sicurezza reale è nelle Security Rules, non nel nascondere l'apiKey.
// Sostituisci questi placeholder con i valori copiati da Firebase Console
// (Project Settings > Your apps > Web app > SDK setup and configuration).
const firebaseConfig = {
  apiKey: 'INSERISCI_API_KEY',
  authDomain: 'INSERISCI_AUTH_DOMAIN',
  projectId: 'INSERISCI_PROJECT_ID',
  messagingSenderId: 'INSERISCI_SENDER_ID',
  appId: 'INSERISCI_APP_ID',
};

// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates.
export const VAPID_KEY = 'INSERISCI_VAPID_KEY';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function getMessagingIfSupported() {
  if (!(await isSupported())) return null;
  return getMessaging(app);
}
