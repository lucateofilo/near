# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui. Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

## 2026-10-09

### Aggiunto — zoom e flash nello scatto foto
- `camera-capture.js` espone `getZoomCapability`/`setZoom` e `hasTorch`/`setTorch` via `track.applyConstraints` (nessuna libreria, è nativo di `MediaStreamTrack`). L'overlay di scatto mostra uno slider zoom e un bottone flash solo se il browser/device li supporta (perlopiù Chrome Android, fotocamera posteriore) — su iOS Safari non c'è alcuna API web per la torcia, quindi il bottone resta semplicemente nascosto lì; resta il modello attuale in-app (nessun passaggio alla fotocamera di sistema).

### Aggiunto — reazioni alle foto visibili e notificate
- Le reazioni (`reactions.{uid}`) venivano salvate ma non si vedevano mai, nemmeno a chi le mandava: ora compaiono come badge sulla foto (tutte le reazioni presenti) e il bottone della propria scelta resta evidenziato. Aggiunto anche il push "ha reagito alla tua foto": `reactToPhoto` resetta `reactionNotifiedToPartner` quando a reagire è il partner (non il proprietario sulla sua stessa foto), e `notify-scheduler.mjs` lo processa con lo stesso pattern a transazione già usato per foto/note.

### Aggiunto — notifiche push linkate alla pagina giusta
- Tap su una notifica portava sempre alla home, ignorando `data.type`/`data.noteId` già presenti nel payload. `sw.js` ora passa `data: payload.data` a `showNotification` e un listener `notificationclick` apre (o porta in foreground, via `postMessage` se un tab è già aperto) la view giusta: "Bigliettini" per `note_received`, home per `photo_prompt`/`photo_published`. `app.js` espone `goToView` (estratta dal click sulla sidebar) e legge `?view=` dall'URL al bootstrap.

### Corretto — notifiche push duplicate identiche
- `notify-scheduler.yml` aveva sia il trigger `schedule:` nativo che il cron esterno su cron-job.org, entrambi ogni 5 minuti e senza alcun lock: quando le due esecuzioni si sovrapponevano, `processPendingItems` in `notify-scheduler.mjs` leggeva `notifiedToPartner == false` due volte prima che una scrittura lo marcasse `true`, inviando lo stesso push due volte (a differenza degli slot random, già protetti da transazione). Aggiunto un `concurrency` group al workflow (stesso pattern già usato in `deploy.yml`) che serializza le esecuzioni invece di farle sovrapporre: nessuna modifica allo script, il fix è solo nel trigger.

## 2026-10-06

### Aggiunto — notifiche personalizzate sul nome del partner, biglietto mostrato per intero
- Le push di "foto pubblicata" e "nuovo bigliettino" mostravano sempre testo generico ("Il tuo partner ha pubblicato una foto!", "Hai un nuovo bigliettino!"). `scripts/notify-scheduler.mjs` ora legge il nome profilo (`users/{uid}`) di chi ha pubblicato/scritto e lo usa nel testo della notifica; per i bigliettini il push mostra direttamente il contenuto del messaggio invece di un placeholder.
- Stesso trattamento lato UI: "Il tuo partner" sostituito col nome reale nella lista bigliettini e nello stato di abbinamento in Account (entrambi via `getProfile`, fallback al testo generico se il partner non ha ancora impostato un nome).

### Rinominato — Near → Nearby (solo nome visualizzato)
- Cambiato il nome mostrato in `manifest.json`, titolo pagina, header e drawer, titolo delle notifiche push. Repo GitHub, URL pubblico (`lucateofilo.github.io/near/`) e progetto Firebase (`near-f4f99`) restano invariati per scelta esplicita, nessun rischio di rompere link già condivisi.

### Aggiunto — nuova icona app e icona dedicata per le notifiche
- Sostituita l'icona placeholder (cerchio lavanda con lettera "N") con due cerchi sovrapposti salvia/lavanda, sorgente in `icons/icon.svg` (SVG, referenziato anche nel manifest) con PNG derivati per compatibilità (`icon-192.png`, `icon-512.png`).
- Aggiunta `icons/icon-notification.png` (silhouette bianca su trasparente) usata come `badge` nel service worker: su Android la vecchia icona a colori veniva comunque forzata a monocromo dal sistema nella status bar, risultando illeggibile — ora c'è un asset pensato apposta per quello. Cache dello shell bump da `v8` a `v9` per invalidare le versioni già installate.

### Corretto — cache del service worker non invalidata dall'ultimo fix CSS
- `sw.js` cachea `css/style.css` con cache-first: senza incrementare `CACHE_NAME` a ogni modifica dello shell, chi ha già la PWA installata continua a vedere la versione vecchia. Il fix CSS per lo specchiamento selfie (vedi sotto) non bumpava la versione — portata da `v7` a `v8`. Aggiunta nota in README perché non ricapiti.

### Corretto — notifiche in ritardo di ore invece che ogni 5 minuti
- Il trigger `schedule:` nativo di GitHub Actions non garantisce la cadenza impostata (`*/5 * * * *`): sui log si vedevano esecuzioni reali distanziate di 4-6 ore invece che 5 minuti, soprattutto su repo pubblici a bassa attività. Risultato: le notifiche random della giornata arrivavano tutte insieme in un'unica raffica quando il cron finalmente girava, poi silenzio per ore.
- Il workflow `notify-scheduler.yml` esponeva già un trigger `workflow_dispatch` manuale: aggiunto un cronjob esterno gratuito su cron-job.org che lo chiama via API ogni 5 minuti con un token GitHub dedicato (scope limitato ad Actions sul solo repo `near`), molto più affidabile dello `schedule:` nativo. Nessuna modifica al codice del repo, solo configurazione esterna. Il trigger `schedule:` è rimasto nel file come backup ridondante ma innocuo.

### Corretto — upload foto sempre sostituito dal primo mai caricato
- `uploadToCloudinary` inviava il file senza nome esplicito: un Blob (come quelli prodotti dalla cattura foto) viene mandato dal browser col nome letterale `blob`. Il preset `ml_default` ha `unique_filename` e `overwrite` disattivati su Cloudinary, quindi ogni upload successivo al primo con lo stesso nome/cartella veniva ignorato silenziosamente e Cloudinary restituiva sempre il primissimo file caricato — da qui il "si vede sempre la stessa foto" nonostante Firestore registrasse correttamente data/ora di ogni scatto. Back e front di uno stesso scatto collidevano anche tra loro (stessa cartella, stesso nome). Ora ogni upload riceve un nome univoco generato lato client, a prescindere dal nome originale del file.

### Corretto — scatto doppio foto (back/front)
- `startCamera` chiedeva `facingMode` come preferenza "ideale", non vincolante: se lo stream della fotocamera posteriore non si liberava abbastanza in fretta, il browser poteva continuare silenziosamente a consegnare quella invece della frontale per lo scatto "selfie", risultando in due foto della stessa camera. Ora si richiede `facingMode: { exact: ... }`, che fallisce in modo esplicito se la camera richiesta non è disponibile invece di sostituirla silenziosamente.
- La fotocamera frontale salvava lo scatto specchiato ma mostrava l'anteprima live non specchiata: incoerenza tra ciò che si vede inquadrando e il file salvato. Ora l'anteprima frontale è specchiata via CSS (classe `.mirrored` su `#captureVideo`) esattamente come lo scatto finale, comportamento coerente con una fotocamera normale.

## 2026-10-05

### Corretto — etichette visibili sui campi dei form
- Il campo data di "Nuovo evento" (Calendario) e "Nuovo viaggio" non aveva alcuna indicazione visibile di cosa fosse: solo un `aria-label` (invisibile, letto solo dagli screen reader) e, per `<input type="date">`, nessun placeholder testuale su molti browser mobile — restava una casella vuota senza senso a vista. Aggiunta una `<label>` visibile e persistente sopra ogni campo che ne aveva bisogno (titolo/data evento, nome/data/giorni viaggio, codice partner); rimossi gli `aria-label` diventati ridondanti dove ora c'è una label vera associata via `for`.

### Rifinito — form di inserimento dietro un "+"
- Bigliettini, Calendario e Viaggio mostravano il form di inserimento sempre aperto sopra la lista. Ora c'è un bottone "+" in alto a destra (ruota a "×" quando il form è aperto) in ogni pagina, coerente con lo stesso pattern già usato per i viaggi; il form si richiude da solo dopo l'invio.
- Corretti tre messaggi "Abbinati al tuo partner dalle Impostazioni..." (Home, Bigliettini, Viaggio) rimasti con un riferimento vecchio: Impostazioni non gestisce più l'abbinamento da quando è stata introdotta la pagina Account.

### Ristrutturato — navigazione a sidebar
- Sostituita la bottom nav a 4 voci con un'unica sidebar (scorre da sinistra, icona menu in header) che elenca ogni pagina una sotto l'altra: Foto, Bigliettini, Calendario, Viaggio, Ricordi, poi — separate da un divisore — Impostazioni e Account.
- "Calendario" (prima un form sepolto in fondo a Impostazioni) è ora una pagina propria.
- "Ricordi" (streak, prossimo evento, foto di un anno fa) non è più un pannello a comparsa raggiungibile da un'icona a stella: è una pagina come le altre, raggiunta dalla sidebar.
- Impostazioni divisa in due: **Impostazioni** per le sole preferenze dell'app (notifiche, i 4 toggle), **Account** per identità e abbinamento (profilo, coppia, logout — spostato qui dall'header per liberarlo).
- Tutte le pagine non ancora abbinate mostrano lo stesso messaggio di invito ad abbinarsi dalla pagina Account, coerente con Home/Bigliettini/Viaggio.
- Nessun cambiamento alla palette (sage/lavanda/crema) né al font (Fraunces per i titoli): stessa identità, diversa impalcatura.

### Rifinito — layout più curato, stessa identità romantica
- `.settings-block` non aveva mai avuto una regola CSS propria: le Impostazioni erano l'unica pagina senza le card bianche con ombra che Home/Bigliettini/Viaggio usano già, restando una lista grezza di titoli e input. Ora hanno la stessa superficie delle altre pagine.
- Zero stati `:focus` esistevano in tutto il foglio di stile: i campi non davano alcun segnale visivo quando si entrava a scriverci. Aggiunto un anello di focus (tinta sage) su input/textarea/select/bottoni, utile anche da tastiera.
- "Annulla" e "← Torna ai viaggi" avevano lo stesso peso visivo del bottone primario della stessa schermata (entrambi verde pieno). Nuova classe `.btn-secondary` (contorno, sfondo trasparente) per distinguere l'azione di uscita da quella principale.
- Aggiunti stati hover coerenti (solo su dispositivi con mouse, `@media (hover:hover)`, cosi' il tocco su mobile non resta "incollato" allo stato attivo) su bottoni, card di lista, nav in basso, popover modalità silenziosa, reazioni.
- Aggiunti `aria-label` ai campi che avevano solo un placeholder come indicazione (email, password, bigliettino, nome profilo, codice coppia, titolo/data evento, nome/data/giorni viaggio, piano del giorno) — nessuna label persistente per chi usa screen reader.
- Nessuna modifica alla logica JS: solo HTML/CSS, palette (sage/lavanda/crema) e font (Fraunces per i titoli) invariati.

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
