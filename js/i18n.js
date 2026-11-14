/* Lingua dell'interfaccia. L'app è scritta in italiano (predefinito). Con
   Altro › Lingua › English i testi dell'interfaccia vengono tradotti mentre
   compaiono: un MutationObserver controlla #app e sostituisce i testi noti.
   Titoli, descrizioni e nomi che arrivano dalle estensioni non sono nel
   dizionario e restano come sono. */
(function () {
  const Mly = (window.Mly = window.Mly || {});

  const EN = {
    "Libreria": "Library", "Aggiornamenti": "Updates", "Cronologia": "History", "Sfoglia": "Browse", "Altro": "More",
    "Sorgenti": "Sources", "Estensioni": "Extensions", "Migra": "Migrate", "Sorgente": "Source",
    "Popolari": "Popular", "Ultimi": "Latest", "Cerca": "Search", "Filtri": "Filters", "Impostazioni": "Settings", "Web": "WebView",
    "Aggiorna": "Update", "Installa": "Install", "Disinstalla": "Uninstall", "Installata": "Installed", "Fissa": "Pin", "Sblocca": "Unpin",
    "Annulla": "Cancel", "OK": "OK", "Fatto": "Done", "Riprova": "Retry", "Modifica": "Edit", "Rimuovi": "Remove", "Azzera": "Reset",
    "Carica altro": "Load more", "Caricamento": "Loading", "Caricamento…": "Loading…", "Ricerca in corso…": "Searching…", "Controllo in corso…": "Checking…",
    "Categorie": "Categories", "Nuova categoria": "New category", "Lettore": "Player", "Informazioni": "About", "Lingua": "Language",
    "Repository": "Repositories", "Repository anime": "Anime repositories", "Aggiungi repository": "Add repository",
    "Aggiungi alla libreria": "Add to library", "In libreria": "In library", "Controlla aggiornamenti": "Check for updates",
    "Inizia": "Start", "Riprendi": "Resume", "Continua": "Continue", "Rivedi": "Rewatch", "Visto": "Watched", "Episodio": "Episode", "Ep.": "Ep.",
    "Episodio precedente": "Previous episode", "Episodio successivo": "Next episode", "Indietro 10 s": "Back 10 s", "Avanti 10 s": "Forward 10 s",
    "Pausa": "Pause", "Riproduci": "Play", "Qualità": "Quality", "Video": "Video", "Sottotitoli": "Subtitles", "Sottotitoli: no": "Subtitles: off",
    "+85 s  Salta intro": "+85 s  Skip intro", "+85 s Salta intro": "+85 s Skip intro",
    "Riproduzione": "Playback", "Tracciamento": "Tracking", "Consigliati": "Recommendations", "Ordine di visione": "Watch order",
    "Crescente": "Ascending", "Decrescente": "Descending", "Tutte": "All", "Spazio": "Space", "Cancella": "Delete", "Svuota": "Clear",
    "In corso": "Ongoing", "Completato": "Completed", "In pausa": "On hiatus", "Cancellato": "Cancelled", "Pubblicazione terminata": "Publishing finished", "Sconosciuto": "Unknown",
    "Attivo": "On", "Disattivo": "Off", "Senza titolo": "Untitled", "Opzione": "Option", "Traccia": "Track", "Auto": "Auto",
    "La tua libreria è vuota": "Your library is empty", "Aggiungi titoli da Sfoglia per riempirla": "Add titles from Browse to fill it",
    "La cronologia è vuota": "History is empty", "Gli episodi che guardi restano salvati su questa TV.": "The episodes you watch are saved on this TV.",
    "Nessun aggiornamento": "No updates", "Qui compaiono i nuovi episodi dei titoli in libreria.": "New episodes of titles in your library show up here.",
    "Nessuna sorgente": "No sources", "Installane una da Estensioni.": "Install one from Extensions.", "Nessuna estensione": "No extensions",
    "Nessun risultato": "No results", "Nessun episodio": "No episodes", "Nessuna impostazione": "No settings",
    "Impossibile caricare la sorgente": "Couldn't load the source", "Impossibile caricare il repository": "Couldn't load the repository",
    "Questa sorgente non ha filtri.": "This source has no filters.", "La sorgente non è installata.": "The source is not installed.",
    "Questo titolo non ha episodi.": "This title has no episodes.", "Nessun flusso da riprodurre.": "No stream to play.", "Il video non è partito.": "The video didn't start.",
    "Non c'è un episodio precedente.": "There is no previous episode.", "Non c'è un episodio successivo.": "There is no next episode.",
    "Stanza privata o offline": "Private room or offline", "Nessuna WebView": "No WebView", "Non disponibile sulla TV": "Not available on the TV",
    "Prima aggiungi il titolo alla libreria.": "Add the title to your library first.", "Crea una categoria in Altro › Categorie.": "Create a category in More › Categories.",
    "Nessun titolo in libreria da migrare.": "No library titles to migrate.", "Scegli il titolo corrispondente.": "Pick the matching title.",
    "Scegli un titolo della libreria, poi la sorgente in cui cercarlo.": "Pick a library title, then the source to search it in.",
    "Parti alla qualità più alta": "Start at the highest quality", "Attivo. Per HLS viene bloccata la variante più alta, non Auto.": "On. For HLS the highest variant is locked, not Auto.",
    "Samsung AVPlay per MP4": "Samsung AVPlay for MP4", "Non disponibile su questo dispositivo. Si usano video HTML e hls.js.": "Not available on this device. HTML video and hls.js are used.",
    "Apri nel browser": "Open in browser", "Apri nel browser della TV": "Open in the TV browser",
    "Mangayomi per TV Samsung. Libreria anime, estensioni e lettore, con la stessa API delle estensioni di Mangayomi.": "Mangayomi for Samsung TV. Anime library, extensions and player, with the same extension API as Mangayomi.",
    "La riproduzione parte alla qualità più alta. Per HLS si usa la variante più alta, non Auto.": "Playback starts at the highest quality. For HLS the highest variant is used, not Auto.",
    "Le estensioni arrivano dal repository indicato in Altro › Sfoglia.": "Extensions come from the repositories listed in More › Browse.",
    "Le estensioni arrivano dai repository indicati in Altro › Sfoglia.": "Extensions come from the repositories listed in More › Browse.",
    "L'app non aggira Cloudflare, anti-bot, paywall o verifiche dell'età.": "The app does not bypass Cloudflare, anti-bot checks, paywalls or age verification.",
    "Il tracciamento richiede un account collegato da browser. Questa app per TV non ha WebView, quindi i tracker non si possono collegare qui.": "Tracking needs an account linked in a browser. This TV app has no WebView, so trackers can't be linked here.",
    "Consigliati e ordine di visione usano tracker online che richiedono un accesso da browser, che questa app per TV non può aprire.": "Recommendations and watch order use online trackers that need a browser login, which this TV app can't open.",
    "Il sito chiede una verifica dell'età. Questa TV non può aprire quella pagina né impostare il cookie richiesto. L'app non aggira la verifica dell'età.": "The site asks for age verification. This TV can't open that page or set the required cookie. The app does not bypass age verification.",
    "Questa TV non ha WebView, quindi una pagina visibile solo in un browser non si può leggere. L'app non aggira questo controllo.": "This TV has no WebView, so a page that only works in a browser can't be read. The app does not bypass this check.",
    "Se il file richiede Cookie, Referer o User-Agent, questa TV non può inviarli. L'app non aggira questo limite.": "If the file needs Cookie, Referer or User-Agent, this TV can't send them. The app does not work around this limit.",
    "Se il sito è giù, blocca questo dispositivo o chiede un controllo del browser, resta chiuso.": "If the site is down, blocks this device or asks for a browser check, it stays closed.",
    "Questa estensione non ha l'indirizzo del codice.": "This extension has no code URL.", "L'indice del repository non è una lista.": "The repository index is not a list.",
    "Questo flusso è HLS e hls.js non è disponibile, quindi non si può scegliere la variante più alta.": "This stream is HLS and hls.js is not available, so the highest variant can't be chosen.",
    "Samsung AVPlay non riesce a preparare questo flusso.": "Samsung AVPlay can't prepare this stream.",
    "Samsung AVPlay non riesce ad aprire questo flusso e per questo indirizzo non c'è alternativa.": "Samsung AVPlay can't open this stream and there is no alternative for this URL.",
    "Nessun repository. Aggiungine uno per vedere le estensioni.": "No repositories. Add one to see extensions.",
    "Indirizzo di un anime_index.json (repository di estensioni Mangayomi).": "URL of an anime_index.json (Mangayomi extension repository).",
    "Italiano": "Italiano", "English": "English",
    "Lingua della TV (automatica)": "TV language (automatic)", "Si applica subito; l'app si ricarica.": "Applied right away; the app reloads.",
  };

  const PATTERNS = [
    [/^Inizia · Ep\. (.+)$/, "Start · Ep. $1"],
    [/^Inizia  · (.+)$/, "Start  · $1"],
    [/^Riprendi Ep\. (.+?) · (.+)$/, "Resume Ep. $1 · $2"],
    [/^Continua Ep\. (.+)$/, "Continue Ep. $1"],
    [/^Riprendi da (.+) di (.+)$/, "Resume from $1 of $2"],
    [/^Episodio (\S+)$/, "Episode $1"],
    [/^Versione (.+)$/, "Version $1"],
    [/^Sottotitoli: (.+)$/, "Subtitles: $1"],
    [/^Vuoi disinstallare (.+)\? Potrai reinstallarla da Estensioni\.$/, "Uninstall $1? You can reinstall it from Extensions."],
    [/^Questa TV non ha WebView\. Apri la pagina da telefono o computer(.*)$/, "This TV has no WebView. Open the page from a phone or computer$1"],
    [/^Download non riuscito: (.+)$/, "Download failed: $1"],
    [/^Impossibile caricare la pagina \((.+)$/, "Couldn't load the page ($1"],
    [/^Riproduzione HLS non riuscita \((.+)$/, "HLS playback failed ($1"],
    [/^Errore dell'estensione (.+)$/, "Extension error $1"],
    [/^(.+) non è un'estensione JavaScript di Mangayomi\.$/, "$1 is not a Mangayomi JavaScript extension."],
  ];

  // Lingua di sistema della TV (navigator.language segue quella impostata su Tizen).
  function systemLang() {
    const l = String((navigator.languages && navigator.languages[0]) || navigator.language || "it").toLowerCase();
    return l.indexOf("it") === 0 ? "it" : "en";
  }
  function lang() {
    const s = Mly.memory && Mly.memory.settings;
    const pick = s && s.lang;
    if (pick === "it" || pick === "en") return pick;
    return systemLang();
  }

  function tr(text) {
    if (lang() !== "en" || !text) return text;
    const raw = String(text);
    const trimmed = raw.trim();
    if (!trimmed) return text;
    let out = EN[trimmed];
    if (out === undefined) {
      for (let i = 0; i < PATTERNS.length && out === undefined; i++) {
        if (PATTERNS[i][0].test(trimmed)) out = trimmed.replace(PATTERNS[i][0], PATTERNS[i][1]);
      }
    }
    if (out === undefined || out === trimmed) return text;
    return raw.replace(trimmed, out);
  }

  function translateNode(node) {
    if (lang() !== "en" || !node) return;
    if (node.nodeType === 3) {
      const next = tr(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;
    const label = node.getAttribute && node.getAttribute("aria-label");
    if (label) { const t = tr(label); if (t !== label) node.setAttribute("aria-label", t); }
    for (let c = node.firstChild; c; c = c.nextSibling) translateNode(c);
  }

  let observer = null;
  function start() {
    const app = document.getElementById("app") || document.body;
    if (!app) return;
    if (observer) observer.disconnect();
    observer = null;
    document.documentElement.lang = lang();
    if (lang() !== "en") return;
    translateNode(app);
    observer = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") translateNode(m.target);
        else m.addedNodes.forEach(translateNode);
      }
    });
    observer.observe(app, { childList: true, subtree: true, characterData: true });
  }

  Mly.i18n = { tr, start, lang, systemLang, EN };
})();
