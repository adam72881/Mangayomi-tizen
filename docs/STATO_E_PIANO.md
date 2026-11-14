# Mangayomi Lite TV — stato e piano (14/11/2026)
Sorgenti app: box /workspace/mly/app  ==  PC C:\tizen-apps\mangayomi-lite
Repo Mangayomi ufficiale clonato: /workspace/mly/mangayomi-src (API JS in lib/eval/javascript/*)
Estensioni di Adam scaricate: /workspace/mly/ext
Test TV via DevTools: C:\tizen-apps\tools\cdp-test.mjs (sdb shell 0 debug MgyLite01A.MangayomiLite -> sdb forward tcp:9333 tcp:<porta>)
Build: tizen build-web -e ".*" -e README.md -e dist/* -e dist -- <app>; tizen package -t wgt -s Adamtv -- <app>\.buildResult;
       copia "Mangayomi Lite.wgt" -> MangayomiLite.wgt; tizen install -n MangayomiLite.wgt -s 192.168.1.3:26101 -- <dir>

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
  - box: `/workspace/mly/app2`;
  - PC: `C:\tizen-apps\mangayomi-lite`. Il backup della v0.1.1 è in `C:\tizen-apps\backup-mangayomi-lite-0.1.1`.
- **Firma e installazione:**
  - Firmata con il profilo Adamtv e installata su 192.168.1.3:26101.
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
- **Strumenti di test:** `C:\tizen-apps\tools\cdp2.mjs <porta> <Sorgente> <query>`.

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
- Sorgente: commit c664716 del repo adam-aouam/tmp-60c3b50e7c1422c8. Copia modificata sul box in /workspace/mly/full/mangayomi (vedi NOTE_MODIFICHE.md) e sul PC in C:\tizen-apps\mangayomi-full.
- Pacchetto firmato con Adamtv: C:\tizen-apps\MangayomiFull-0.3.1.wgt. Per il rollback c'è C:\tizen-apps\MangayomiLite-0.2.1-firmato.wgt; dato che la versione è più bassa, probabilmente bisogna prima disinstallare.
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
- Pacchetto: C:\tizen-apps\MangayomiFull-0.3.2.wgt, firmato con Adamtv. Sorgente sul PC in C:\tizen-apps\mangayomi-full; la copia della 0.3.1 è in C:\tizen-apps\backup-mangayomi-full-0.3.1.
- Sul box: /workspace/mly/full/mangayomi; la copia della 0.3.1 è in /workspace/mly/full-0.3.1-backup.
- Novità (dettagli in NOTE_MODIFICHE.md):
  - Riprendi/Continua come in Mangayomi;
  - modalità adulti nascosta (0×5, oppure Su×5 su Libreria nella barra laterale; all'avvio è sempre nascosta);
  - interfaccia in italiano;
  - "Su" da "Carica altro" torna alla griglia;
  - miniature PMVHaven più leggere (thumb_md).
- Test su Chromium headless del box: 40/40 superati (tools/v032test.mjs).
- Per installarla serve il via libera di Adam: `tizen install -n MangayomiFull-0.3.2.wgt -s 192.168.1.3:26101`.

## v0.3.3: installata sulla TV il 14/11/2026 verso le 16:18 (ora di Roma)
- Pacchetto: C:\tizen-apps\MangayomiFull-0.3.3.wgt (firmato Adamtv). Le versioni precedenti sono in MangayomiFull-0.3.2.wgt e MangayomiFull-0.3.1.wgt.
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
