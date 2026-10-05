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
  apiKey: 'AIzaSyCh4RE3CMZNTV00ghWbemG0dYz5E4RphH0',
  authDomain: 'near-f4f99.firebaseapp.com',
  projectId: 'near-f4f99',
  messagingSenderId: '657269240343',
  appId: '1:657269240343:web:573f4e612196f47d2b2252',
};

// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates.
export const VAPID_KEY = 'BBeulRH2h4YI_HtYeJC07HM8e4Im6T3JN8AXbOA6LJgq8sVbXKA3y3It1LF5EJoV2ptU4bbnC09qlAVtjBi6Xrw';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function getMessagingIfSupported() {
  if (!(await isSupported())) return null;
  return getMessaging(app);
}
