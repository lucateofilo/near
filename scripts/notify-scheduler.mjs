import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { romeDateKey, romeWallTimeToDate } from '../js/date-utils.js';

const DAILY_NOTIFICATIONS = 4;   // costante interna, mai esposta/configurabile lato utente
const MIN_GAP_HOURS = 3;
const WINDOW_START_HOUR = 9;     // 09:00
const WINDOW_END_HOUR = 26;      // 02:00 del giorno dopo (24 + 2)
const PAIRING_CODE_TTL_MIN = 15;

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
const db = getFirestore(app);
const messaging = getMessaging(app);

function generateSlotMinutes() {
  const windowMinStart = WINDOW_START_HOUR * 60;
  const windowMinEnd = WINDOW_END_HOUR * 60;
  const totalRange = windowMinEnd - windowMinStart;

  // ponytail: rejection sampling invece di un solver di spaziatura esatta — con 4 slot su 17h
  // e gap minimo 3h (12h minime necessarie su 17h disponibili) la probabilità di retry è bassa.
  // Upgrade path: sampling diretto a spaziatura garantita se i retry diventano frequenti nei log.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const mins = Array.from({ length: DAILY_NOTIFICATIONS }, () =>
      windowMinStart + Math.floor(Math.random() * totalRange)
    ).sort((a, b) => a - b);
    const ok = mins.every((m, i) => i === 0 || m - mins[i - 1] >= MIN_GAP_HOURS * 60);
    if (ok) return mins;
  }
  throw new Error('Impossibile generare slot con i vincoli richiesti dopo 1000 tentativi.');
}

function generateSlots(dateKey) {
  const mins = generateSlotMinutes();
  // self-check: verifica i vincoli prima di scrivere su Firestore
  console.assert(mins.length === DAILY_NOTIFICATIONS, 'numero slot errato');
  console.assert(mins.every((m, i) => i === 0 || m - mins[i - 1] >= MIN_GAP_HOURS * 60), 'gap minimo violato');
  return mins.map((m) => Timestamp.fromDate(romeWallTimeToDate(dateKey, Math.floor(m / 60), m % 60)));
}

async function ensureTodaySchedule(coupleId, dateKey) {
  const ref = db.doc(`couples/${coupleId}/schedule/${dateKey}`);
  const snap = await ref.get();
  if (snap.exists) return;

  const slots = generateSlots(dateKey).map((time) => ({ time, notified: false, notifiedAt: null }));
  try {
    await ref.create({ slots, generatedAt: Timestamp.now() });
  } catch {
    // creato nel frattempo da un'esecuzione concorrente del cron: nessuna azione necessaria
  }
}

async function getCoupleContext(coupleDoc) {
  const members = coupleDoc.data().members;
  const settingsSnaps = await Promise.all(
    members.map((uid) => db.doc(`couples/${coupleDoc.id}/settings/${uid}`).get())
  );
  const settings = Object.fromEntries(members.map((uid, i) => [uid, settingsSnaps[i].data() || {}]));
  return { members, settings };
}

function isSilenced(settings) {
  const sm = settings.silentMode;
  if (!sm?.active) return false;
  if (!sm.until) return true;
  return sm.until > Date.now();
}

async function isTravelPaused(coupleId) {
  const trips = await db.collection(`couples/${coupleId}/trips`).get();
  const now = Date.now();
  return trips.docs.some((doc) => {
    const t = doc.data();
    if (!t.randomNotificationsPaused) return false;
    const start = new Date(`${t.startDate}T00:00:00Z`).getTime();
    const end = start + t.days * 86400000;
    return now >= start && now < end;
  });
}

async function sendPush(coupleId, members, settings, { title, body, data }) {
  const recipients = members.filter((uid) => !isSilenced(settings[uid]));
  // token -> uid, per poter rimuovere solo quelli non registrati dal doc giusto
  const tokenOwners = recipients.flatMap((uid) => (settings[uid]?.fcmTokens || []).map((t) => [t, uid]));
  const tokens = tokenOwners.map(([t]) => t).filter(Boolean);
  if (tokens.length === 0) {
    console.log(`[push] "${data.type}": nessun token (${members.length} membri, ${recipients.length} non silenziati)`);
    return;
  }
  const res = await messaging.sendEachForMulticast({ tokens, notification: { title, body }, data });
  console.log(`[push] "${data.type}": ${res.successCount}/${tokens.length} inviati`);

  const staleByUid = new Map();
  res.responses.forEach((r, i) => {
    if (r.success) return;
    console.error(`[push] token ${i} fallito:`, r.error?.message);
    if (r.error?.code === 'messaging/registration-token-not-registered') {
      const [token, uid] = tokenOwners[i];
      if (!staleByUid.has(uid)) staleByUid.set(uid, []);
      staleByUid.get(uid).push(token);
    }
  });
  await Promise.all([...staleByUid].map(([uid, staleTokens]) =>
    db.doc(`couples/${coupleId}/settings/${uid}`).update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) })
  ));
  if (staleByUid.size) console.log(`[push] rimossi token non registrati per ${staleByUid.size} utenti`);
}

async function processRandomSlots(coupleId, members, settings, dateKey) {
  if (await isTravelPaused(coupleId)) return;

  const ref = db.doc(`couples/${coupleId}/schedule/${dateKey}`);
  const fresh = (await ref.get()).data();
  if (!fresh) return;
  const now = Date.now();

  for (let i = 0; i < fresh.slots.length; i++) {
    const slot = fresh.slots[i];
    if (slot.notified || slot.time.toMillis() > now) continue;

    // transazione idempotente: se il cron sovrappone due esecuzioni, solo una marca lo slot e invia
    const sent = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (data.slots[i].notified) return false;
      data.slots[i].notified = true;
      data.slots[i].notifiedAt = Timestamp.now();
      tx.update(ref, { slots: data.slots });
      return true;
    });

    if (sent) {
      await sendPush(coupleId, members, settings, {
        title: 'Near',
        body: 'È il momento di scattare una foto insieme, proprio ora!',
        data: { type: 'photo_prompt' },
      });
    }
  }
}

async function processPendingItems(coupleId, members, settings, collectionName, buildNotification) {
  const snap = await db.collection(`couples/${coupleId}/${collectionName}`).where('notifiedToPartner', '==', false).get();
  for (const doc of snap.docs) {
    const item = doc.data();
    const partnerUid = members.find((uid) => uid !== item.uid);
    if (partnerUid && !isSilenced(settings[partnerUid])) {
      await sendPush(coupleId, [partnerUid], settings, buildNotification(doc.id, item));
    }
    await doc.ref.update({ notifiedToPartner: true });
  }
}

async function cleanupExpiredPairingCodes() {
  // ponytail: fetch dell'intera collection e filtro in JS invece di una query
  // composta (used==false + createdAt<cutoff), che richiederebbe un indice
  // composito su Firestore — per una coppia la collection ha al massimo
  // pochi documenti totali, non serve altro. Upgrade path: query con indice
  // dedicato se in futuro i pairing code diventano molti.
  const cutoffMs = Date.now() - PAIRING_CODE_TTL_MIN * 60000;
  const snap = await db.collection('pairingCodes').get();
  const expired = snap.docs.filter((doc) => {
    const d = doc.data();
    return !d.used && d.createdAt && d.createdAt.toMillis() < cutoffMs;
  });
  await Promise.all(expired.map((doc) => doc.ref.delete()));
}

async function run() {
  await cleanupExpiredPairingCodes();

  const couplesSnap = await db.collection('couples').get();

  for (const coupleDoc of couplesSnap.docs) {
    const coupleId = coupleDoc.id;
    const dateKey = romeDateKey();

    await ensureTodaySchedule(coupleId, dateKey);
    const { members, settings } = await getCoupleContext(coupleDoc);

    await processRandomSlots(coupleId, members, settings, dateKey);

    await processPendingItems(coupleId, members, settings, 'photos', (id) => ({
      title: 'Near', body: 'Il tuo partner ha pubblicato una foto!', data: { type: 'photo_published', photoId: id },
    }));

    await processPendingItems(coupleId, members, settings, 'notes', (id) => ({
      title: 'Near', body: 'Hai un nuovo bigliettino!', data: { type: 'note_received', noteId: id },
    }));
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
