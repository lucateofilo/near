import { watchAuth, login, signup, logout } from './auth.js';
import { auth } from './firebase-config.js';
import { findMyCouple, generatePairingCode, redeemPairingCode } from './pairing.js';
import { state, setUser, setCouple, reset } from './state.js';
import { showView, toast, formatDate } from './ui.js';
import { uploadPhoto, listPhotos, reactToPhoto } from './firestore-photos.js';
import { sendNote, listNotes } from './firestore-notes.js';
import { SETTINGS_DEFS, getSettings, setSetting } from './settings.js';
import { computeStreak } from './streak.js';
import { addEvent, listEvents, daysUntil } from './calendar.js';
import { createTrip, listTrips, getTripDays, updateDayPlan, uploadDayPhoto } from './travel-mode.js';
import { SILENT_DURATIONS, activateSilentMode, deactivateSilentMode, isSilentActive } from './silent-mode.js';
import { enableNotifications } from './fcm-client.js';

const REACTION_EMOJIS = ['❤️', '🤍', '😍', '😂', '😮'];

let currentSettings = null;

// ---------- Splash iniziale ----------
// Copre lo schermo finché Firebase Auth non ha risolto lo stato, evitando il
// flash della schermata di login prima che scatti la vista corretta. Si
// dissolve con un semplice fade, senza animazioni di posizione/scala.
let splashPlayed = false;
function dismissSplash() {
  if (splashPlayed) return;
  splashPlayed = true;
  const splash = document.getElementById('splash');
  requestAnimationFrame(() => splash.classList.add('splash-fading'));
  setTimeout(() => splash.classList.add('hidden'), 450);
}

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
    renderSettings();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- Navigazione ----------

document.querySelectorAll('#mainNav button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('#mainNav button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;

    if (!state.coupleId) {
      const couple = await findMyCouple(state.user.uid);
      if (couple) setCouple(couple.coupleId, couple.members);
    }

    showView(view);
    if (view === 'home') renderHome();
    if (view === 'notes') renderNotes();
    if (view === 'travel') renderTravel();
    if (view === 'settings') renderSettings();
  });
});

// ---------- Home / Foto ----------

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await uploadPhoto(state.coupleId, state.user.uid, file, { withLocation: currentSettings?.memoryMapEnabled ?? true });
    toast('Foto pubblicata!');
    renderHome();
  } catch (err) {
    toast('Errore durante la pubblicazione della foto.');
    console.error(err);
  } finally {
    e.target.value = '';
  }
});

async function renderHome() {
  const captureLabel = document.querySelector('#view-home .capture-btn');
  const wrap = document.getElementById('photosList');

  if (!state.coupleId) {
    captureLabel.classList.add('hidden');
    wrap.innerHTML = '<p>Abbinati al tuo partner dalle Impostazioni per iniziare a scattare foto insieme.</p>';
    return;
  }
  captureLabel.classList.remove('hidden');

  const photos = await listPhotos(state.coupleId);
  wrap.innerHTML = photos.map((p) => `
    <div class="photo-card">
      <img src="${p.imageUrl}" alt="Foto" loading="lazy">
      <div class="photo-meta">
        <span>${formatDate(p.takenAt?.toDate?.() ?? p.takenAt)}</span>
        <span class="status-badge status-${p.status}">${p.status === 'on_time' ? 'Puntuale' : 'In ritardo'}</span>
      </div>
      <div class="reactions-row" data-photo-id="${p.id}">
        ${REACTION_EMOJIS.map((em) => `<button data-emoji="${em}">${em}</button>`).join('')}
      </div>
    </div>
  `).join('') || '<p>Ancora nessuna foto. Aspettate la prossima notifica!</p>';

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

document.getElementById('noteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const textarea = document.getElementById('noteText');
  await sendNote(state.coupleId, state.user.uid, textarea.value);
  textarea.value = '';
  renderNotes();
});

async function renderNotes() {
  const noteForm = document.getElementById('noteForm');
  const wrap = document.getElementById('notesList');

  if (!state.coupleId) {
    noteForm.classList.add('hidden');
    wrap.innerHTML = '<p>Abbinati al tuo partner dalle Impostazioni per iniziare a scambiarvi bigliettini.</p>';
    return;
  }
  noteForm.classList.remove('hidden');

  const notes = await listNotes(state.coupleId);
  wrap.innerHTML = notes.map((n) => `
    <div class="note-card">
      <p>${escapeHtml(n.text)}</p>
      <div class="note-meta">${n.uid === state.user.uid ? 'Tu' : 'Il tuo partner'} · ${formatDate(n.createdAt?.toDate?.() ?? n.createdAt)}</div>
    </div>
  `).join('') || '<p>Nessun bigliettino ancora.</p>';
}

// ---------- Impostazioni ----------

async function renderSettings() {
  const pairedStatus = document.getElementById('pairedStatus');
  const pairingForms = document.getElementById('pairingForms');
  const pairedOnly = document.getElementById('pairedOnlySettings');

  if (!state.coupleId) {
    pairedStatus.classList.add('hidden');
    pairingForms.classList.remove('hidden');
    pairedOnly.classList.add('hidden');
    return;
  }

  pairedStatus.classList.remove('hidden');
  pairingForms.classList.add('hidden');
  pairedOnly.classList.remove('hidden');

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
  renderEvents();
  renderStreak();
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

// ---------- Calendario ----------

document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const recurring = document.getElementById('eventRecurring').checked;
  if (!title || !date) return;
  await addEvent(state.coupleId, title, date, recurring);
  document.getElementById('eventForm').reset();
  document.getElementById('eventRecurring').checked = true;
  renderEvents();
});

async function renderEvents() {
  const events = await listEvents(state.coupleId);
  const wrap = document.getElementById('eventsList');
  wrap.innerHTML = events.map((ev) => `
    <div class="event-card">
      <strong>${escapeHtml(ev.title)}</strong>
      <p>${daysUntil(ev.date, ev.recurring)} giorni</p>
    </div>
  `).join('') || '<p>Nessun evento ancora.</p>';
}

async function renderStreak() {
  const photos = await listPhotos(state.coupleId);
  const streak = computeStreak(photos);
  document.getElementById('streakCount').textContent = `${streak} ${streak === 1 ? 'giorno' : 'giorni'} consecutivi`;
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

document.getElementById('newTripBtn').addEventListener('click', renderNewTripForm);

function renderNewTripForm() {
  const detail = document.getElementById('tripDetail');
  detail.classList.remove('hidden');
  detail.innerHTML = `
    <form id="tripForm">
      <h2>Nuovo viaggio</h2>
      <input type="text" id="tripName" placeholder="Nome / destinazione" required>
      <input type="date" id="tripStartDate" required>
      <input type="number" id="tripDays" placeholder="Numero di giorni" min="1" max="60" required>
      <label><input type="checkbox" id="tripPause"> Sospendi le notifiche random durante il viaggio</label>
      <button type="submit">Crea</button>
      <button type="button" id="tripCancelBtn">Annulla</button>
    </form>
  `;
  document.getElementById('tripCancelBtn').addEventListener('click', () => {
    detail.classList.add('hidden');
    detail.innerHTML = '';
  });
  document.getElementById('tripForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tripName').value.trim();
    const startDate = document.getElementById('tripStartDate').value;
    const days = Number(document.getElementById('tripDays').value);
    const randomNotificationsPaused = document.getElementById('tripPause').checked;
    const tripId = await createTrip(state.coupleId, {
      name, destination: name, days, randomNotificationsPaused, startDate, createdBy: state.user.uid,
    });
    detail.classList.add('hidden');
    detail.innerHTML = '';
    renderTravel();
    openTrip(tripId);
  });
}

async function renderTravel() {
  const newTripBtn = document.getElementById('newTripBtn');
  const wrap = document.getElementById('tripsList');

  if (!state.coupleId) {
    newTripBtn.classList.add('hidden');
    wrap.innerHTML = '<p>Abbinati al tuo partner dalle Impostazioni per pianificare un viaggio insieme.</p>';
    return;
  }
  newTripBtn.classList.remove('hidden');

  const trips = await listTrips(state.coupleId);
  wrap.innerHTML = trips.map((t) => `
    <div class="trip-card" data-trip-id="${t.id}">
      <strong>${escapeHtml(t.name)}</strong>
      <p>${t.days} giorni · dal ${t.startDate}</p>
      <button data-open="${t.id}">Apri</button>
    </div>
  `).join('') || '<p>Nessun viaggio ancora.</p>';

  wrap.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openTrip(btn.dataset.open));
  });
}

async function openTrip(tripId) {
  const days = await getTripDays(state.coupleId, tripId);
  const detail = document.getElementById('tripDetail');
  detail.classList.remove('hidden');

  detail.innerHTML = `
    <button id="tripBackBtn">← Torna ai viaggi</button>
    ${days.map((d) => `
      <div class="day-card">
        <h2>Giorno ${d.dayIndex + 1}</h2>
        <textarea data-day="${d.dayIndex}" placeholder="Cosa farete questo giorno?">${escapeHtml(d.plan || '')}</textarea>
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
  document.getElementById('mainNav').classList.remove('hidden');

  if (state.coupleId) {
    currentSettings = await getSettings(state.coupleId, state.user.uid);
  } else {
    currentSettings = null;
  }
  updateQuietFabVisibility();

  document.querySelectorAll('#mainNav button').forEach((b) => b.classList.remove('active'));
  document.querySelector('#mainNav button[data-view="home"]').classList.add('active');
  showView('home');
  dismissSplash();
  renderHome();
}

let firstAuthCheckDone = false;

watchAuth(async (user) => {
  if (!firstAuthCheckDone) {
    // Firebase può emettere un primo evento transitorio (es. null) prima di
    // aver finito di ripristinare la sessione salvata: aspettiamo lo stato
    // definitivo per evitare che login/splash sbaglino la vista iniziale.
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
    document.getElementById('mainNav').classList.add('hidden');
    document.getElementById('quietModeBtn').classList.add('hidden');
    showView('login');
    dismissSplash();
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
