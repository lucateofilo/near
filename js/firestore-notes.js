import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export async function sendNote(coupleId, uid, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'couples', coupleId, 'notes'), {
    uid, text: trimmed, createdAt: serverTimestamp(), notifiedToPartner: false, readBy: {},
  });
}

export async function listNotes(coupleId) {
  const snap = await getDocs(query(
    collection(db, 'couples', coupleId, 'notes'), orderBy('createdAt', 'desc'), limit(100)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function markNoteRead(coupleId, noteId, uid) {
  await updateDoc(doc(db, 'couples', coupleId, 'notes', noteId), { [`readBy.${uid}`]: true });
}

export async function deleteNote(coupleId, noteId) {
  await deleteDoc(doc(db, 'couples', coupleId, 'notes', noteId));
}
