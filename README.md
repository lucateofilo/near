# Near

PWA di coppia: quattro volte al giorno, a orari casuali, una notifica chiede a entrambi i partner di scattare una foto. Bigliettini, calendario anniversari, mappa dei ricordi, streak giornaliero, modalità silenziosa e modalità viaggio.

Stack: HTML/CSS/JS vanilla (nessun bundler), Firebase (Auth, Firestore, Cloud Messaging), Cloudinary (storage foto), GitHub Pages + GitHub Actions (deploy e scheduler notifiche).

## Setup

1. **Firebase**: crea un progetto su [console.firebase.google.com](https://console.firebase.google.com), attiva Authentication (Email/Password) e Firestore Database. Copia la configurazione Web App in `js/firebase-config.js` **e** in `firebase-messaging-sw.js`.
2. **Cloudinary**: crea un account gratuito su [cloudinary.com](https://cloudinary.com), crea un **upload preset "Unsigned"**, copia `cloud_name` e nome del preset in `js/cloudinary-config.js`.
3. **Push**: genera una VAPID key (Firebase Console → Project Settings → Cloud Messaging) e incollala in `js/firebase-config.js`.
4. **Security rules**: `npm install -g firebase-tools && firebase login && firebase deploy --only firestore:rules` (usa `firestore.rules` già presente nel repo).
5. **GitHub Actions**: crea il secret `FIREBASE_SERVICE_ACCOUNT_KEY` (Settings → Secrets → Actions) con il JSON di un Service Account (Firebase Console → Project Settings → Service accounts → Generate new private key). Imposta GitHub Pages su "Source: GitHub Actions".
6. Apri l'app su iPhone (Safari, iOS ≥ 16.4), "Condividi → Aggiungi a Home", apri dalla home screen e accedi. Il primo utente genera un codice in fase di login, il secondo lo inserisce per accoppiarsi.

Nessun passaggio richiede carta di credito: lo scheduling delle notifiche gira su GitHub Actions (cron gratuito), le foto su Cloudinary (tier gratuito).
