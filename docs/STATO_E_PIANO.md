# Mangayomi Lite TV — stato e piano (14/11/2026)

> Diario storico dei primi passi. Le modifiche di ogni versione e lo stato attuale sono in `NOTE_MODIFICHE.md`.
Sorgenti app: questo repository.
Repo Mangayomi ufficiale clonato: /workspace/mly/mangayomi-src (API JS in lib/eval/javascript/*)
Estensioni di Adam scaricate: /workspace/mly/ext
Test sulla TV: sdb shell 0 debug MgyLite01A.MangayomiLite, poi sdb forward verso la porta di debug.
Build: tizen build-web -e ".*" -e README.md -e dist/* -e dist -- <app>; tizen package -t wgt -s <profilo-di-firma> -- <app>\.buildResult;
       copia "Mangayomi Lite.wgt" -> MangayomiLite.wgt; tizen install -n MangayomiLite.wgt -s <tv>:26101 -- <dir>

Fase 1 FATTA: CSP (unsafe-eval) in config.xml v0.1.1, AnimeWorld verificato sulla TV (lista, dettaglio 1180 ep, video 1280x720 in riproduzione).
Fase 2: adapter fedele all'originale (Element "vuoto" truthy come Mangayomi, text grezzo, getElementsBy*, getElementById,
        sibling, xpath base, substring* helpers, console.*, Client(reqcopyWith), risposta {body,statusCode,headers,request},
        SharedPreferences get/getString/setString con default da getSourcePreferences, parseDates, unpackJs).
Fase 3: UI come Mangayomi: barra laterale Libreria / Aggiornamenti / Cronologia / Sfoglia(Sorgenti, Estensioni, Migra) / Altro(Impostazioni),
        Sorgente: tab Popolare / Ultimi + Cerca + Filtri (getFilterList), Impostazioni sorgente (getSourcePreferences),
        dettaglio anime (copertina, generi, stato, descrizione, Aggiungi alla libreria, lista episodi, segna visto),
        player (selezione qualità/server, avanti/indietro, episodio successivo).
Fase 4: Estensioni: installa/aggiorna/disinstalla dal repo (anime_index.json), cache codice in localStorage, NSFW filtrabile.
Fase 5: estrattori video (linkuniversale usa 12 extractor nativi di Mangayomi) portati in JS dove possibile.
Limiti TV: niente WebView/login (evaluateJavascriptViaWebview), Cookie/Set-Cookie/User-Agent/Referer non impostabili/leggibili via XHR,
           nessun proxy HLS con header, nessun superamento Cloudflare/anti-bot.

## Aggiornamento 14/11/2026 15:30 (ora di Roma) — v0.2.0 installata sulla TV

- **Divisione del lavoro:** il port completo dell'interfaccia (Fase 3 e oltre) lo fa un agente Cursor in un repo separato. La v0.2.0 è la versione ponte.
- **Sorgente:**
  - Copia di lavoro locale, separata da questo repository. Il backup della v0.1.1 resta solo sul PC.
- **Firma e installazione:**
  - Firmata in locale con il profilo di firma della TV e installata sulla TV.
  - Il pacchetto si chiama ora `Mangayomi.wgt`; viene copiato in `MangayomiLite.wgt` prima dell'installazione.
  - App id invariato: `MgyLite01A.MangayomiLite`.
- **Adapter (Fase 2):**
  - Port di `lib/eval/javascript/*` in `js/bridge/`: dom_selector, http, preferences, utils, js_common, service.
  - Gli estrattori nativi di `extractors.dart` sono ancora stub. Andranno portati nella Fase 5.
- **Cosa cambia per l'utente:**
  - All'avvio si apre la Biblioteca.
  - Scegliendo una sorgente si apre subito Popolare. Più recente e la ricerca sono schede dentro la sorgente.
  - Alla prima apertura vengono installate in automatico AnimeWorld e PMVHaven.
- **Verificato sulla TV via CDP:**

  | Sorgente | Popolare | Ricerca | Dettaglio | Video |
  |---|---|---|---|---|
  | PMVHaven | 32 | «anime» → 20 | OK | HLS `<video>`, nessun errore |
  | AnimeWorld | 40 | «naruto» → 37 | 293 ep. | MP4 1280x720, nessun errore |

  Indietro e cronologia funzionano. I dati dei test sono stati rimossi dalla cronologia.
- **Da fare:**
  - test delle altre estensioni sulla TV (sul server: HentaiWorld OK, Link universale e Stripchat parziali, HypnoTube, Chaturbate e BongaCams no);
  - installare la versione dell'agente Cursor quando sarà pronta.
- **Strumenti di test:** script locale via CDP (`<porta> <Sorgente> <query>`).

## Aggiornamento 14/11/2026 15:36 (ora di Roma): v0.2.1 installata sulla TV

### Player
- Parte sempre alla qualità massima: legge il master m3u8 e riproduce la variante con la risoluzione più alta (poi il bitrate più alto). Niente Auto.
- Verificato sulla TV con PMVHaven: il master offre 1080/720/480/360, l'app riproduce la variante `_1080p.m3u8` a 1920x1080, senza errori.

### Griglia (cause misurate sulla TV)
- Cause trovate:
  - copertine PMVHaven a 1920x1080, decodificate a piena risoluzione;
  - transizioni su box-shadow e transform;
  - blur sull'hero della Biblioteca.
- Correzioni:
  - copertine caricate quando entrano in vista (IntersectionObserver), al massimo 3 alla volta, ridotte con createImageBitmap a un'altezza di 330 px e messe in cache come blob;
  - niente transizioni e niente blur;
  - focus con `::after` invece di box-shadow;
  - `content-visibility:auto` sulle schede;
  - al massimo uno spostamento per frame.
- Stessa sequenza di 30 tasti nella griglia PMVHaven, prima → dopo:

  | Misura | Prima | Dopo |
  |---|---|---|
  | Frame medio | 51,1 ms (19,6 fps) | 25,3 ms (39,5 fps) |
  | Frame p95 | 116,6 ms | 50 ms |
  | Frame massimo | 2267 ms | 817 ms |
  | Frame oltre 50 ms | 32 | 18 |
  | Long task | 34 (10,97 s) | 9 (1,30 s) |
  | Latenza tasto media | 58,7 ms | 49,4 ms |
  | Latenza tasto p95 | 183 ms | 188 ms (invariata) |

### Estensioni
- Sulla TV l'indice è letto correttamente: 8 voci, nessun errore, nessun filtro attivo. L'elenco mostra 2 installate e 6 disponibili.
- Il caso «una sola estensione» non si è riprodotto.
- Aggiunte:
  - aggiornamento in background dell'indice se ha più di 10 minuti;
  - conferma prima di Disinstalla.

## v0.3.1: versione completa (agente Cursor), installata il 14/11/2026 verso le 15:52 (ora di Roma)
- Sorgente: questo repository (vedi NOTE_MODIFICHE.md). Le copie sul PC restano fuori dal repository.
- Pacchetto firmato in locale. Per il rollback alla 0.2.1, dato che la versione è più bassa, probabilmente bisogna prima disinstallare.
- Correzioni fatte:
  - id/versione nel config, per sostituire la v0.2.1;
  - la cronologia scarta le voci rimaste dalla v0.1 ("undefined / undefined");
  - scorrimento infinito nella griglia di una sorgente.
- Verificato sulla TV:
  - all'avvio si apre la Libreria;
  - si vedono le 8 estensioni dal repo GitHub;
  - le sorgenti si aprono su Popular;
  - PMVHaven: ricerca, dettaglio e riproduzione a 1920x1080 ("1080p");
  - AnimeWorld riproduce a 1280x720;
  - nessun errore in console.
- Fluidità nella griglia PMV (33 tasti, con l'app già calda): frame medio 17,6-19,4 ms, p95 16,7 ms, latenza p95 35-50 ms. Nella v0.2.1 erano 25,3 ms, 50 ms e 188 ms. Restano qualche long task (6, per 1,2-2,3 s in totale) e rari scatti isolati fino a 0,9 s.
- Problemi ancora aperti:
  - interfaccia in inglese;
  - "Su" dal pulsante "Load more" va alle pill;
  - "Play" di AnimeWorld parte dall'ultimo episodio (1180);
  - le miniature di PMVHaven arrivano fino a 2560x1440, pesanti da decodificare.

## v0.3.2: pronta e firmata il 14/11/2026 verso le 16:05 (ora di Roma), NON ancora installata sulla TV
- Pacchetto firmato in locale. La copia della 0.3.1 resta sul PC, fuori dal repository.
- Sul box: /workspace/mly/full/mangayomi; la copia della 0.3.1 è in /workspace/mly/full-0.3.1-backup.
- Novità (dettagli in NOTE_MODIFICHE.md):
  - Riprendi/Continua come in Mangayomi;
  - modalità adulti nascosta (0×5, oppure Su×5 su Libreria nella barra laterale; all'avvio è sempre nascosta);
  - interfaccia in italiano;
  - "Su" da "Carica altro" torna alla griglia;
  - miniature PMVHaven più leggere (thumb_md).
- Test su Chromium headless del box: 40/40 superati (tools/v032test.mjs).
- Per installarla serve il via libera di Adam: `tizen install -n MangayomiFull-0.3.2.wgt -s <tv>:26101`.

## v0.3.3: installata sulla TV il 14/11/2026 verso le 16:18 (ora di Roma)
- Pacchetto firmato in locale. Le versioni precedenti restano sul PC, fuori dal repository.
- Correzioni rispetto alla 0.3.2, emerse dalla prova sulla TV:
  - aggiunto il privilegio tv.inputdevice: senza, i tasti numerici davano "Permission denied";
  - le copertine "custom" di PMVHaven, grandi fino a 4K, ora usano la versione webp a 480x270: prima la griglia si bloccava fino a 4 s.
- Verificato sulla TV:
  - interfaccia in italiano e avvio su Libreria;
  - modalità adulti con 0×5 e con Su×5 (tasti inviati via CDP), nascosta di nuovo dopo il riavvio; i tasti 0-9 sono registrati;
  - One Piece: "Inizia · Ep. 1" → Ep_0001, "Riprendi Ep. 1 · 2:12" riparte a 133 s, oltre il 90% → "Continua Ep. 2" e "✓ Visto";
  - PMVHaven: 40 elementi, ricerca "anime" 20 risultati, video 1920x1080;
  - JAV Guru 1.0.0: Popolari 30, Ultimi 20, ricerca 21, video 1920x1080.
- Fluidità nella griglia PMV, frame medio 17,4 ms e massimo 150-167 ms (0.3.1: 17,6-19,4 ms e 266-883 ms).
- All'uscita la cronologia e i progressi sono vuoti; estensioni installate: AnimeWorld, PMVHaven, JAV Guru.

## v0.3.4: installata sulla TV il 14/11/2026 verso le 16:45 (ora di Roma), provata con i tasti veri del telecomando di rete
- Telecomando di rete abbinato: Adam ha premuto Consenti. Il token resta solo sul PC, nel file ignorato da git `tv-remote-token.txt`.
- Script: `tools/tv-remote.mjs` (comandi pair, key, keys, launch, status). Vuole `TV_IP` e il pacchetto npm "ws" nella stessa cartella.
- Il WebSocket integrato di Node apriva la connessione ma la TV non mostrava mai la richiesta di consenso. Con la libreria "ws" (compressione disattivata, sdb disconnesso) ha funzionato subito.
- Verificato con i tasti veri:
  - 0×5 attiva e disattiva la modalità adulti (PMVHaven e JAV Guru compaiono e spariscono da Sfoglia);
  - Su×5 su "Libreria" nella barra laterale fa lo stesso;
  - frecce, OK e Indietro funzionano; Indietro torna alla schermata precedente;
  - alla radice Indietro non chiude l'app;
  - l'avvio da Home con REST /api/v2/applications/<id> funziona.
- Correzioni della 0.3.4:
  - "Sinistra" verso la barra laterale va sulla scheda selezionata e non cambia scheda;
  - dopo 0×5 il focus resta sulla barra laterale.
- Nota: se l'app è già aperta normalmente, `sdb shell 0 debug` si blocca; prima bisogna chiuderla con was_kill.

## v0.3.5: pronta nei test headless, NON installata sulla TV
- Conferma prima di disinstallare un'estensione. I pulsanti delle Estensioni si raggiungono con il telecomando. Entrando in una sorgente il focus va su Popolari e poi sulla prima copertina, non su Cerca.
- Copertine come la griglia compatta di Mangayomi, con il titolo sopra la sfumatura in Sfoglia, ricerca e Libreria.
- Lettore: titolo in alto, barra dei tempi, fila di comandi con «+85 s Salta intro» e Qualità in un pannello in basso. I comandi si nascondono dopo 3 secondi durante la riproduzione. Parte la qualità più alta. All'avvio non c'è il selettore qualità e non c'è il cartellino «AnimeWorld».
- Icona: Aniyomi 512×512 (`icon.png`, licenza Apache-2.0 in `THIRD_PARTY_NOTICES.md`).
- Stripchat: se il flusso è il filmato da circa 12 secondi «Find the real thing on STRIPCHAT.COM» (stanza privata o offline), il lettore non lo avvia e mostra «Stanza privata o offline». Una diretta pubblica non cambia. L'HD protetto non si aggira.
- JAV Guru e HypnoTube si correggono nelle estensioni, non in questa app: il clip di prova da 10 secondi e «Popolari = Ultimi» non dipendono dall'interfaccia.
- Da firmare e installare solo con il via libera di Adam. Il pacchetto precedente non contiene queste modifiche.
