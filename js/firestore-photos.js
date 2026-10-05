import { db } from './firebase-config.js';
import { romeDateKey } from './date-utils.js';
import { uploadToCloudinary } from './cloudinary-config.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const LATE_THRESHOLD_MS = 15 * 60 * 1000;

export async function getPendingSlot(coupleId, uid) {
  const dateKey = romeDateKey();
  const schedSnap = await getDoc(doc(db, 'couples', coupleId, 'schedule', dateKey));
  if (!schedSnap.exists()) return { dateKey, slotTime: null };

  const slots = schedSnap.data().slots || [];
  const now = Date.now();

  const myPhotos = await getDocs(query(
    collection(db, 'couples', coupleId, 'photos'),
    where('uid', '==', uid), where('scheduleDate', '==', dateKey)
  ));
  const covered = new Set(myPhotos.docs.map((d) => d.data().slotTime?.toMillis() ?? null));

  const candidates = slots
    .filter((s) => s.notified && s.time.toMillis() <= now && !covered.has(s.time.toMillis()))
    .sort((a, b) => a.time.toMillis() - b.time.toMillis());

  return { dateKey, slotTime: candidates[0]?.time ?? null };
}

export async function requestLocation() {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // permesso negato o errore: la foto viene salvata comunque, senza posizione
      { timeout: 5000 }
    );
  });
}

export async function uploadPhoto(coupleId, uid, { backFile, frontFile }, { withLocation }) {
  const { dateKey, slotTime } = await getPendingSlot(coupleId, uid);
  const takenAt = Date.now();

  let status = 'on_time';
  if (slotTime) {
    status = (takenAt - slotTime.toMillis() <= LATE_THRESHOLD_MS) ? 'on_time' : 'late';
  }

  const location = withLocation ? await requestLocation() : null;

  const [backUrl, frontUrl] = await Promise.all([
    uploadToCloudinary(backFile, `couples/${coupleId}/photos/${uid}`),
    uploadToCloudinary(frontFile, `couples/${coupleId}/photos/${uid}`),
  ]);

  await addDoc(collection(db, 'couples', coupleId, 'photos'), {
    uid,
    slotTime: slotTime ?? null,
    scheduleDate: dateKey,
    takenAt: Timestamp.fromMillis(takenAt),
    status,
    backUrl,
    frontUrl,
    location,
    reactions: {},
    notifiedToPartner: false,
  });
}

// foto pubblicate col vecchio schema a scatto singolo: niente migrazione dati,
// il rendering fa semplicemente fallback su imageUrl quando backUrl manca
export function photoImages(photo) {
  return { main: photo.backUrl || photo.imageUrl, thumb: photo.frontUrl || null };
}

export async function listPhotos(coupleId) {
  const snap = await getDocs(query(
    collection(db, 'couples', coupleId, 'photos'), orderBy('takenAt', 'desc'), limit(100)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Query dedicata (non limitata agli ultimi 100 scatti) per pescare le foto di
// un giorno preciso, anche molto indietro nel tempo — serve al ricordo "un anno fa".
export async function getPhotosByDate(coupleId, dateKey) {
  const snap = await getDocs(query(
    collection(db, 'couples', coupleId, 'photos'), where('scheduleDate', '==', dateKey)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function reactToPhoto(coupleId, photoId, uid, emoji) {
  await updateDoc(doc(db, 'couples', coupleId, 'photos', photoId), { [`reactions.${uid}`]: emoji });
}

// Elimina solo il documento Firestore: l'immagine resta su Cloudinary (upload
// non firmato, nessun segreto lato client per cancellarla via API) — scelta
// coerente col resto del progetto, costo di storage trascurabile.
export async function deletePhoto(coupleId, photoId) {
  await deleteDoc(doc(db, 'couples', coupleId, 'photos', photoId));
}
