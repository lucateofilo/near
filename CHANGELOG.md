# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui. Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

## 2026-10-05

### Corretto (3)
- Selfie salvati specchiati: molti browser mobile (es. Chrome su Android) consegnano lo stream della fotocamera frontale già specchiato a livello di driver. Lo scatto veniva disegnato così com'era, quindi il file finale usciva ribaltato rispetto alla realtà. Ora il frame frontale viene riflesso di nuovo in fase di cattura, cosi' il selfie salvato corrisponde a come si è stati fotografati davvero.
- Etichetta del countdown nel pannello Ricordi: "Prossimo anniversario" → "Prossimo evento" (il countdown copre qualunque evento aggiunto, non solo gli anniversari).

### Aggiunto (4) — eliminazione con conferma
- Foto, bigliettini, eventi del calendario e viaggi sono ora eliminabili (ciascuno con una richiesta di conferma prima di procedere, nessuna eliminazione è reversibile). Foto e bigliettini solo dal proprio autore; eventi e viaggi da entrambi i partner, essendo condivisi fin dalla creazione.
- Aggiornate le Firestore Security Rules: `photos` e `notes` permettevano solo creazione, mai eliminazione; ora consentono il delete esclusivamente all'autore del documento. Pubblicato in produzione.
- Eliminare un viaggio cancella anche tutti i documenti "giorno" nella sua sottocollection, che Firestore non elimina in cascata da solo.
- L'immagine su Cloudinary non viene cancellata quando si elimina una foto (upload non firmato, nessun segreto lato client per farlo via API): resta un file orfano, scelta coerente con l'architettura "zero backend" del progetto.

### Aggiunto (3) — pannello "Ricordi"
- Nuovo pannello laterale (icona a stella in header, scorre da destra) con streak, countdown del prossimo anniversario e la foto di un anno fa — dati da sbirciare, non da gestire, prima erano sepolti in Impostazioni (lo streak) o assenti del tutto (il ricordo). La home resta pulita, le Impostazioni restano la pagina di gestione (form evento, abbinamento), non quella di consultazione.
- Streak e countdown nel pannello rispettano i toggle già esistenti `streakEnabled`/`calendarEnabled` in Impostazioni, prima presenti solo nella UI ma senza alcun effetto reale.
- Ricordo "un anno fa": se in quella data (civile, fuso Roma) esiste una foto pubblicata, viene mostrata nel pannello. Nuova query dedicata (`getPhotosByDate`) perché la lista foto normale è limitata agli ultimi 100 scatti e non arriva mai così indietro.
- Bigliettini con "✓ Letto": quando apri la vista Bigliettini, quelli del partner non ancora letti vengono marcati; i tuoi mostrano la spunta quando il partner li ha visti. Richiesto un aggiornamento alle Firestore Security Rules (`notes` permetteva zero update): ora il solo update ammesso è il destinatario che tocca esclusivamente il campo `readBy`, pubblicato in produzione.

### Rimosso
- Splash screen iniziale ("Near" a schermo intero): causava due problemi, entrambi legati al fatto che la sezione di login sotto lo splash non era marcata `hidden` di default — i suoi campi email/password restavano quindi presenti e interattivi nel DOM anche per utenti già autenticati, e su mobile l'autofill del browser poteva metterli a fuoco da solo facendo comparire la tastiera senza che l'utente toccasse nulla. Inoltre lo splash si chiudeva solo a fine `watchAuth`/`findMyCouple`: se quella chiamata di rete restava in sospeso, lo splash restava bloccato sulla scritta "Near" a tempo indeterminato. Eliminati `#splash`, `dismissSplash()` e le regole CSS relative; la vista di login ora parte `hidden` come tutte le altre.

### Aggiunto (2) — scatto foto stile BeReal
- Scatto doppio in-app (camera posteriore + selfie in sequenza, via `js/camera-capture.js` e un overlay fullscreen) al posto del semplice `<input capture>` nativo: ogni foto pubblicata salva ora `backUrl` + `frontUrl` invece del singolo `imageUrl` (fallback automatico sulle foto pubblicate col vecchio schema, nessuna migrazione dati).
- Reciprocità: le foto di oggi del partner restano nascoste finché non hai pubblicato la tua foto di oggi.
- Layout "è il momento": quando c'è uno slot notificato ancora senza foto, il pulsante di scatto cambia colore/testo per segnalarlo.
- Tap sulla miniatura selfie per scambiarla con la foto grande: entrambi gli scatti si possono vedere a piena grandezza, nessuno resta bloccato piccolo.
- Non testato in questa sessione con fotocamera/Firebase reali (ambiente senza browser grafico disponibile) — verificare lo scatto completo su dispositivo prima di considerarlo stabile.

### Corretto (2)
- Notifiche in foreground invisibili: `onMessage` (ricevuto quando l'app è già aperta) finiva solo in `console.log`, senza mostrare nulla all'utente. Ora mostra un toast col testo della notifica.
- Token FCM non registrati (`NotRegistered`, es. da reinstallazioni o vecchie registrazioni SW) restavano per sempre in `fcmTokens`, venendo ritentati a ogni invio senza successo. Lo scheduler ora li rimuove dal documento `settings` dopo un fallimento `messaging/registration-token-not-registered`.
- Scheduler senza alcun log: impossibile distinguere "nessun token salvato" da "push inviato ma non mostrato". Aggiunto logging minimo per contare invii riusciti/falliti.

### Aggiunto
- Profilo utente (nome + avatar): nuova collection `users/{uid}` con nome e foto avatar (caricata via Cloudinary come le altre foto); senza foto propria, l'avatar mostra le iniziali su un colore derivato dall'uid, nessun default da gestire manualmente. Modificabile da Impostazioni, sempre visibile anche prima dell'abbinamento.
- Card del partner in Home: avatar + nome visibili non appena si è abbinati, non solo nel testo di stato in Impostazioni.
- Scaffold iniziale dell'app: PWA vanilla HTML/CSS/JS, Firebase (Auth, Firestore, Cloud Messaging), Cloudinary per lo storage foto (al posto di Firebase Storage, che richiede piano Blaze anche solo per l'attivazione).
- Flusso di abbinamento coppia tramite codice generato in-app (niente creazione manuale utenti/documenti in console): registrazione libera + abbinamento opzionale, spostato dentro Impostazioni, non più un gate bloccante al primo accesso.
- Scheduler Node (`scripts/notify-scheduler.mjs`) su GitHub Actions a cron (ogni 5 minuti): genera le 4 notifiche random giornaliere (09:00–02:00, gap minimo 3h, fuso Europe/Rome calcolato con API Intl native), invia i push di foto/bigliettini in coda, rispetta modalità silenziosa e pausa viaggio. Nessuna Cloud Function, per restare a costo zero.
- Pulizia automatica dei pairing code: quelli non riscattati entro 15 minuti vengono cancellati dallo scheduler, evitando l'accumulo infinito in Firestore.
- Icone SVG a tratto al posto delle emoji in nav, pulsante scatto foto e modalità silenziosa.
- Splash screen iniziale (sfondo salvia, "Near" in bianco) che copre lo schermo finché Firebase Auth non ha risolto lo stato, eliminando il flash della schermata di login per utenti già autenticati.
- Deploy automatico su GitHub Pages via GitHub Actions ad ogni push su `main`.

### Corretto
- Notifiche push mai recapitate: `sw.js` (cache shell) e `firebase-messaging-sw.js` (push FCM) erano due service worker registrati sulla stessa scope `/`; ad ogni apertura dell'app `sw.js` veniva ri-registrato e con il suo `skipWaiting()` scalzava quello delle notifiche, che restava quindi attivo solo per pochi istanti dopo "Attiva notifiche push". Unita la gestione push dentro `sw.js` (unico service worker), rimosso `firebase-messaging-sw.js`.
- Layout desktop: header, nav e FAB modalità silenziosa erano `position: fixed` stirati su tutta la larghezza della finestra; da 560px in su restano ora ancorati alla stessa colonna centrale (480px) del contenuto.
- Header `position: sticky` → `position: fixed`: evitava che il contenuto sottostante "saltasse" quando l'header compariva dopo il login, causando testo tagliato/sovrapposto.
- Service worker senza `skipWaiting()`/`clients.claim()`: un nuovo service worker restava in stato "waiting" finché tutte le istanze della pagina non venivano chiuse, quindi gli aggiornamenti non si vedevano con un semplice reload.
- `onAuthStateChanged` può emettere un primo evento transitorio (`user: null`) prima di aver finito di ripristinare la sessione salvata: intercettato ora con `auth.authStateReady()` per evitare che lo splash sparisse mostrando per un istante il login anche a chi era già autenticato.

### Note architetturali
- Nessun backend custom: Firebase (Auth/Firestore/FCM) + Cloudinary (foto) + GitHub Actions (scheduler) coprono tutto il necessario a costo zero.
- Le notifiche "foto pubblicata"/"nuovo bigliettino" non sono istantanee: hanno un ritardo massimo di ~5 minuti, legato alla granularità del cron GitHub Actions (compromesso accettato per restare gratuiti, l'alternativa sarebbe Cloud Functions su piano Blaze).
- Repository pubblico: necessario per GitHub Pages gratuito (i repo privati richiedono GitHub Pro). La privacy di foto e bigliettini è garantita dalle Firestore Security Rules, non dalla segretezza del codice.
