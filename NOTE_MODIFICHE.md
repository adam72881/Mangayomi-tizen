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

