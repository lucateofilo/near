import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export async function sendNote(coupleId, uid, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'couples', coupleId, 'notes'), {
    uid, text: trimmed, createdAt: serverTimestamp(), notifiedToPartner: false,
  });
}

export async function listNotes(coupleId) {
  const snap = await getDocs(query(
    collection(db, 'couples', coupleId, 'notes'), orderBy('createdAt', 'desc'), limit(100)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
