import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export const SETTINGS_DEFS = [
  { key: 'calendarEnabled', title: 'Calendario anniversari', desc: 'Countdown per eventi e anniversari di coppia.' },
  { key: 'memoryMapEnabled', title: 'Mappa dei ricordi', desc: 'Geolocalizza le foto scattate (se neghi il permesso, la foto viene salvata comunque, senza posizione).' },
  { key: 'streakEnabled', title: 'Streak giornaliero', desc: 'Conta i giorni consecutivi in cui avete scattato almeno una foto, puntuale o in ritardo.' },
  { key: 'silentModeShortcutVisible', title: 'Scorciatoia modalità silenziosa', desc: 'Mostra in home il pulsante rapido per attivare la modalità silenziosa.' },
];

const DEFAULTS = Object.fromEntries(SETTINGS_DEFS.map((d) => [d.key, true]));

export async function getSettings(coupleId, uid) {
  const snap = await getDoc(doc(db, 'couples', coupleId, 'settings', uid));
  return {
    ...DEFAULTS,
    silentMode: { active: false, until: null },
    fcmTokens: [],
    ...(snap.exists() ? snap.data() : {}),
  };
}

export async function setSetting(coupleId, uid, key, value) {
  await setDoc(doc(db, 'couples', coupleId, 'settings', uid), { [key]: value }, { merge: true });
}

export async function updateSilentMode(coupleId, uid, silentMode) {
  await setDoc(doc(db, 'couples', coupleId, 'settings', uid), { silentMode }, { merge: true });
}
