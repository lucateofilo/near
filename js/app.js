import { watchAuth, login, signup, logout } from './auth.js';
import { auth } from './firebase-config.js';
import { findMyCouple, generatePairingCode, redeemPairingCode } from './pairing.js';
import { state, setUser, setCouple, reset } from './state.js';
import { showView, toast, formatDate } from './ui.js';
import { uploadPhoto, listPhotos, getPhotosByDate, reactToPhoto, deletePhoto, getPendingSlot, photoImages } from './firestore-photos.js';
import { startCamera, stopCamera, captureFrame } from './camera-capture.js';
import { romeDateKey, oneYearBeforeKey } from './date-utils.js';
import { sendNote, listNotes, markNoteRead, deleteNote } from './firestore-notes.js';
import { SETTINGS_DEFS, getSettings, setSetting } from './settings.js';
import { computeStreak } from './streak.js';
import { addEvent, listEvents, daysUntil, nextUpcoming, deleteEvent } from './calendar.js';
import { createTrip, listTrips, getTripDays, updateDayPlan, uploadDayPhoto, deleteTrip } from './travel-mode.js';
import { SILENT_DURATIONS, activateSilentMode, deactivateSilentMode, isSilentActive } from './silent-mode.js';
import { enableNotifications } from './fcm-client.js';
import { getProfile, saveProfileName, uploadAvatar, avatarHtml, renderAvatarInto } from './profile.js';

const REACTION_EMOJIS = ['❤️', '🤍', '😍', '😂', '😮'];
const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';

let currentSettings = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Auth ----------

let authMode = 'login';

document.getElementById('authToggleBtn').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('authSubmitBtn').textContent = authMode === 'login' ? 'Accedi' : 'Registrati';
  document.getElementById('authToggleBtn').textContent = authMode === 'login'
    ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi';
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  errorEl.textContent = '';
  try {
    if (authMode === 'login') await login(email, password);
    else await signup(email, password);
  } catch (err) {
    errorEl.textContent = traduciErroreAuth(err);
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await logout();
});

function traduciErroreAuth(err) {
  const map = {
    'auth/invalid-email': 'Email non valida.',
    'auth/user-not-found': 'Utente non trovato.',
    'auth/wrong-password': 'Password errata.',
    'auth/invalid-credential': 'Credenziali non valide.',
    'auth/email-already-in-use': 'Email già registrata.',
    'auth/weak-password': 'Password troppo corta (minimo 6 caratteri).',
  };
  return map[err.code] || 'Si è verificato un errore. Riprova.';
}

// ---------- Profilo (nome + avatar) ----------

document.getElementById('profileNameInput').addEventListener('blur', async (e) => {
  const name = e.target.value.trim();
  await saveProfileName(state.user.uid, name);
});

document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await uploadAvatar(state.user.uid, file);
    await renderMyAvatar();
    toast('Avatar aggiornato!');
  } catch (err) {
    toast('Errore durante il caricamento dell\'avatar.');
    console.error(err);
  } finally {
    e.target.value = '';
  }
});

async function renderMyAvatar() {
  const profile = await getProfile(state.user.uid, state.user.email);
  renderAvatarInto(document.getElementById('myAvatar'), profile, 56);
  document.getElementById('profileNameInput').value = profile.name;
}

// ---------- Abbinamento (ora dentro Impostazioni, non più un gate bloccante) ----------

document.getElementById('generateCodeBtn').addEventListener('click', async () => {
  const code = await generatePairingCode(state.user.uid);
  const codeEl = document.getElementById('myPairingCode');
  codeEl.textContent = code;
  codeEl.classList.remove('hidden');
});

document.getElementById('redeemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('redeemInput');
  const errorEl = document.getElementById('pairingError');
  errorEl.textContent = '';
  try {
    const { coupleId, members } = await redeemPairingCode(input.value, state.user.uid);
    setCouple(coupleId, members);
    toast('Abbinamento riuscito!');
    renderAccount();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Navigazione ----------
// Un'unica sidebar (scorre da sinistra) elenca tutte le pagine una sotto
// l'altra invece di ammassare profilo/coppia/notifiche/calendario dentro
// Impostazioni: Impostazioni ora contiene solo le preferenze dell'app,
// Account l'identità e l'abbinamento.

const VIEW_RENDERERS = {
  home: renderHome,
  notes: renderNotes,
  calendar: renderCalendar,
  travel: renderTravel,
  ricordi: renderRicordi,
  settings: renderSettings,
  account: renderAccount,
};

function openNav() {
  document.getElementById('navDrawer').classList.add('open');
  document.getElementById('navBackdrop').classList.add('open');
}

function closeNav() {
  document.getElementById('navDrawer').classList.remove('open');
  document.getElementById('navBackdrop').classList.remove('open');
}

document.getElementById('menuBtn').addEventListener('click', openNav);
document.getElementById('closeNavBtn').addEventListener('click', closeNav);
document.getElementById('navBackdrop').addEventListener('click', closeNav);

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    closeNav();

    if (!state.coupleId) {
      const couple = await findMyCouple(state.user.uid);
      if (couple) setCouple(couple.coupleId, couple.members);
    }

    showView(view);
    VIEW_RENDERERS[view]();
  });
});

// ---------- Home / Foto ----------

// Scatto doppio stile BeReal: back poi front in sequenza (nessun device garantisce
// davvero due stream camera simultanei via web), con retake libero prima di pubblicare.
const captureOverlay = document.getElementById('captureOverlay');
const captureVideo = document.getElementById('captureVideo');
const capturePreviewBack = document.getElementById('capturePreviewBack');
const captureStepLabel = document.getElementById('captureStepLabel');
let captureStream = null;
let backBlob = null;

async function runCaptureStep(facingMode, label) {
  captureStepLabel.textContent = label;
  captureStream = await startCamera(facingMode);
  captureVideo.srcObject = captureStream;
  captureVideo.classList.toggle('mirrored', facingMode === 'user');
  return new Promise((resolve) => {
    document.getElementById('captureShotBtn').onclick = async () => {
      const blob = await captureFrame(captureVideo, facingMode === 'user');
      stopCamera(captureStream);
      resolve(blob);
    };
  });
}

function closeCaptureOverlay() {
  stopCamera(captureStream);
  captureStream = null;
  backBlob = null;
  capturePreviewBack.classList.add('hidden');
  captureOverlay.classList.add('hidden');
}

document.getElementById('captureCancelBtn').addEventListener('click', closeCaptureOverlay);

document.getElementById('captureBtn').addEventListener('click', async () => {
  captureOverlay.classList.remove('hidden');
  try {
    backBlob = await runCaptureStep('environment', 'Scatta la foto principale');
    capturePreviewBack.src = URL.createObjectURL(backBlob);
    capturePreviewBack.classList.remove('hidden');

    const frontBlob = await runCaptureStep('user', 'E ora un selfie');

    await uploadPhoto(state.coupleId, state.user.uid, { backFile: backBlob, frontFile: frontBlob }, {
      withLocation: currentSettings?.memoryMapEnabled ?? true,
    });
    toast('Foto pubblicata!');
    closeCaptureOverlay();
    renderHome();
  } catch (err) {
    toast(err.name === 'NotAllowedError' ? 'Permesso fotocamera negato.' : 'Errore durante lo scatto/pubblicazione.');
    console.error(err);
    closeCaptureOverlay();
  }
});

async function renderHome() {
  const captureBtn = document.getElementById('captureBtn');
  const captureBtnLabel = document.getElementById('captureBtnLabel');
  const reciprocityNote = document.getElementById('reciprocityNote');
  const wrap = document.getElementById('photosList');
  const partnerCard = document.getElementById('partnerCard');

  if (!state.coupleId) {
    captureBtn.classList.add('hidden');
    partnerCard.classList.add('hidden');
    wrap.innerHTML = '<p>Abbinati al tuo partner dalla pagina Account per iniziare a scattare foto insieme.</p>';
    return;
  }
  captureBtn.classList.remove('hidden');

  const partnerProfile = await getProfile(state.partnerUid);
  partnerCard.innerHTML = `
    ${avatarHtml(partnerProfile, 44)}
    <div>
      <div class="partner-name">${escapeHtml(partnerProfile.name) || 'Il tuo partner'}</div>
      <div class="partner-sub">Siete abbinati</div>
    </div>
  `;
  partnerCard.classList.remove('hidden');

  const { slotTime } = await getPendingSlot(state.coupleId, state.user.uid);
  captureBtn.classList.toggle('capture-btn-pending', !!slotTime);
  captureBtnLabel.textContent = slotTime ? 'È il momento! Scatta ora' : 'Scatta una foto';

  const todayKey = romeDateKey();
  const photos = await listPhotos(state.coupleId);
  const iPostedToday = photos.some((p) => p.uid === state.user.uid && p.scheduleDate === todayKey);
  const hiddenToday = photos.filter((p) => !iPostedToday && p.uid !== state.user.uid && p.scheduleDate === todayKey);
  const visible = photos.filter((p) => !hiddenToday.includes(p));

  reciprocityNote.classList.toggle('hidden', hiddenToday.length === 0);

  wrap.innerHTML = visible.map((p) => {
    const { main, thumb } = photoImages(p);
    return `
    <div class="photo-card">
      <div class="dual-photo">
        <img class="photo-main" src="${main}" alt="Foto" loading="lazy">
        ${thumb ? `<img class="photo-thumb" src="${thumb}" alt="Selfie" loading="lazy">` : ''}
      </div>
      <div class="photo-meta">
        <span class="meta-info">
          <span>${formatDate(p.takenAt?.toDate?.() ?? p.takenAt)}</span>
          <span class="status-badge status-${p.status}">${p.status === 'on_time' ? 'Puntuale' : 'In ritardo'}</span>
        </span>
        ${p.uid === state.user.uid ? `<button class="delete-btn" data-delete-photo="${p.id}" title="Elimina foto">${TRASH_ICON}</button>` : ''}
      </div>
      <div class="reactions-row" data-photo-id="${p.id}">
        ${REACTION_EMOJIS.map((em) => `<button data-emoji="${em}">${em}</button>`).join('')}
      </div>
    </div>
  `;
  }).join('') || '<p>Ancora nessuna foto. Aspettate la prossima notifica!</p>';

  wrap.querySelectorAll('[data-delete-photo]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Eliminare questa foto? Non si può annullare.')) return;
      await deletePhoto(state.coupleId, btn.dataset.deletePhoto);
      renderHome();
    });
  });

  // tap sulla miniatura per scambiarla con la foto grande, cosi' si vede
  // integralmente anche quella (nessuna delle due resta "piccola per sempre")
  wrap.querySelectorAll('.photo-thumb').forEach((thumbEl) => {
    thumbEl.addEventListener('click', () => {
      const mainEl = thumbEl.previousElementSibling;
      [mainEl.src, thumbEl.src] = [thumbEl.src, mainEl.src];
    });
  });

  wrap.querySelectorAll('.reactions-row').forEach((row) => {
    row.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await reactToPhoto(state.coupleId, row.dataset.photoId, state.user.uid, btn.dataset.emoji);
        toast('Reazione inviata!');
      });
    });
  });
}

// ---------- Bigliettini ----------

document.getElementById('addNoteBtn').addEventListener('click', () => {
  document.getElementById('noteForm').classList.toggle('hidden');
  document.getElementById('addNoteBtn').classList.toggle('active');
});

document.getElementById('noteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const textarea = document.getElementById('noteText');
  await sendNote(state.coupleId, state.user.uid, textarea.value);
  textarea.value = '';
  document.getElementById('noteForm').classList.add('hidden');
  document.getElementById('addNoteBtn').classList.remove('active');
  renderNotes();
});

async function renderNotes() {
  const addBtn = document.getElementById('addNoteBtn');
  const wrap = document.getElementById('notesList');

  if (!state.coupleId) {
    addBtn.classList.add('hidden');
    document.getElementById('noteForm').classList.add('hidden');
    wrap.innerHTML = '<p>Abbinati al tuo partner dalla pagina Account per iniziare a scambiarvi bigliettini.</p>';
    return;
  }
  addBtn.classList.remove('hidden');

  const [notes, partnerProfile] = await Promise.all([listNotes(state.coupleId), getProfile(state.partnerUid)]);
  const partnerName = partnerProfile.name || 'Il tuo partner';
  wrap.innerHTML = notes.map((n) => {
    const mine = n.uid === state.user.uid;
    const read = !!n.readBy?.[state.partnerUid];
    return `
    <div class="note-card">
      <p>${escapeHtml(n.text)}</p>
      <div class="note-meta meta-row">
        <span>${mine ? 'Tu' : escapeHtml(partnerName)} · ${formatDate(n.createdAt?.toDate?.() ?? n.createdAt)}${mine && read ? ' · ✓ Letto' : ''}</span>
        ${mine ? `<button class="delete-btn" data-delete-note="${n.id}" title="Elimina bigliettino">${TRASH_ICON}</button>` : ''}
      </div>
    </div>
  `;
  }).join('') || '<p>Nessun bigliettino ancora.</p>';

  wrap.querySelectorAll('[data-delete-note]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Eliminare questo bigliettino? Non si può annullare.')) return;
      await deleteNote(state.coupleId, btn.dataset.deleteNote);
      renderNotes();
    });
  });

  // i bigliettini del partner non ancora letti vengono marcati ora: è l'apertura
  // della vista "Bigliettini" stessa il momento in cui li hai effettivamente visti
  notes
    .filter((n) => n.uid !== state.user.uid && !n.readBy?.[state.user.uid])
    .forEach((n) => markNoteRead(state.coupleId, n.id, state.user.uid));
}

// ---------- Impostazioni (solo preferenze dell'app: profilo e coppia sono
// ora in Account, il calendario ha una pagina propria) ----------

async function renderSettings() {
  const unpaired = document.getElementById('settingsUnpaired');
  const content = document.getElementById('settingsContent');

  if (!state.coupleId) {
    unpaired.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  unpaired.classList.add('hidden');
  content.classList.remove('hidden');

  currentSettings = await getSettings(state.coupleId, state.user.uid);

  const wrap = document.getElementById('settingsToggles');
  wrap.innerHTML = SETTINGS_DEFS.map((def) => `
    <label class="toggle-row" data-key="${def.key}">
      <div class="toggle-row-top">
        <span class="toggle-title">${def.title}</span>
        <span class="switch">
          <input type="checkbox" ${currentSettings[def.key] ? 'checked' : ''}>
          <span class="slider"></span>
        </span>
      </div>
      <p class="toggle-desc">${def.desc}</p>
    </label>
  `).join('');

  wrap.querySelectorAll('.toggle-row').forEach((row) => {
    row.querySelector('input').addEventListener('change', async (e) => {
      const key = row.dataset.key;
      await setSetting(state.coupleId, state.user.uid, key, e.target.checked);
      currentSettings[key] = e.target.checked;
      if (key === 'silentModeShortcutVisible') updateQuietFabVisibility();
    });
  });

  updateQuietFabVisibility();
}

function updateQuietFabVisibility() {
  document.getElementById('quietModeBtn').classList.toggle('hidden', !currentSettings?.silentModeShortcutVisible);
}

document.getElementById('enableNotifBtn').addEventListener('click', async () => {
  try {
    await enableNotifications(state.coupleId, state.user.uid);
    toast('Notifiche attivate!');
  } catch (err) {
    toast(err.message);
  }
});

// ---------- Account (profilo + abbinamento) ----------

async function renderAccount() {
  await renderMyAvatar();

  const pairedStatus = document.getElementById('pairedStatus');
  const pairingForms = document.getElementById('pairingForms');

  pairedStatus.classList.toggle('hidden', !state.coupleId);
  pairingForms.classList.toggle('hidden', !!state.coupleId);
  if (state.coupleId) {
    const partnerProfile = await getProfile(state.partnerUid);
    pairedStatus.textContent = `✓ Sei abbinato a ${partnerProfile.name || 'un partner'}.`;
  }
}

// ---------- Calendario ----------

async function renderCalendar() {
  const unpaired = document.getElementById('calendarUnpaired');
  const content = document.getElementById('calendarContent');
  const addBtn = document.getElementById('addEventBtn');

  if (!state.coupleId) {
    addBtn.classList.add('hidden');
    unpaired.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  addBtn.classList.remove('hidden');
  unpaired.classList.add('hidden');
  content.classList.remove('hidden');
  renderEvents();
}

document.getElementById('addEventBtn').addEventListener('click', () => {
  document.getElementById('eventForm').classList.toggle('hidden');
  document.getElementById('addEventBtn').classList.toggle('active');
});

document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const recurring = document.getElementById('eventRecurring').checked;
  if (!title || !date) return;
  await addEvent(state.coupleId, title, date, recurring);
  document.getElementById('eventForm').reset();
  document.getElementById('eventRecurring').checked = true;
  document.getElementById('eventForm').classList.add('hidden');
  document.getElementById('addEventBtn').classList.remove('active');
  renderEvents();
});

async function renderEvents() {
  const events = await listEvents(state.coupleId);
  const wrap = document.getElementById('eventsList');
  wrap.innerHTML = events.map((ev) => `
    <div class="event-card">
      <div class="meta-row">
        <strong>${escapeHtml(ev.title)}</strong>
        <button class="delete-btn" data-delete-event="${ev.id}" title="Elimina evento">${TRASH_ICON}</button>
      </div>
      <p>${daysUntil(ev.date, ev.recurring)} giorni</p>
    </div>
  `).join('') || '<p>Nessun evento ancora.</p>';

  wrap.querySelectorAll('[data-delete-event]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Eliminare questo evento? Non si può annullare.')) return;
      await deleteEvent(state.coupleId, btn.dataset.deleteEvent);
      renderEvents();
    });
  });
}

// ---------- Ricordi ----------
// Streak, countdown prossimo evento e la foto di un anno fa: dati "da
// sbirciare", non da gestire, per questo hanno una pagina propria invece di
// affollare la Home o restare sepolti dentro Impostazioni.

async function renderRicordi() {
  const unpaired = document.getElementById('ricordiUnpaired');
  const content = document.getElementById('ricordiContent');
  const streakEl = document.getElementById('ricordiStreak');
  const eventEl = document.getElementById('ricordiEvent');
  const memoryEl = document.getElementById('ricordiMemory');

  if (!state.coupleId) {
    unpaired.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  unpaired.classList.add('hidden');
  content.classList.remove('hidden');

  const [photos, events] = await Promise.all([listPhotos(state.coupleId), listEvents(state.coupleId)]);

  streakEl.classList.toggle('hidden', currentSettings?.streakEnabled === false);
  if (currentSettings?.streakEnabled !== false) {
    const streak = computeStreak(photos);
    streakEl.innerHTML = `<h3>Streak</h3><p>${streak} ${streak === 1 ? 'giorno' : 'giorni'} consecutivi</p>`;
  }

  eventEl.classList.toggle('hidden', currentSettings?.calendarEnabled === false);
  if (currentSettings?.calendarEnabled !== false) {
    const next = nextUpcoming(events);
    eventEl.innerHTML = next
      ? `<h3>Prossimo evento</h3><p>${escapeHtml(next.title)} — ${next.days === 0 ? 'è oggi!' : `in ${next.days} ${next.days === 1 ? 'giorno' : 'giorni'}`}</p>`
      : '<h3>Prossimo evento</h3><p>Aggiungi una data dal Calendario.</p>';
  }

  memoryEl.classList.remove('hidden');
  const memoryPhotos = await getPhotosByDate(state.coupleId, oneYearBeforeKey(romeDateKey()));
  memoryEl.innerHTML = memoryPhotos.length
    ? '<h3>Un anno fa</h3>' + memoryPhotos.map((p) => `<img class="memory-photo" src="${photoImages(p).main}" alt="Ricordo di un anno fa" loading="lazy">`).join('')
    : '<h3>Un anno fa</h3><p>Nessun ricordo per oggi. L\'anno prossimo ci sarà.</p>';
}

// ---------- Modalità silenziosa ----------

document.getElementById('quietModeBtn').addEventListener('click', async () => {
  const popover = document.getElementById('quietModePopover');
  if (!popover.classList.contains('hidden')) {
    popover.classList.add('hidden');
    return;
  }
  const settings = await getSettings(state.coupleId, state.user.uid);
  const active = isSilentActive(settings.silentMode);
  popover.innerHTML = (active
    ? ['<button data-action="off">Disattiva modalità silenziosa</button>']
    : SILENT_DURATIONS.map((d) => `<button data-ms="${d.ms ?? ''}">${d.label}</button>`)
  ).join('');
  popover.classList.remove('hidden');

  popover.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.action === 'off') {
        await deactivateSilentMode(state.coupleId, state.user.uid);
        toast('Modalità silenziosa disattivata.');
      } else {
        const ms = btn.dataset.ms ? Number(btn.dataset.ms) : null;
        await activateSilentMode(state.coupleId, state.user.uid, ms);
        toast('Modalità silenziosa attivata.');
      }
      popover.classList.add('hidden');
    });
  });
});

// ---------- Viaggio ----------

document.getElementById('newTripBtn').addEventListener('click', () => {
  renderNewTripForm();
  document.getElementById('newTripBtn').classList.add('active');
});

function closeNewTripForm() {
  const detail = document.getElementById('tripDetail');
  detail.classList.add('hidden');
  detail.innerHTML = '';
  document.getElementById('newTripBtn').classList.remove('active');
}

function renderNewTripForm() {
  const detail = document.getElementById('tripDetail');
  detail.classList.remove('hidden');
  detail.innerHTML = `
    <form id="tripForm">
      <h2>Nuovo viaggio</h2>
      <label class="field-label" for="tripName">Nome o destinazione</label>
      <input type="text" id="tripName" placeholder="Es. Weekend a Firenze" required>
      <label class="field-label" for="tripStartDate">Data di inizio</label>
      <input type="date" id="tripStartDate" required>
      <label class="field-label" for="tripDays">Numero di giorni</label>
      <input type="number" id="tripDays" placeholder="Es. 3" min="1" max="60" required>
      <label><input type="checkbox" id="tripPause"> Sospendi le notifiche random durante il viaggio</label>
      <button type="submit">Crea</button>
      <button type="button" id="tripCancelBtn" class="btn-secondary">Annulla</button>
    </form>
  `;
  document.getElementById('tripCancelBtn').addEventListener('click', closeNewTripForm);
  document.getElementById('tripForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tripName').value.trim();
    const startDate = document.getElementById('tripStartDate').value;
    const days = Number(document.getElementById('tripDays').value);
    const randomNotificationsPaused = document.getElementById('tripPause').checked;
    const tripId = await createTrip(state.coupleId, {
      name, destination: name, days, randomNotificationsPaused, startDate, createdBy: state.user.uid,
    });
    closeNewTripForm();
    renderTravel();
    openTrip(tripId);
  });
}

async function renderTravel() {
  const newTripBtn = document.getElementById('newTripBtn');
  const wrap = document.getElementById('tripsList');

  if (!state.coupleId) {
    newTripBtn.classList.add('hidden');
    wrap.innerHTML = '<p>Abbinati al tuo partner dalla pagina Account per pianificare un viaggio insieme.</p>';
    return;
  }
  newTripBtn.classList.remove('hidden');

  const trips = await listTrips(state.coupleId);
  wrap.innerHTML = trips.map((t) => `
    <div class="trip-card" data-trip-id="${t.id}">
      <div class="meta-row">
        <strong>${escapeHtml(t.name)}</strong>
        <button class="delete-btn" data-delete-trip="${t.id}" title="Elimina viaggio">${TRASH_ICON}</button>
      </div>
      <p>${t.days} giorni · dal ${t.startDate}</p>
      <button data-open="${t.id}">Apri</button>
    </div>
  `).join('') || '<p>Nessun viaggio ancora.</p>';

  wrap.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openTrip(btn.dataset.open));
  });

  wrap.querySelectorAll('[data-delete-trip]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Eliminare questo viaggio e tutte le sue giornate? Non si può annullare.')) return;
      await deleteTrip(state.coupleId, btn.dataset.deleteTrip);
      renderTravel();
    });
  });
}

async function openTrip(tripId) {
  const days = await getTripDays(state.coupleId, tripId);
  const detail = document.getElementById('tripDetail');
  detail.classList.remove('hidden');

  detail.innerHTML = `
    <button id="tripBackBtn" class="btn-secondary">← Torna ai viaggi</button>
    ${days.map((d) => `
      <div class="day-card">
        <h2>Giorno ${d.dayIndex + 1}</h2>
        <textarea data-day="${d.dayIndex}" placeholder="Cosa farete questo giorno?" aria-label="Piano del giorno ${d.dayIndex + 1}">${escapeHtml(d.plan || '')}</textarea>
        ${d.photoUrl ? `<img src="${d.photoUrl}" alt="Foto giorno ${d.dayIndex + 1}">` : ''}
        <label class="capture-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/></svg>
          Foto del giorno
          <input type="file" data-day-photo="${d.dayIndex}" accept="image/*" capture="environment" hidden>
        </label>
      </div>
    `).join('')}
  `;

  document.getElementById('tripBackBtn').addEventListener('click', () => {
    detail.classList.add('hidden');
    detail.innerHTML = '';
  });

  detail.querySelectorAll('textarea[data-day]').forEach((ta) => {
    ta.addEventListener('blur', () => updateDayPlan(state.coupleId, tripId, Number(ta.dataset.day), ta.value));
  });

  detail.querySelectorAll('input[data-day-photo]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadDayPhoto(state.coupleId, tripId, Number(input.dataset.dayPhoto), state.user.uid, file);
      toast('Foto del giorno salvata!');
      openTrip(tripId);
    });
  });
}

// ---------- Bootstrap ----------

async function enterApp() {
  document.getElementById('appHeader').classList.remove('hidden');

  if (state.coupleId) {
    currentSettings = await getSettings(state.coupleId, state.user.uid);
  } else {
    currentSettings = null;
  }
  updateQuietFabVisibility();

  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  document.querySelector('.nav-item[data-view="home"]').classList.add('active');
  showView('home');
  renderHome();
}

let firstAuthCheckDone = false;

watchAuth(async (user) => {
  if (!firstAuthCheckDone) {
    // Firebase può emettere un primo evento transitorio (es. null) prima di
    // aver finito di ripristinare la sessione salvata: aspettiamo lo stato
    // definitivo per evitare di mostrare per un istante la vista di login.
    await auth.authStateReady();
    user = auth.currentUser;
    firstAuthCheckDone = true;
  }

  if (!user) {
    reset();
    authMode = 'login';
    document.getElementById('authSubmitBtn').textContent = 'Accedi';
    document.getElementById('authToggleBtn').textContent = 'Non hai un account? Registrati';
    document.getElementById('authForm').reset();
    document.getElementById('appHeader').classList.add('hidden');
    closeNav();
    document.getElementById('quietModeBtn').classList.add('hidden');
    showView('login');
    return;
  }

  setUser(user);
  const couple = await findMyCouple(user.uid);
  if (couple) setCouple(couple.coupleId, couple.members);

  await enterApp();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.error('Registrazione SW fallita', err));
}
