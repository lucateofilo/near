import { auth } from './firebase-config.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

export function watchAuth(callback) {
  onAuthStateChanged(auth, callback);
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signup(email, password) {
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}
