import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc, query, where, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente caratteri ambigui (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function findMyCouple(uid) {
  const snap = await getDocs(query(collection(db, 'couples'), where('members', 'array-contains', uid)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { coupleId: d.id, members: d.data().members };
}

export async function generatePairingCode(uid) {
  const code = randomCode();
  await setDoc(doc(db, 'pairingCodes', code), { uid, used: false, createdAt: serverTimestamp() });
  return code;
}

export async function redeemPairingCode(rawCode, myUid) {
  const code = rawCode.toUpperCase().trim();
  if (!code) throw new Error('Inserisci un codice.');

  const ref = doc(db, 'pairingCodes', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Codice non valido.');

  const data = snap.data();
  if (data.used) throw new Error('Codice già utilizzato.');
  if (data.uid === myUid) throw new Error('Non puoi usare il tuo stesso codice.');

  const members = [data.uid, myUid].sort();
  const coupleRef = await addDoc(collection(db, 'couples'), { members, createdAt: serverTimestamp() });
  await updateDoc(ref, { used: true });

  return { coupleId: coupleRef.id, members };
}
