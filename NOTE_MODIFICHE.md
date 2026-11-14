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
