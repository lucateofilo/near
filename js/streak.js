import { romeDateKey } from './date-utils.js';

// Giorni consecutivi (fino a oggi, Europa/Roma) in cui ENTRAMBI i membri hanno
// pubblicato almeno una foto, puntuale o in ritardo non importa.
// Il giorno odierno, se ancora incompleto, non interrompe lo streak (il giorno non è "saltato" finché non finisce).
export function computeStreak(photos, members) {
  const daysByUid = new Map(members.map((uid) => [uid, new Set()]));
  for (const p of photos) daysByUid.get(p.uid)?.add(p.scheduleDate);
  const bothPosted = (key) => members.every((uid) => daysByUid.get(uid)?.has(key));
  const todayKey = romeDateKey();

  let streak = 0;
  let cursor = new Date();
  let first = true;

  for (;;) {
    const key = romeDateKey(cursor);
    const has = bothPosted(key);
    if (has) {
      streak++;
    } else if (first && key === todayKey) {
      // oggi senza foto ancora: non rompe lo streak, si passa a ieri
    } else {
      break;
    }
    first = false;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  return streak;
}
