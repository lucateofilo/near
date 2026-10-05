# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui. Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

## 2026-10-05

### Aggiunto
- Scaffold iniziale dell'app: PWA vanilla HTML/CSS/JS, Firebase (Auth, Firestore, Cloud Messaging), Cloudinary per lo storage foto (al posto di Firebase Storage, che richiede piano Blaze anche solo per l'attivazione).
- Flusso di abbinamento coppia tramite codice generato in-app (niente creazione manuale utenti/documenti in console): registrazione libera + abbinamento opzionale, spostato dentro Impostazioni, non più un gate bloccante al primo accesso.
- Scheduler Node (`scripts/notify-scheduler.mjs`) su GitHub Actions a cron (ogni 5 minuti): genera le 4 notifiche random giornaliere (09:00–02:00, gap minimo 3h, fuso Europe/Rome calcolato con API Intl native), invia i push di foto/bigliettini in coda, rispetta modalità silenziosa e pausa viaggio. Nessuna Cloud Function, per restare a costo zero.
- Pulizia automatica dei pairing code: quelli non riscattati entro 15 minuti vengono cancellati dallo scheduler, evitando l'accumulo infinito in Firestore.
- Icone SVG a tratto al posto delle emoji in nav, pulsante scatto foto e modalità silenziosa.
- Splash screen iniziale (sfondo salvia, "Near" in bianco) che copre lo schermo finché Firebase Auth non ha risolto lo stato, eliminando il flash della schermata di login per utenti già autenticati.
- Deploy automatico su GitHub Pages via GitHub Actions ad ogni push su `main`.

### Corretto
- Header `position: sticky` → `position: fixed`: evitava che il contenuto sottostante "saltasse" quando l'header compariva dopo il login, causando testo tagliato/sovrapposto.
- Service worker senza `skipWaiting()`/`clients.claim()`: un nuovo service worker restava in stato "waiting" finché tutte le istanze della pagina non venivano chiuse, quindi gli aggiornamenti non si vedevano con un semplice reload.
- `onAuthStateChanged` può emettere un primo evento transitorio (`user: null`) prima di aver finito di ripristinare la sessione salvata: intercettato ora con `auth.authStateReady()` per evitare che lo splash sparisse mostrando per un istante il login anche a chi era già autenticato.

### Note architetturali
- Nessun backend custom: Firebase (Auth/Firestore/FCM) + Cloudinary (foto) + GitHub Actions (scheduler) coprono tutto il necessario a costo zero.
- Le notifiche "foto pubblicata"/"nuovo bigliettino" non sono istantanee: hanno un ritardo massimo di ~5 minuti, legato alla granularità del cron GitHub Actions (compromesso accettato per restare gratuiti, l'alternativa sarebbe Cloud Functions su piano Blaze).
- Repository pubblico: necessario per GitHub Pages gratuito (i repo privati richiedono GitHub Pro). La privacy di foto e bigliettini è garantita dalle Firestore Security Rules, non dalla segretezza del codice.
