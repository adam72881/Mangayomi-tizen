# Mangayomi per TV Samsung: modifiche e stato

Questo è l'unico file con le modifiche di ogni versione e lo stato attuale. `docs/STATO_E_PIANO.md` resta come diario storico dei primi passi (ambiente, firma, installazione).

## Stato attuale (v0.3.7, ramo `claude/v037-licenza-lingua-repo`)

- `main` è la v0.3.6. La v0.3.7 è su un ramo a parte e passa i test headless, ma **non è ancora stata installata né provata sulla TV**. Va in main solo dopo l'approvazione. Installazione: `docs/INSTALLAZIONE.md`.
- **Test:** `tools/run-tests.sh` dalla radice del repository. Servono node 20+, Chrome o Chromium (variabile `CHROME`) e Internet: i test usano il repository delle estensioni e i siti veri.
  - Il server locale è `tools/servefull.mjs`, sulla porta 8770 con la stessa CSP di config.xml. Chrome headless gira con CDP sulla porta 9444.
  - I test girano in quest'ordine: `v032test`, `uninstalltest`, `playertest`, `navtest`. Chrome parte in italiano (`--lang=it-IT`), perché la lingua dell'app segue quella di sistema.
  - `javtest` e `hypnotest` sono facoltativi: da un server quei siti rispondono con un controllo del browser o con l'age-gate.
- **Limiti noti:**
  - Questa TV non ha WebView: Cookie, Referer e User-Agent non si possono impostare. Cloudflare, anti-bot, paywall e verifiche dell'età non vengono aggirati.
  - Sottotitoli: solo tracce WebVTT fornite dall'estensione in `video.subtitles`. SRT e sottotitoli HLS non sono gestiti.
  - Stripchat: il segnaposto da 12 s («Find the real thing on STRIPCHAT.COM», stanza privata o offline) non parte e compare «Stanza privata o offline». L'HD protetto dal sito non si aggira.
  - I problemi delle singole estensioni vanno nel repository adam72881/mangayomi-anime-extensions (HypnoTube: `docs/HYPNOTUBE_POPOLARI.md`).

---

# Modifiche fatte prima dell'installazione sulla TV (14/11/2026)

- config.xml:
  - app id `MgyLite01A.MangayomiLite` e package `MgyLite01A`, come la versione già installata, così l'app viene aggiornata e non duplicata;
  - widget id uguale a quello della v0.2.1;
  - versione 0.3.1.
- js/storage.js: la cronologia scarta le voci di "mly.history" con un'altra forma, rimaste dalla vecchia v0.1. Prima comparivano come "undefined / undefined".
- js/ui.js:
  - la griglia di una sorgente carica da sola la pagina successiva quando il focus arriva a 12 elementi dalla fine, come lo scorrimento infinito di Mangayomi; prima serviva il pulsante "Load more";
  - About mostra la versione 0.3.1.

# v0.3.2 (14/11/2026), solo compilata e firmata, non installata sulla TV

1. **Riprendi/Continua come in Mangayomi** (js/ui.js, js/player.js):
   - L'ordine reale degli episodi viene ricavato dai numeri nel nome, o dalle date. Così "primo episodio" significa sempre Ep. 1, anche se la sorgente elenca prima i più recenti (AnimeWorld).
   - Serie mai vista: "Inizia · Ep. 1".
   - Episodio a metà: "Riprendi Ep. N · mm:ss", e riparte da quel punto.
   - Ultimo episodio finito (oltre il 90%, o arrivato alla fine): "Continua Ep. N+1".
   - Tutti visti: "Rivedi".
   - Posizione salvata per ogni episodio: ogni 2 s, all'uscita dal lettore, quando l'app va in background o si chiude. Durante la ripresa non viene sovrascritta con 0.
   - "Giù" nel lettore e la fine dell'episodio passano all'episodio successivo vero (prima, con le liste decrescenti, si andava a quello precedente).
   - Nella lista: "✓ … Visto" (riga attenuata) e "Riprendi da mm:ss di mm:ss". La lista si apre già sull'episodio suggerito.
   - Saltare un episodio con "Giù" non lo segna più come visto.
2. **Modalità adulti nascosta** (js/ui.js):
   - Di base le estensioni con isNsfw e tutti i loro contenuti sono nascosti ovunque: Libreria (anche ricerca e migrazione), Aggiornamenti e badge, Cronologia, Sfoglia › Sorgenti ed Estensioni.
   - Per attivarla o disattivarla: tasto 0 premuto 5 volte in 3 s. I tasti numerici sono registrati con tizen.tvinputdevice.
   - Ripiego: "Su" 5 volte in 3 s con il focus su "Libreria" nella barra laterale.
   - Compare solo un piccolo avviso "OK". Non viene salvata: all'avvio è sempre nascosta.
   - Quando si nasconde, si torna alla schermata principale e si chiude l'eventuale lettore.
3. **Interfaccia in italiano**: schermate, pulsanti, dialoghi, stati, messaggi d'errore di lettore, runtime e caricatore delle estensioni.
4. **"Su" da "Carica altro"** torna alla griglia, sullo stesso elemento (attributo data-up in nav.js).
5. **Miniature PMVHaven**: si usa thumb_md.webp (426x240) invece di thumb_lg.webp (640x360). Se manca, si torna a quella grande.

# v0.3.3 (14/11/2026), correzioni dopo la prova sulla TV della 0.3.2

- config.xml: aggiunto il privilegio `http://tizen.org/privilege/tv.inputdevice`. Senza, sulla TV `tizen.tvinputdevice` rispondeva "Permission denied" e i tasti numerici del telecomando non venivano registrati.
- js/grid.js: le copertine "custom_<id>.jpeg" di PMVHaven, a piena risoluzione (1920x1080 o 3830x2160, fino a 1,4 MB), vengono sostituite con "webp320_<id>.webp" (480x270) dello stesso video. Se mancano, si torna all'originale. Sulla TV causavano blocchi fino a 4 s nella griglia.

# v0.3.4 (14/11/2026), correzioni dopo la prova con i tasti veri del telecomando di rete

- js/nav.js: "Sinistra" dal contenuto verso la barra laterale ora va sulla scheda già selezionata, come in Mangayomi. Prima andava sul pulsante della barra allineato in altezza e cambiava scheda senza volerlo (dal centro della Libreria si finiva su Cronologia).
- js/ui.js: dopo l'attivazione o disattivazione della modalità nascosta (0×5) il focus resta sulla barra laterale, se era lì. Prima saltava nel contenuto.

# v0.3.5 (14/11/2026), non ancora installata sulla TV

- js/ui.js e css/app.css: prima di disinstallare un'estensione compare una conferma, come in Mangayomi: "Disinstalla – Vuoi disinstallare <nome>? Potrai reinstallarla da Estensioni.", con i pulsanti "Annulla" e "Disinstalla".
  - Il focus parte su "Annulla"; con Sinistra/Destra si passa da un pulsante all'altro.
  - Indietro e "Annulla" chiudono senza toccare nulla e il focus torna sul pulsante di partenza. Dopo la disinstallazione il focus torna sulla riga dell'estensione.
  - Libreria, cronologia e impostazioni della sorgente non vengono cancellate.
- icon.png: l'icona provvisoria è stata sostituita con l'icona ufficiale di Aniyomi, su scelta di Adam. È il disegno vettoriale del launcher Android (`app/src/main/res/drawable/ic_launcher_foreground.xml` di github.com/aniyomiorg/aniyomi), convertito in SVG (`icon-source.svg`) e poi in un PNG 512x512 con sfondo trasparente. Licenza Apache-2.0: vedi `THIRD_PARTY_NOTICES.md`.
- Estensioni (js/ui.js, js/nav.js): ogni riga ha i suoi pulsanti veri (Installa / Aggiorna / Disinstalla), raggiungibili con le frecce come in Mangayomi. Destra va sul pulsante, Sinistra torna alla riga (e poi alla barra laterale), Su/Giù cambiano riga restando nella stessa colonna, Su da "Aggiorna" (in fondo) torna all'ultima riga. Dopo Installa/Disinstalla il focus resta sul pulsante della riga e non salta più in cima.
- Entrando in una sorgente, durante il caricamento il focus è sulla scheda Popolari/Ultimi; a caricamento finito va sulla prima copertina. Prima finiva su "Cerca".
- Copertine (js/grid.js, css/app.css) come la griglia compatta di Mangayomi su TV: larghezza massima 150 dp, proporzione 0,69, spazio di 10 dp, angoli arrotondati da 6 dp, anello di focus da 3 dp fuori dal ritaglio, la copertina col focus si ingrandisce di 1,06, titolo bianco su due righe sopra una sfumatura scura. Il titolo ora si vede ovunque (Libreria, Sfoglia, ricerca). È stato corretto anche il riquadro sfalsato: lo span della copertina era in linea e l'immagine usciva dal bordo agli angoli.
- `[hidden]` ora nasconde davvero anche gli elementi con display:flex. La lista delle qualità aveva display:flex e quindi compariva da sola all'avvio (per esempio "Originale - 480p / 240p" su Stripchat).
- Lettore (js/player.js, js/ui.js, css/app.css) in stile Mangayomi:
  - In alto titolo ed episodio; in basso la barra di avanzamento con i tempi e la fila dei comandi: episodio precedente, -10 s, Play/Pausa, +10 s, episodio successivo, "+85 s Salta intro" (la durata predefinita di Mangayomi), Qualità, Sottotitoli.
  - Il video parte da solo alla qualità più alta. La qualità si cambia solo dal pulsante Qualità, che apre un pannello in basso con testo grande e la spunta sulla qualità attuale.
  - Il cartellino "AnimeWorld" a destra non c'è più: il pulsante mostra solo la risoluzione.
  - I comandi spariscono dopo 3 s senza tasti durante la riproduzione e ricompaiono con qualsiasi tasto. Restano visibili in pausa o con un menu aperto.
  - Tasti come prima: Sinistra/Destra -10/+10 s, OK pausa, Giù episodio successivo, Indietro chiude il lettore. Su ora entra nella fila dei comandi (su Qualità, oppure su Salta intro se c'è una sola qualità). Lì Sinistra/Destra si spostano, OK preme, Su/Giù/Indietro escono dalla fila. Funzionano anche i tasti multimediali (Play/Pausa, avanti/indietro, traccia successiva/precedente).
  - I sottotitoli forniti dall'estensione (file WebVTT) si attivano a giro dal pulsante Sottotitoli.
- HypnoTube: "Popolari" e "Ultimi" uguali. Non è colpa dell'app, che chiama getPopular e getLatestUpdates separatamente. L'estensione 1.4.2, con "Popular a sorpresa" attivo (lo è di default), può pescare proprio l'ordine "Recenti", oppure "Casuale" a partire dalla pagina 1 dei recenti. La correzione è nella patch separata per il repository delle estensioni (HypnoTube 1.4.3), non ancora unita.


# v0.3.6 (14/11/2026), correzioni dopo la prova sulla TV della 0.3.5, non ancora installata

Le correzioni principali sono nei commit 990aa14, 9db8e78 e 1ff1ddc di questo ramo (griglia, lettore, focus). Questo commit aggiunge:

- **#5** In js/nav.js `data-down` funziona come `data-up`. Le schede Popolari/Ultimi hanno `data-down="grid-source"`, quindi Giù dalla scheda torna sulle copertine: prima andava su «Carica altro», che era più vicino in linea retta.
- **#6** Il pulsante Filtri ha `data-fid="src-filter"`. Così, se la schermata viene ridisegnata mentre il pannello è aperto, alla chiusura il focus torna comunque su Filtri. Le schede di Sfoglia hanno `data-fid="browse-<scheda>"`.
- **Test headless:**
  - Nuovo `tools/navtest.mjs`, aggiunto a `tools/run-tests.sh`. Controlla la griglia compatta (7–10 copertine per riga, spazio piccolo); che la seconda sorgente abbia la stessa cella della prima (#4); Su verso la scheda e Giù di nuovo sulla griglia (#5); il focus dopo i Filtri e dopo un messaggio (#6); Su dalla prima riga delle Estensioni e il ritorno sulla riga della sorgente (#7).
  - In `playertest.mjs`, prima di controllare l'icona di pausa, si aspetta che il video abbia un fotogramma. Dopo il salto di 85 s, con una rete lenta, il test falliva a caso.
  - Risultato con Chromium headless: 120 PASS, 0 FAIL.
- Versione 0.3.6 in config.xml e in Informazioni.
- **#8** Giù durante il video apre i comandi con il focus su «Salta intro», nella fila dei pulsanti in basso (su Qualità se Salta intro non c'è). Prima andava su Play. Su continua a non portare su Qualità.
- **#9** La rotella compare anche durante il buffering, non solo prima che il video parta, e sparisce appena ci sono fotogrammi (`waiting` / `playing` / `canplay`). All'apertura del lettore non compare più «Non c'è un episodio successivo» (correzione di 1ff1ddc, coperta dal test).
- Test headless dopo queste modifiche: 121 PASS, 0 FAIL.
- **Sottotitoli**: il pulsante c'è di nuovo, ma compare **solo quando la sorgente fornisce delle tracce**. Altrimenti è nascosto e il D-pad lo salta.
- **Griglia come Mangayomi ufficiale** (`gridview_widget.dart` e `cover_view_widget.dart`, con 1 dp = 2 px):
  - copertine larghe al massimo 150 dp (300 px), 10 dp (20 px) tra una cella e l'altra, 4 dp (8 px) di margine per copertina, proporzione 0,69;
  - angoli di 6 dp, anello del focus di 3 dp, titolo di 14 dp;
  - su questa TV sono 6 copertine per riga da circa 289 px.
  I grandi vuoti visti sulla TV nella v0.3.5 erano dovuti a #4 (celle non dimensionate dalla seconda griglia in poi), ora corretto.
- **Documentazione**: `docs/V035_STATO.md` è stato tolto. Ripeteva questo file: le parti ancora utili (test e limiti) sono in «Stato attuale» qui in cima.
- Test headless: 123 PASS, 0 FAIL.

# v0.3.7 (14/11/2026), su un ramo a parte, non ancora installata

Preparazione per proporre l'app al progetto Mangayomi.

- **Licenza:** `LICENSE` (Apache-2.0, come Mangayomi) e `NOTICE` con le componenti di terze parti: icona Aniyomi, hls.js e l'API delle estensioni di Mangayomi.
- **Lingua** (nuovo `js/i18n.js`):
  - Di serie la lingua è quella **della TV**: se la TV è in italiano l'app resta in italiano, altrimenti va in inglese.
  - In Altro › Lingua si sceglie «Lingua della TV (automatica)», Italiano o English; l'app si ricarica.
  - Come funziona: l'interfaccia è scritta in italiano, e in inglese i testi noti vengono sostituiti mentre compaiono (dizionario e alcuni modelli per i testi con numeri). Titoli e descrizioni delle estensioni restano come sono.
- **Più repository di estensioni**, come in Mangayomi:
  - In Altro › Sfoglia c'è l'elenco dei repository (`settings.repoUrls`), con «Rimuovi» su ogni riga e «Aggiungi repository».
  - Le installazioni vecchie con un solo `repoUrl` vengono convertite da sole.
  - Le estensioni con lo stesso id si tengono una volta sola, dal primo repository. Se un repository non risponde, quelle degli altri restano.
- **Pulsante «Web»:**
  - Sulla TV apre la pagina nel browser di sistema (`tizen.application.launchAppControl`, operazione view; nuovo privilegio `application.launch`).
  - Serve solo a vedere la pagina: il login fatto nel browser non passa all'app.
  - Fuori dalla TV, o se il browser non si apre, compare il messaggio di prima.
- **Guida all'installazione:** `docs/INSTALLAZIONE.md` (italiano), più un riassunto in inglese nel README.
- **Test:** `navtest.mjs` controlla l'elenco dei repository, che con un repository che non risponde restino gli altri, la scelta della lingua, l'italiano automatico e la traduzione in inglese. Totale: 128 PASS, 0 FAIL (poi 132 con gli accessi dei siti).
- Versione 0.3.7 in config.xml e in Informazioni.
- **Accessi dei siti (sperimentale):**
  - Nuova impostazione in Altro › Sfoglia, attiva di serie (`settings.siteCookies`).
  - Le richieste delle estensioni usano `credentials: "include"`: il motore della TV può conservare e rimandare i cookie dei siti, così il login fatto nelle impostazioni di PMVHaven o HypnoTube può restare valido.
  - Se una richiesta con i cookie viene rifiutata, per esempio per CORS, per quel sito si torna da soli a `omit`, come prima.
  - Nessun controllo viene aggirato: è il login normale del sito con l'account di chi usa l'app.
  - **Da verificare sulla TV.** In Chromium sul PC il cookie di un altro sito non viene rimandato (SameSite=Lax di default; `navtest` lo riporta come «INFO»). Un'app Tizen installata può comportarsi diversamente.
  - Le estensioni hanno bisogno di PMVHaven 1.6.3 e HypnoTube 1.4.5 (adam72881/mangayomi-anime-extensions PR #9), che riconoscono il login anche quando il cookie non si legge.
- Test headless: 132 PASS, 0 FAIL.
- **Filtri** (segnalato da Adam):
  - Scegliendo un'opzione (es. «Ultime aggiunte») il pannello si ridisegna ma il focus resta su quell'opzione, alla stessa altezza; prima saltava su «Cerca».
  - Riaprendo Filtri si ritrovano le scelte già applicate, non quelle predefinite. «Azzera» le riporta come all'inizio.
  - Due test nuovi in `navtest.mjs`. Totale: 134 PASS, 0 FAIL.
- **Riga «Ricerca»:** invece di «(filtri)» mostra cosa è cambiato rispetto ai filtri predefiniti della sorgente, per esempio «Ricerca: Ordine: Ultime aggiunte · Genere: Azione». Se c'è anche un testo cercato compare tra «». Senza testo né filtri cambiati dice «tutti i risultati». Tradotta anche in inglese. Totale test: 135 PASS, 0 FAIL.
- **Scheda del titolo in stile Mangayomi** (chiesta da Adam):
  - copertina più grande (220×320), titolo, dettagli e **tag che si possono premere**: cercano quel genere nella sorgente;
  - un pulsante grande «Inizia/Riprendi» e sotto una fila di azioni con icona, solo quelle che funzionano: Aggiungi alla libreria / In libreria e Web, più Categorie e Migra solo se il titolo è in libreria;
  - tolti Tracciamento, Consigliati e Ordine di visione: sulla TV mostravano solo «non disponibile»;
  - episodi molto più grandi: righe da 128 px con miniatura 192×108 e testo più grande (`rowH` per griglia in `js/grid.js`);
  - tre test nuovi in `navtest.mjs`. Totale: 138 PASS, 0 FAIL.
- **Elenco degli episodi dall'alto** (segnalato da Adam): come in Mangayomi, l'elenco parte dal primo in alto, cioè l'ultimo uscito. Prima si apriva già spostato sull'episodio suggerito (es. il 10) e quelli più recenti restavano nascosti sopra. L'episodio da guardare resta sul pulsante «Inizia/Riprendi/Continua». In `js/grid.js` ci sono `length` e `jump(i)` per spostarsi su un elemento (usati dai test per scendere all'Ep. 1). Totale: 139 PASS, 0 FAIL.
- **Interfaccia più grande per la TV** (segnalato da Adam: «c'è tanto spazio libero»):
  - barra laterale più larga (170 px) con icone e scritte più grandi;
  - titoli delle schermate a 46 px;
  - righe di Altro, Sfoglia e impostazioni più alte, con testo a 28 px;
  - pulsanti, schede e messaggi «vuoto» più grandi;
  - testo di base a 22 px.

  Sono solo regole CSS in fondo a `css/app.css`. Totale test: 139 PASS, 0 FAIL.
- **Altro › Statistiche** (nuova):
  - Sei riquadri: titoli in libreria, serie iniziate, episodi visti, tempo guardato, sorgenti installate, ultima visione. Sotto, le tre sorgenti più guardate.
  - I dati sono quelli salvati sulla TV (libreria e progressi). Con la modalità adulti nascosta, le sorgenti per adulti non vengono contate.
  - «Aggiorna» ricalcola. Tradotta anche in inglese.
- **Controllo delle voci già presenti in Altro**, con nuovi test che usano il D-pad e la tastiera a schermo; funzionano tutte:
  - Categorie: crea, assegna a un titolo, filtra la Libreria, rimuovi (anche dai titoli);
  - Lettore: interruttore AVPlay salvato;
  - Sfoglia: repository e accessi dei siti;
  - Lingua;
  - Informazioni: versione 0.3.7.
- Totale test: 146 PASS, 0 FAIL.
- **Altro › Copertine per riga** (nuova), come la «dimensione griglia» di Mangayomi:
  - «Automatica (come Mangayomi)», con copertine larghe al massimo 150 dp, oppure da 4 a 10 per riga;
  - vale per Libreria, sorgenti e ricerca (`settings.gridCols`, letto da `measure()` in `js/grid.js`);
  - quattro test nuovi. Totale: 150 PASS, 0 FAIL.
- **Pulsante a comparsa «Salta sigla» / «Salta finale»** (AniSkip), chiesto da Adam:
  - All'avvio di un episodio il lettore cerca il numero MyAnimeList su AniList partendo dal titolo («(ITA)», «Sub ITA»… vengono tolti; il numero resta in memoria sulla TV). Poi chiede ad AniSkip (`api.aniskip.com`, database della community) i tempi di sigla iniziale e finale di quell'episodio.
  - Ogni richiesta ha un tempo massimo di 4 s. Se non c'è risposta, o i tempi non ci sono, non cambia niente e resta «+85 s».
  - Durante la sigla compare in basso a destra «Salta sigla · OK» (o «Salta finale»). OK salta alla fine della sigla senza mettere in pausa, poi il pulsante sparisce. Nessun salto automatico.
  - Le sorgenti per adulti sono escluse: i loro titoli non vengono mandati ad AniList.
  - Test: ricerca vera (One Piece (ITA) → MyAnimeList 21 → sigla dell'ep. 1000 da 0:14 a 2:04), comparsa del pulsante, salto con OK, scomparsa. Totale: 154 PASS, 0 FAIL.
