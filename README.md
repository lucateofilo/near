# Near

PWA di coppia: quattro volte al giorno, a orari casuali, una notifica chiede a entrambi i partner di scattare una foto. Bigliettini, calendario anniversari, mappa dei ricordi, streak giornaliero, modalità silenziosa e modalità viaggio.

Stack: HTML/CSS/JS vanilla (nessun bundler), Firebase (Auth, Firestore, Cloud Messaging), Cloudinary (storage foto), GitHub Pages + GitHub Actions (deploy e scheduler notifiche).

## Setup

1. **Firebase**: crea un progetto su [console.firebase.google.com](https://console.firebase.google.com), attiva Authentication (Email/Password) e Firestore Database (modalità Produzione). Copia la configurazione Web App in `js/firebase-config.js` **e** in `sw.js` (vanno tenuti sincronizzati a mano, il service worker non può importare moduli ES di terze parti in modo affidabile su iOS).
2. **Cloudinary**: crea un account gratuito su [cloudinary.com](https://cloudinary.com), crea un **upload preset "Unsigned"** (Settings → Upload → Upload presets — occhio al preset `ml_default` di default, che nasce "Signed" e va cambiato), copia `cloud_name` e nome del preset in `js/cloudinary-config.js`.
3. **Push**: genera una VAPID key (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates) e incollala in `js/firebase-config.js`.
4. **Security rules**: `npm install -g firebase-tools && firebase login && firebase deploy --only firestore:rules` (usa `firestore.rules` già presente nel repo, serve anche `.firebaserc`/`firebase.json` già nel repo).
5. **GitHub Actions**: crea il secret `FIREBASE_SERVICE_ACCOUNT_KEY` (Settings → Secrets and variables → Actions) con il JSON di un Service Account (Firebase Console → Project Settings → Service accounts → Generate new private key). Non committarlo mai nel repo.
6. **GitHub Pages**: il repository deve essere **pubblico** (Pages gratuito non è disponibile su repo privati). Settings → Pages → Source: "GitHub Actions". Se il push fallisce con un errore sullo scope `workflow`, lancia `gh auth refresh -h github.com -s workflow`.
7. **Cron esterno per le notifiche (obbligatorio)**: il trigger `schedule:` nativo di GitHub Actions non è affidabile (su repo pubblici a bassa attività può ritardare anche ore, facendo arrivare le notifiche del giorno tutte insieme invece che distribuite). Crea un account gratuito su [cron-job.org](https://cron-job.org), un token GitHub fine-grained (scope Actions: Read and write, solo su questo repo) e un cronjob ogni 5 minuti che fa `POST` a `https://api.github.com/repos/<owner>/<repo>/actions/workflows/notify-scheduler.yml/dispatches` con header `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `Content-Type: application/json` e body `{"ref":"main"}`. Il trigger `schedule:` resta nel workflow come backup ridondante ma innocuo.
8. Apri l'app su iPhone (Safari, iOS ≥ 16.4), "Condividi → Aggiungi a Home", apri dalla home screen e registrati. Il primo utente genera un codice dalle Impostazioni, il secondo lo inserisce per accoppiarsi — l'app è comunque utilizzabile anche prima dell'abbinamento (foto/bigliettini/viaggio restano bloccati finché non ci si accoppia).

Nessun passaggio richiede carta di credito: lo scheduling delle notifiche gira su GitHub Actions triggerato da cron-job.org (entrambi gratuiti), le foto su Cloudinary (tier gratuito). Trade-off accettato: le notifiche "foto pubblicata"/"nuovo bigliettino" hanno un ritardo massimo di ~5 minuti invece di essere istantanee.

Dopo ogni modifica a `css/style.css`, `index.html` o agli altri file elencati in `SHELL_FILES` dentro `sw.js`: incrementa `CACHE_NAME` (es. `near-shell-v8` → `v9`), altrimenti chi ha già la PWA installata continua a vedere la versione cacheata finché non si libera cache a mano. I file in `js/` non sono cacheati dal service worker, si aggiornano sempre da soli.

Vedi `CHANGELOG.md` per la cronologia delle modifiche.
