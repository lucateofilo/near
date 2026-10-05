import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export async function addEvent(coupleId, title, date, recurring) {
  await addDoc(collection(db, 'couples', coupleId, 'events'), { title, date, recurring });
}

export async function listEvents(coupleId) {
  const snap = await getDocs(query(collection(db, 'couples', coupleId, 'events'), orderBy('date')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function daysUntil(dateStr, recurring) {
  const today = new Date(new Date().toDateString());
  let target = new Date(`${dateStr}T00:00:00`);
  if (recurring) {
    target.setFullYear(today.getFullYear());
    if (target < today) target.setFullYear(today.getFullYear() + 1);
  }
  return Math.ceil((target - today) / 86400000);
}

// Il prossimo evento futuro (il countdown più piccolo non negativo); gli eventi
// non ricorrenti già passati non rientrano mai, non hanno un'occorrenza successiva.
export function nextUpcoming(events) {
  return events
    .map((ev) => ({ ...ev, days: daysUntil(ev.date, ev.recurring) }))
    .filter((ev) => ev.days >= 0)
    .sort((a, b) => a.days - b.days)[0] || null;
}
