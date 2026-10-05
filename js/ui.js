const VIEWS = ['login', 'pairing', 'home', 'notes', 'travel', 'settings'];

export function showView(name) {
  for (const v of VIEWS) {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== name);
  }
  document.getElementById('mainNav').classList.toggle('hidden', name === 'login' || name === 'pairing');
}

let toastTimer = null;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
}

export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
