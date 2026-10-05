import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { uploadToCloudinary } from './cloudinary-config.js';

// Colore dell'avatar di default: derivato dall'uid, niente da salvare né
// scegliere finché l'utente non carica una foto propria.
const AVATAR_COLORS = ['#9CAF88', '#C8B6E2', '#C97B63', '#E3B23C', '#6FA8AE', '#D98BA5'];

function colorForUid(uid) {
  let hash = 0;
  for (const ch of uid) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initialsFrom(name, email) {
  const source = (name || '').trim() || (email || '').split('@')[0] || '?';
  const words = source.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || source[0].toUpperCase();
}

export async function getProfile(uid, fallbackEmail = '') {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.exists() ? snap.data() : {};
  return {
    name: data.name || '',
    avatarUrl: data.avatarUrl || null,
    color: colorForUid(uid),
    initials: initialsFrom(data.name, fallbackEmail),
  };
}

export async function saveProfileName(uid, name) {
  await setDoc(doc(db, 'users', uid), { name }, { merge: true });
}

export async function uploadAvatar(uid, file) {
  const avatarUrl = await uploadToCloudinary(file, `users/${uid}/avatar`);
  await setDoc(doc(db, 'users', uid), { avatarUrl }, { merge: true });
  return avatarUrl;
}

export function avatarHtml(profile, size = 40) {
  const style = `width:${size}px;height:${size}px;font-size:${size * 0.4}px`;
  return profile.avatarUrl
    ? `<img class="avatar" style="${style}" src="${profile.avatarUrl}" alt="">`
    : `<div class="avatar" style="${style};background:${profile.color}">${profile.initials}</div>`;
}

// Scrive l'avatar dentro un elemento esistente (invece di sostituirlo),
// così i listener già attaccati al suo contenitore restano validi.
export function renderAvatarInto(el, profile, size = 40) {
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  if (profile.avatarUrl) {
    el.style.background = 'none';
    el.textContent = '';
    el.innerHTML = `<img src="${profile.avatarUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  } else {
    el.style.background = profile.color;
    el.style.fontSize = `${size * 0.4}px`;
    el.innerHTML = '';
    el.textContent = profile.initials;
  }
}
