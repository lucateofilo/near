import { romeDateKey } from './date-utils.js';

// Giorni consecutivi (fino a oggi, Europa/Roma) con almeno una foto, puntuale o in ritardo non importa.
// Il giorno odierno, se ancora senza foto, non interrompe lo streak (il giorno non è "saltato" finché non finisce).
export function computeStreak(photos) {
  const days = new Set(photos.map((p) => p.scheduleDate));
  const todayKey = romeDateKey();

  let streak = 0;
  let cursor = new Date();
  let first = true;

  for (;;) {
    const key = romeDateKey(cursor);
    const has = days.has(key);
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
