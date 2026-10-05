import { db, getMessagingIfSupported, VAPID_KEY } from './firebase-config.js';
import { doc, setDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js';

export async function enableNotifications(coupleId, uid) {
  if (!('Notification' in window)) throw new Error('Notifiche non supportate su questo browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permesso notifiche negato.');

  const messaging = await getMessagingIfSupported();
  if (!messaging) throw new Error('Push non supportate su questo dispositivo/browser.');

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Impossibile ottenere il token FCM.');

  await setDoc(doc(db, 'couples', coupleId, 'settings', uid), { fcmTokens: arrayUnion(token) }, { merge: true });

  onMessage(messaging, (payload) => console.log('Notifica in foreground:', payload));

  return token;
}
