import { db } from './firebase-config.js';
import { uploadToCloudinary } from './cloudinary-config.js';
import {
  collection, doc, addDoc, setDoc, getDocs, query, orderBy,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export async function createTrip(coupleId, { name, destination, days, randomNotificationsPaused, createdBy, startDate }) {
  const tripRef = await addDoc(collection(db, 'couples', coupleId, 'trips'), {
    name, destination, days, randomNotificationsPaused, createdBy, startDate,
  });
  for (let i = 0; i < days; i++) {
    await setDoc(doc(db, 'couples', coupleId, 'trips', tripRef.id, 'days', String(i)), {
      plan: '', photoUrl: null, uploadedBy: null,
    });
  }
  return tripRef.id;
}

export async function listTrips(coupleId) {
  const snap = await getDocs(query(collection(db, 'couples', coupleId, 'trips'), orderBy('startDate', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTripDays(coupleId, tripId) {
  const snap = await getDocs(collection(db, 'couples', coupleId, 'trips', tripId, 'days'));
  return snap.docs
    .map((d) => ({ dayIndex: Number(d.id), ...d.data() }))
    .sort((a, b) => a.dayIndex - b.dayIndex);
}

export async function updateDayPlan(coupleId, tripId, dayIndex, plan) {
  await setDoc(doc(db, 'couples', coupleId, 'trips', tripId, 'days', String(dayIndex)), { plan }, { merge: true });
}

export async function uploadDayPhoto(coupleId, tripId, dayIndex, uid, file) {
  const photoUrl = await uploadToCloudinary(file, `couples/${coupleId}/trips/${tripId}`);
  await setDoc(
    doc(db, 'couples', coupleId, 'trips', tripId, 'days', String(dayIndex)),
    { photoUrl, uploadedBy: uid },
    { merge: true }
  );
}
