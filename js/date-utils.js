// Utility pure (nessuna dipendenza da browser o Firebase) condivise sia dal client
// (browser) sia dallo script Node dello scheduler, per calcolare data/ora civile
// di Roma senza librerie esterne (date-fns-tz, luxon ecc.) — bastano le API Intl native.

const TZ = 'Europe/Rome';

function partsInZone(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(
    fmt.formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value])
  );
  return p;
}

export function romeDateKey(date = new Date()) {
  const p = partsInZone(date);
  return `${p.year}-${p.month}-${p.day}`;
}

// Restituisce un Date assoluto corrispondente a "dateKey alle hour:minute, ora civile di Roma".
// hour può essere >= 24 per esprimere orari dopo mezzanotte del giorno dopo (es. 26 = 02:00 del giorno dopo).
export function romeWallTimeToDate(dateKey, hour, minute) {
  const extraDays = Math.floor(hour / 24);
  const hh = hour % 24;
  const [y, m, d] = dateKey.split('-').map(Number);

  const naiveUtc = new Date(Date.UTC(y, m - 1, d + extraDays, hh, minute, 0));
  const p = partsInZone(naiveUtc);
  const romeAsIfUtc = new Date(Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)
  ));
  const offsetMs = romeAsIfUtc.getTime() - naiveUtc.getTime();
  return new Date(naiveUtc.getTime() - offsetMs);
}
