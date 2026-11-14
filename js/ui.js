/* Anime screens, in the Mangayomi order:
   Library, Updates, History, Browse (Sources, Extensions, Migrate), More. */
(function () {
  const Mly = (window.Mly = window.Mly || {});
  const STATUS = ["In corso", "Completato", "In pausa", "Cancellato", "Pubblicazione terminata"];
  const root = {
    tab: "library",
    browse: "sources",
    extIndex: null,
    extLoading: false,
    extError: "",
    libQuery: "",
    libCat: "all",
    libFocus: 0,
    migrate: { step: 0, entryId: "", sourceId: "", results: [], loading: false, error: "", focus: 0 },
    dialog: null,
    osk: null,
    filtersFor: null,
    returnFid: "",
  };
  const stack = [];

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function absUrl(base, url) {
    if (!url) return "";
    if (/^https?:/i.test(url)) return url;
    if (String(url).startsWith("//")) return "https:" + url;
    try { return new URL(url, base && base.endsWith("/") ? base : (base || "") + "/").href; }
    catch (e) { return url; }
  }
  function statusName(n) { return STATUS[n] || "Sconosciuto"; }
  function sourceOf(id) { return Mly.memory.extensions[String(id)] || null; }
  function seriesKey(sourceId, link) { return String(sourceId) + "|" + link; }
  function findLibrary(sourceId, link) {
    const id = seriesKey(sourceId, link);
    return Mly.memory.library.find((item) => item.id === id) || null;
  }
  function chaptersOf(manga) {
    const list = (manga && (manga.chapters || manga.episodes)) || [];
    return list.map((c) => ({
      name: c.name || "Episodio",
      url: c.url || c.link || "",
      imageUrl: c.thumbnailUrl || c.imageUrl || "",
      dateUpload: c.dateUpload || "",
    })).filter((c) => c.url);
  }
  function progressOf(sourceId, link) {
    return Mly.memory.progress[seriesKey(sourceId, link)] || { watched: {} };
  }

  /* ---- Episode order and resume, as in Mangayomi ----
     Sources list episodes newest first or oldest first. The real order is
     read from the episode numbers (or dates), so "first episode" is always
     episode 1 and "next" is always the following episode. */
  function epNumber(name) {
    const s = String(name || "");
    let m = s.match(/\b(?:ep(?:isodio|isode|s)?|e)\.?\s*(\d+(?:[.,]\d+)?)/i);
    if (!m) { const all = s.match(/\d+(?:[.,]\d+)?/g); if (all) m = [0, all[all.length - 1]]; }
    return m ? parseFloat(String(m[1]).replace(",", ".")) : NaN;
  }
  function chronoOrder(chapters) {
    const n = chapters.length;
    const idx = chapters.map((_, i) => i);
    if (n < 2) return idx;
    const a = epNumber(chapters[0].name), b = epNumber(chapters[n - 1].name);
    let desc = false;
    if (!isNaN(a) && !isNaN(b) && a !== b) desc = a > b;
    else {
      const da = Number(chapters[0].dateUpload) || 0, db = Number(chapters[n - 1].dateUpload) || 0;
      if (da && db && da !== db) desc = da > db;
    }
    return desc ? idx.reverse() : idx;
  }
  function epLabel(chapters, order, idx) {
    const ch = chapters[idx];
    const num = ch ? epNumber(ch.name) : NaN;
    return "Ep. " + (isNaN(num) ? order.indexOf(idx) + 1 : String(num));
  }
  function posOf(prog, url) {
    const p = (prog.positions && prog.positions[url]) || null;
    if (p) return p;
    if (prog.episodeUrl === url) return { positionMs: prog.positionMs || 0, durationMs: prog.durationMs || 0 };
    return { positionMs: 0, durationMs: 0 };
  }
  function isDone(prog, url) {
    if (prog.watched && prog.watched[url]) return true;
    const p = posOf(prog, url);
    return !!(p.durationMs && p.positionMs / p.durationMs >= 0.9);
  }
  function startAtFor(prog, url) {
    if (isDone(prog, url)) return 0;
    const p = posOf(prog, url);
    return (p.positionMs || 0) > 5000 ? p.positionMs : 0;
  }
  function nextIndex(chapters, current) {
    const order = chronoOrder(chapters);
    const k = order.indexOf(current);
    return k >= 0 && k + 1 < order.length ? order[k + 1] : -1;
  }
  function prevIndex(chapters, current) {
    const order = chronoOrder(chapters);
    const k = order.indexOf(current);
    return k > 0 ? order[k - 1] : -1;
  }
  function resumeChoice(sourceId, link, chapters) {
    const prog = progressOf(sourceId, link);
    const order = chronoOrder(chapters);
    const watchedCount = chapters.filter((c) => isDone(prog, c.url)).length;
    if (!chapters.length) return { idx: 0, startAt: 0, word: "Inizia", label: "Inizia", watchedCount, order };
    let idx = chapters.findIndex((c) => c.url === prog.episodeUrl);
    let startAt = 0;
    let word;
    if (idx < 0 && !watchedCount) {
      idx = order[0];
      word = "Inizia";
    } else if (idx < 0) {
      idx = order.find((i) => !isDone(prog, chapters[i].url));
      if (idx == null) { idx = order[0]; word = "Rivedi"; } else word = "Continua";
    } else if (isDone(prog, chapters[idx].url)) {
      const k = order.indexOf(idx);
      const nxt = order.slice(k + 1).find((i) => !isDone(prog, chapters[i].url));
      if (nxt != null) { idx = nxt; word = "Continua"; }
      else if (k + 1 < order.length) { idx = order[k + 1]; word = "Continua"; }
      else word = "Rivedi";
    } else {
      startAt = startAtFor(prog, chapters[idx].url);
      word = startAt ? "Riprendi" : "Continua";
    }
    const ep = epLabel(chapters, order, idx);
    const label = word === "Inizia" ? "Inizia  ·  " + ep : word + " " + ep + (startAt ? "  ·  " + fmtShort(startAt) : "");
    return { idx, startAt, word, label, watchedCount, order };
  }

  /* ---- Hidden adult mode ----
     Extensions marked isNsfw and everything from them stay hidden until the
     secret remote sequence is entered. Never saved: hidden at every start. */
  let adult = false;
  function nsfwSource(id) {
    const key = String(id);
    const s = Mly.memory.extensions[key] || (root.extIndex || []).find((e) => String(e.id) === key);
    return !!(s && s.isNsfw);
  }
  function shown(item) {
    if (adult) return true;
    if (!item) return false;
    if (item.nsfw) return false;
    return !nsfwSource(item.sourceId != null ? item.sourceId : item.id);
  }
  function visibleLibrary() { return Mly.memory.library.filter(shown); }
  function visibleHistory() { return Mly.memory.history.filter(shown); }
  function visibleUpdates() { return Mly.memory.updates.filter(shown); }
  function visibleSources() { return Mly.ext.installedList().filter((s) => adult || !s.isNsfw); }
  function toast(text) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.getElementById("app").appendChild(el);
    }
    el.textContent = text;
    el.classList.add("on");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("on"), 1200);
  }
  function setAdult(on, keepFocus) {
    adult = !!on;
    if (!adult) {
      if (top() && top().name === "player") Mly.player.stop();
      stack.length = 0;
      root.libFocus = 0;
      root.migrate = { step: 0, entryId: "", sourceId: "", results: [], loading: false, error: "", focus: 0 };
    }
    toast("OK");
    const was = Mly.nav.current();
    if (!keepFocus && was && was.dataset.zone === "rail" && !top()) keepFocus = was;
    render();
    updateRail();
    if (keepFocus && document.contains(keepFocus)) Mly.nav.focus(keepFocus);
  }
  const secret = { zero: [], up: [] };
  function secretPress(list) {
    const now = Date.now();
    list.push(now);
    while (list.length && now - list[0] > 3000) list.shift();
    if (list.length >= 5) { list.length = 0; return true; }
    return false;
  }
  function svg(d) {
    return '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="' + d + '"/></svg>';
  }
  const ICONS = {
    library: "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z",
    updates: "M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-10 5h-2v-2h2v2zm0-4h-2V7h2v6z",
    history: "M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 117 7 6.97 6.97 0 01-4.94-2.06l-1.42 1.42A8.96 8.96 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
    browse: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z",
    more: "M6 10a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4zm-6 0a2 2 0 100 4 2 2 0 000-4z",
  };

  function stage() { return document.getElementById("stage"); }
  function top() { return stack[stack.length - 1] || null; }

  function updateRail() {
    document.querySelectorAll(".rail-btn").forEach((btn) => {
      btn.classList.toggle("is-selected", !top() && btn.dataset.tab === root.tab);
    });
    const badge = document.getElementById("badge-updates");
    if (badge) {
      const n = visibleUpdates().length;
      badge.textContent = n ? String(n) : "";
      badge.hidden = !n;
    }
  }

  function paint(html, fid) {
    const shell = document.getElementById("shell");
    shell.classList.toggle("pushed", !!top());
    updateRail();
    // On the main tabs, a redraw keeps focus on the same button when it is still there.
    const was = Mly.nav.current();
    if (!fid && root.returnFid) { fid = root.returnFid; root.returnFid = ""; }
    if (!fid && !top() && was && stage().contains(was) && was.dataset.fid) fid = was.dataset.fid;
    stage().innerHTML = html;
    mountGrids();
    if (top() && top().name === "player") Mly.player.attach(top());
    const rootEl = fid && document.querySelector('[data-fid="' + fid + '"]');
    const el = rootEl || stage().querySelector("[data-autofocus]") || stage().querySelector("[data-focus]");
    if (el) Mly.nav.focus(el);
  }

  function mountGrids() {
    document.querySelectorAll("[data-mount]").forEach((host) => {
      const kind = host.dataset.mount;
      if (kind === "library") {
        const items = libraryCards();
        Mly.grid.mount(host, {
          items,
          focusIndex: root.libFocus,
          onIndex: (i) => { root.libFocus = i; },
          onActivate: (item) => openDetail(item.sourceId, item.link, item),
        });
      } else if (kind === "source") {
        const frame = top();
        Mly.grid.mount(host, {
          items: frame.items || [],
          focusIndex: frame.focusIndex || 0,
          onIndex: (i) => {
            frame.focusIndex = i;
            // Like Mangayomi: the next page loads by itself when the focus nears the end of the grid.
            if (frame.hasNext && !frame.appending && i >= (frame.items || []).length - 12) {
              frame.appending = true;
              loadSource(frame, true).then(() => { frame.appending = false; }, () => { frame.appending = false; });
            }
          },
          onActivate: (item) => openDetail(frame.sourceId, item.link, item),
        });
      } else if (kind === "episodes") {
        const frame = top();
        const built = episodeCards(frame);
        Mly.grid.mount(host, {
          variant: "rows",
          items: built,
          focusIndex: frame.epFocus != null ? frame.epFocus : resumeChoice(frame.sourceId, frame.link, chaptersOf(frame.manga || {})).idx,
          onIndex: (i) => { frame.epFocus = i; },
          onActivate: (item, i) => playFromDetail(frame, i),
        });
      } else if (kind === "history") {
        Mly.grid.mount(host, {
          variant: "rows",
          items: historyCards(),
          onActivate: (item) => resumeItem(item),
        });
      } else if (kind === "updates") {
        Mly.grid.mount(host, {
          variant: "rows",
          items: updateCards(),
          onActivate: (item) => resumeItem(item),
        });
      } else if (kind === "migrate") {
        Mly.grid.mount(host, {
          variant: "rows",
          items: root.migrate.results,
          onActivate: (item) => confirmMigrate(item),
        });
      }
    });
  }

  function libraryCards() {
    let list = visibleLibrary();
    if (root.libCat !== "all") list = list.filter((item) => (item.categories || []).includes(root.libCat));
    if (root.libQuery) {
      const q = root.libQuery.toLowerCase();
      list = list.filter((item) => String(item.name || "").toLowerCase().includes(q));
    }
    list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return list.map((item) => ({
      name: item.name,
      imageUrl: item.imageUrl,
      link: item.link,
      sourceId: item.sourceId,
    }));
  }
  function historyCards() {
    return visibleHistory().map((item) => ({
      name: item.title,
      meta: (item.episodeName || "") + (item.positionMs ? " · " + fmtShort(item.positionMs) : ""),
      imageUrl: item.imageUrl,
      link: item.seriesLink,
      sourceId: item.sourceId,
      episodeUrl: item.episodeUrl,
      seriesLink: item.seriesLink,
      title: item.title,
      imageUrlFull: item.imageUrl,
      startAt: item.durationMs && item.positionMs / item.durationMs >= 0.9 ? 0 : item.positionMs || 0,
    }));
  }
  function updateCards() {
    return visibleUpdates().map((item) => ({
      name: item.title,
      meta: item.episodeName + (item.sourceName ? " · " + item.sourceName : ""),
      imageUrl: item.imageUrl,
      link: item.seriesLink,
      sourceId: item.sourceId,
      episodeUrl: item.episodeUrl,
      seriesLink: item.seriesLink,
      title: item.title,
      startAt: 0,
    }));
  }
  function fmtShort(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function when(ts) {
    if (!ts) return "";
    const d = new Date(Number(ts));
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("it-IT", { month: "short", day: "numeric" });
  }

  function episodeCards(frame) {
    const manga = frame.manga || {};
    const chapters = chaptersOf(manga);
    const prog = progressOf(frame.sourceId, frame.link);
    const base = (sourceOf(frame.sourceId) || {}).baseUrl || "";
    return chapters.map((ch, i) => {
      const watched = isDone(prog, ch.url);
      const at = watched ? 0 : startAtFor(prog, ch.url);
      const resume = at > 0;
      const p = posOf(prog, ch.url);
      return {
        name: (watched ? "✓ " : "") + ch.name,
        meta: (watched ? "Visto" : resume ? "Riprendi da " + fmtShort(at) + (p.durationMs ? " di " + fmtShort(p.durationMs) : "") : when(ch.dateUpload)) || "",
        imageUrl: absUrl(base, ch.imageUrl),
        url: ch.url,
        link: ch.url,
        watched,
        resume,
        index: i,
      };
    });
  }


  function render() {
    const frame = top();
    if (!frame) paint(renderRoot(), null);
    // Entering a source, as in Mangayomi: focus on the Popolari/Ultimi tab while
    // it loads, then on the first cover. Never on the Cerca button at the top.
    else if (frame.name === "source") paint(renderSource(frame), frame.loading ? (frame.tab === "search" ? "src-search" : "src-tab-" + frame.tab) : frame.error ? "src-retry" : frame.items.length ? "grid-source" : (frame.tab === "search" ? "src-search" : "src-tab-" + frame.tab));
    else if (frame.name === "detail") paint(renderDetail(frame), "detail-play");
    else if (frame.name === "player") paint(renderPlayer(frame), null);
    else if (frame.name === "prefs") paint(renderPrefs(frame), null);
    else if (frame.name === "about") paint(renderAbout(), null);
    else if (frame.name === "player-settings") paint(renderPlayerSettings(), null);
    else if (frame.name === "browse-settings") paint(renderBrowseSettings(), null);
    else if (frame.name === "language") paint(renderLanguage(), null);
    else if (frame.name === "categories") paint(renderCategories(), null);
    else paint(renderRoot(), null);
  }

  function renderRoot() {
    if (root.tab === "library") return renderLibrary();
    if (root.tab === "updates") return renderUpdates();
    if (root.tab === "history") return renderHistory();
    if (root.tab === "browse") return renderBrowse();
    return renderMore();
  }

  function screen(name, title, body, extra) {
    return '<section class="screen" data-screen="' + name + '"><header class="top"><h1>' + esc(title) + "</h1>" + (extra || "") + "</header>" + body + "</section>";
  }

  function renderLibrary() {
    const cats = Mly.memory.settings.categories || [];
    const pills = ['<button type="button" class="pill' + (root.libCat === "all" ? " is-on" : "") + '" data-focus data-act="cat" data-cat="all">Tutte</button>']
      .concat(cats.map((c) => '<button type="button" class="pill' + (root.libCat === c ? " is-on" : "") + '" data-focus data-act="cat" data-cat="' + esc(c) + '">' + esc(c) + "</button>"));
    const actions = '<div class="top-actions"><button type="button" class="text-btn" data-focus data-act="lib-search">Cerca</button></div>';
    const query = root.libQuery ? '<p class="query-line">Ricerca: ' + esc(root.libQuery) + ' <button type="button" data-focus data-act="lib-clear">Cancella</button></p>' : "";
    const items = libraryCards();
    let body = '<div class="pills">' + pills.join("") + "</div>" + query;
    if (!visibleLibrary().length) {
      body += '<div class="empty"><div class="empty-mark">' + svg(ICONS.library) + '</div><h2>La tua libreria è vuota</h2><p>Aggiungi titoli da Sfoglia per riempirla</p><button type="button" class="primary" data-focus data-autofocus data-act="goto-browse">Sfoglia</button></div>';
    } else if (!items.length) {
      body += '<div class="empty"><h2>Nessun risultato</h2><button type="button" class="text-btn" data-focus data-autofocus data-act="lib-clear">Cancella</button></div>';
    } else {
      body += '<div id="grid-library" class="vgrid-host" data-mount="library" data-focus data-grid="1" data-fid="library-grid" data-autofocus tabindex="0"></div>';
    }
    return screen("library", "Libreria", body, actions);
  }

  function renderUpdates() {
    const actions = '<div class="top-actions"><button type="button" class="text-btn" data-focus data-act="check-updates">' + (root.checking ? "Controllo in corso…" : "Controlla aggiornamenti") + "</button></div>";
    let body;
    if (!visibleUpdates().length) {
      body = '<div class="empty"><h2>Nessun aggiornamento</h2><p>Qui compaiono i nuovi episodi dei titoli in libreria.</p></div>';
    } else {
      body = '<div class="vgrid-host" data-mount="updates" data-focus data-grid="1" data-autofocus tabindex="0"></div>';
    }
    return screen("updates", "Aggiornamenti", body, actions);
  }

  function renderHistory() {
    let body;
    if (!visibleHistory().length) body = '<div class="empty"><h2>La cronologia è vuota</h2><p>Gli episodi che guardi restano salvati su questa TV.</p></div>';
    else body = '<div class="vgrid-host" data-mount="history" data-focus data-grid="1" data-autofocus tabindex="0"></div>';
    return screen("history", "Cronologia", body, "");
  }

  function renderBrowse() {
    const tabs = ["sources", "extensions", "migrate"].map((id) => {
      const label = id === "sources" ? "Sorgenti" : id === "extensions" ? "Estensioni" : "Migra";
      return '<button type="button" class="pill' + (root.browse === id ? " is-on" : "") + '" data-focus data-fid="browse-' + id + '" data-act="browse" data-tab="' + id + '"' + (root.browse === id ? " data-autofocus" : "") + ">" + label + "</button>";
    }).join("");
    let body = '<div class="pills pills-center">' + tabs + "</div>";
    if (root.browse === "sources") body += renderSources();
    else if (root.browse === "extensions") body += renderExtensions();
    else body += renderMigrate();
    return screen("browse", "Sfoglia", body, "");
  }

  function renderSources() {
    const list = visibleSources();
    if (!list.length) {
      return '<div class="empty"><h2>Nessuna sorgente</h2><p>Installane una da Estensioni.</p><button type="button" class="primary" data-focus data-act="browse" data-tab="extensions">Estensioni</button></div>';
    }
    return '<div class="rows" data-rownav>' + list.map((s) => (
      '<div class="row">' +
      '<button type="button" class="row-main" data-focus data-act="open-source" data-id="' + esc(s.id) + '" data-fid="source-' + esc(s.id) + '">' +
      '<span class="row-title">' + esc(s.name) + "</span>" +
      '<span class="row-meta">' + esc((s.lang || "").toUpperCase()) + (s.isNsfw ? " · 18+" : "") + (s.pinned ? " · Fissata" : "") + "</span></button>" +
      '<button type="button" class="text-btn" data-focus data-act="pin" data-id="' + esc(s.id) + '">' + (s.pinned ? "Sblocca" : "Fissa") + "</button>" +
      '<button type="button" class="text-btn" data-focus data-act="open-prefs" data-id="' + esc(s.id) + '">Impostazioni</button></div>'
    )).join("") + "</div>";
  }

  function renderExtensions() {
    if (root.extLoading) return '<div class="empty"><h2>Caricamento…</h2></div>';
    if (root.extError) return '<div class="empty"><h2>Impossibile caricare il repository</h2><p>' + esc(root.extError) + '</p><button type="button" class="primary" data-focus data-autofocus data-act="reload-index">Riprova</button></div>';
    const index = (root.extIndex || []).filter((e) => adult || !e.isNsfw);
    if (!index.length) return '<div class="empty"><h2>Nessuna estensione</h2><button type="button" class="primary" data-focus data-act="reload-index">Aggiorna</button></div>';
    return '<div class="rows" data-rownav>' + index.map((entry) => {
      const installed = Mly.memory.extensions[String(entry.id)];
      let action = "Installa";
      let act = "install";
      if (installed && installed.version !== entry.version) { action = "Aggiorna"; act = "install"; }
      else if (installed) { action = "Installata"; act = "noop"; }
      const busy = root.busyId === String(entry.id);
      const eid = esc(entry.id);
      // Row, then its buttons, each reachable with the arrows (see nav.js, data-rownav).
      // Button ids are by position so focus stays put when Installa turns into Disinstalla.
      const buttons = [];
      if (busy) buttons.push('<button type="button" class="text-btn row-btn" data-focus data-act="noop" data-eid="' + eid + '">…</button>');
      else if (act === "install") buttons.push('<button type="button" class="text-btn row-btn' + (installed ? "" : " is-install") + '" data-focus data-act="install" data-eid="' + eid + '">' + action + "</button>");
      if (installed && !busy) buttons.push('<button type="button" class="text-btn row-btn" data-focus data-act="uninstall" data-eid="' + eid + '">Disinstalla</button>');
      const html = buttons.map((b, i) => b.replace("<button ", '<button data-fid="ext-' + eid + "-b" + (i + 1) + '" ')).join("");
      return '<div class="row"><button type="button" class="row-main" data-focus data-act="' + (busy ? "noop" : act) + '" data-eid="' + eid + '" data-fid="ext-' + eid + '">' +
        '<span class="row-title">' + esc(entry.name) + "</span>" +
        '<span class="row-meta">' + esc((entry.lang || "").toUpperCase()) + " · " + esc(entry.version) + (entry.isNsfw ? " · 18+" : "") + (entry.hasCloudflare ? " · Controllo browser" : "") + (installed && act === "noop" ? " · Installata" : "") + "</span></button>" +
        html + "</div>";
    }).join("") + '<div class="footer-row"><button type="button" class="text-btn" data-focus data-act="reload-index">Aggiorna</button></div></div>';
  }

  function renderMigrate() {
    const lib = visibleLibrary();
    if (!lib.length) return '<div class="empty"><h2>Nessun titolo in libreria da migrare.</h2></div>';
    const m = root.migrate;
    if (m.step === 0) {
      return '<p class="lead">Scegli un titolo della libreria, poi la sorgente in cui cercarlo.</p><div class="rows">' + lib.map((item) => (
        '<button type="button" class="row-main" data-focus data-act="mig-title" data-id="' + esc(item.id) + '"><span class="row-title">' + esc(item.name) + '</span><span class="row-meta">' + esc(item.sourceName || "") + "</span></button>"
      )).join("") + "</div>";
    }
    const entry = lib.find((item) => item.id === m.entryId);
    if (m.step === 1) {
      const sources = visibleSources().filter((s) => !entry || String(s.id) !== String(entry.sourceId));
      if (!sources.length) return '<div class="empty"><h2>Installa un\'altra sorgente per migrare.</h2></div>';
      return '<p class="lead">Migra ' + esc(entry ? entry.name : "") + '</p><div class="rows">' + sources.map((s) => (
        '<button type="button" class="row-main" data-focus data-act="mig-source" data-id="' + esc(s.id) + '"><span class="row-title">' + esc(s.name) + "</span></button>"
      )).join("") + "</div>";
    }
    if (m.loading) return '<div class="empty"><h2>Ricerca in corso…</h2></div>';
    if (m.error) return '<div class="empty"><h2>Nessun risultato</h2><p>' + esc(m.error) + '</p></div>';
    if (!m.results.length) return '<div class="empty"><h2>Nessun risultato</h2></div>';
    return '<p class="lead">Scegli il titolo corrispondente.</p><div class="vgrid-host" data-mount="migrate" data-focus data-grid="1" data-autofocus tabindex="0"></div>';
  }

  function renderMore() {
    const rows = [
      ["categories", "Categorie"],
      ["player-settings", "Lettore"],
      ["browse-settings", "Sfoglia"],
      ["language", "Lingua"],
      ["about", "Informazioni"],
    ];
    const body = '<div class="rows">' + rows.map((r, i) => (
      '<button type="button" class="row-main" data-focus' + (i === 0 ? " data-autofocus" : "") + ' data-act="push" data-screen="' + r[0] + '"><span class="row-title">' + r[1] + "</span></button>"
    )).join("") + "</div>";
    return screen("more", "Altro", body, "");
  }

  function renderAbout() {
    return screen("about", "Informazioni", '<div class="prose"><p>Mangayomi per TV Samsung. Libreria anime, estensioni e lettore, con la stessa API delle estensioni di Mangayomi.</p><p>Versione 0.3.7</p><p>Questa TV non ha WebView: Cookie, Referer e User-Agent non si possono impostare. Cloudflare, anti-bot, paywall e verifiche dell\'età non vengono aggirati.</p><p>La riproduzione parte alla qualità più alta. Per HLS si usa la variante più alta, non Auto.</p><p>Le estensioni arrivano dai repository indicati in Altro › Sfoglia.</p></div>', "");
  }

  function renderPlayerSettings() {
    const on = !!Mly.memory.settings.useAvPlay;
    const av = !!(window.webapis && window.webapis.avplay);
    return screen("player-settings", "Lettore", '<div class="rows"><div class="row-main static"><span class="row-title">Parti alla qualità più alta</span><span class="row-meta">Attivo. Per HLS viene bloccata la variante più alta, non Auto.</span></div>' +
      '<button type="button" class="row-main" data-focus data-autofocus data-act="toggle-av"><span class="row-title">Samsung AVPlay per MP4</span><span class="row-meta">' + (av ? (on ? "Attivo" : "Disattivo") : "Non disponibile su questo dispositivo. Si usano video HTML e hls.js.") + "</span></button></div>", "");
  }

  // Più repository di estensioni, come in Mangayomi: ogni riga con «Rimuovi», sotto «Aggiungi repository».
  function renderBrowseSettings() {
    const urls = Mly.memory.settings.repoUrls || [];
    const rows = urls.length ? urls.map((u, i) => (
      '<div class="row"><span class="row-title pad mono">' + esc(u) + '</span><button type="button" class="text-btn" data-focus data-fid="repo-del-' + i + '"' + (i === 0 ? " data-autofocus" : "") + ' data-act="del-repo" data-i="' + i + '">Rimuovi</button></div>'
    )).join("") : '<p class="row-meta pad">Nessun repository. Aggiungine uno per vedere le estensioni.</p>';
    return screen("browse-settings", "Sfoglia", '<div class="prose"><p>Repository anime</p><p class="row-meta">Indirizzo di un anime_index.json (repository di estensioni Mangayomi).</p></div><div class="rows" data-rownav>' + rows + '</div><div class="button-row"><button type="button" class="primary" data-focus data-fid="repo-add"' + (urls.length ? "" : " data-autofocus") + ' data-act="add-repo">Aggiungi repository</button></div>', "");
  }

  function renderLanguage() {
    const cur = Mly.memory.settings.lang || "auto";
    const opts = [["auto", "Lingua della TV (automatica)"], ["it", "Italiano"], ["en", "English"]];
    const body = '<div class="rows">' + opts.map((o) => (
      '<button type="button" class="row-main" data-focus data-fid="lang-' + o[0] + '"' + (o[0] === cur ? " data-autofocus" : "") + ' data-act="set-lang" data-lang="' + o[0] + '"><span class="row-title">' + (o[0] === cur ? "✓ " : "") + esc(o[1]) + "</span></button>"
    )).join("") + '</div><p class="row-meta pad">Si applica subito; l\'app si ricarica.</p>';
    return screen("language", "Lingua", body, "");
  }

  function renderCategories() {
    const cats = Mly.memory.settings.categories || [];
    const body = '<div class="rows">' + cats.map((c) => (
      '<div class="row"><span class="row-title pad">' + esc(c) + '</span><button type="button" class="text-btn" data-focus data-act="del-cat" data-cat="' + esc(c) + '">Rimuovi</button></div>'
    )).join("") + '</div><div class="button-row"><button type="button" class="primary" data-focus data-autofocus data-act="add-cat">Nuova categoria</button></div>';
    return screen("categories", "Categorie", body, "");
  }

  function renderSource(frame) {
    const src = sourceOf(frame.sourceId) || { name: "Sorgente" };
    const tabs = '<div class="pills"><button type="button" class="pill' + (frame.tab === "popular" ? " is-on" : "") + '" data-focus data-fid="src-tab-popular" data-down="grid-source"' + (frame.tab === "popular" ? " data-autofocus" : "") + ' data-act="src-tab" data-tab="popular">Popolari</button>' +
      (frame.supportsLatest !== false ? '<button type="button" class="pill' + (frame.tab === "latest" ? " is-on" : "") + '" data-focus data-fid="src-tab-latest" data-down="grid-source"' + (frame.tab === "latest" ? " data-autofocus" : "") + ' data-act="src-tab" data-tab="latest">Ultimi</button>' : "") +
      "</div>";
    const tools = '<div class="top-actions"><button type="button" class="text-btn" data-focus data-fid="src-search" data-act="src-search">Cerca</button><button type="button" class="text-btn" data-focus data-fid="src-filter" data-act="src-filter">Filtri</button><button type="button" class="text-btn" data-focus data-act="open-prefs" data-id="' + esc(frame.sourceId) + '">Impostazioni</button><button type="button" class="text-btn" data-focus data-act="no-webview">Web</button></div>';
    let body = tabs;
    if (frame.tab === "search") body += '<p class="query-line">Ricerca: ' + esc(frame.query || "(filtri)") + "</p>";
    if (frame.loading) body += '<div class="empty"><h2>Caricamento…</h2></div>';
    else if (frame.error) body += '<div class="empty"><h2>Impossibile caricare la sorgente</h2><p>' + esc(frame.error) + '</p><button type="button" class="primary" data-focus data-fid="src-retry" data-autofocus data-act="src-retry">Riprova</button></div>';
    else if (!frame.items.length) body += '<div class="empty"><h2>Nessun risultato</h2></div>';
    else {
      body += '<div id="grid-source" class="vgrid-host" data-mount="source" data-focus data-grid="1" data-fid="grid-source" data-up="' + (frame.tab === "search" ? "src-search" : "src-tab-" + frame.tab) + '" data-autofocus tabindex="0"></div>';
      if (frame.hasNext) body += '<div class="footer-row"><button type="button" class="text-btn" data-focus data-act="more" data-up="grid-source">Carica altro</button></div>';
    }
    return '<section class="screen" data-screen="source"><header class="top"><h1>' + esc(src.name) + "</h1>" + tools + "</header>" + body + "</section>";
  }

  function renderDetail(frame) {
    const src = sourceOf(frame.sourceId) || {};
    const manga = frame.manga || frame.preview || {};
    const base = src.baseUrl || "";
    const name = manga.name || (frame.preview && frame.preview.name) || "Senza titolo";
    const image = absUrl(base, manga.imageUrl || (frame.preview && frame.preview.imageUrl) || "");
    const chapters = chaptersOf(manga);
    const choice = resumeChoice(frame.sourceId, frame.link, chapters);
    const inLib = !!findLibrary(frame.sourceId, frame.link);
    const genres = (manga.genre || []).filter(Boolean).slice(0, 8);
    const meta = [statusName(manga.status), chapters.length ? chapters.length + " episodi" : "", src.name || "", manga.author || ""].filter(Boolean).join("   ·   ");
    const actions = [
      ['<button type="button" class="action primary-action" data-focus data-autofocus data-fid="detail-play" data-act="detail-play">' + esc(choice.label) + "</button>", true],
      ['<button type="button" class="action" data-focus data-act="toggle-lib">' + (inLib ? "In libreria" : "Aggiungi alla libreria") + "</button>", true],
      ['<button type="button" class="action" data-focus data-act="detail-cats">Categorie</button>', true],
      ['<button type="button" class="action" data-focus data-act="detail-track">Tracciamento</button>', true],
      ['<button type="button" class="action" data-focus data-act="no-webview">Apri nel browser</button>', true],
      ['<button type="button" class="action" data-focus data-act="detail-rec">Consigliati</button>', true],
      ['<button type="button" class="action" data-focus data-act="detail-order">Ordine di visione</button>', true],
      ['<button type="button" class="action" data-focus data-act="detail-migrate">Migra</button>', true],
    ];
    const cover = Mly.grid.thumb(image);
    const left = '<div class="detail-hero">' + (cover ? '<img class="detail-cover" alt="" width="150" height="220" src="' + esc(cover) + '">' : '<div class="detail-cover"></div>') + '<div><h1>' + esc(name) + "</h1><p class=\"meta\">" + esc(meta) + "</p>" +
      (genres.length ? '<div class="genres">' + genres.map((g) => "<span>" + esc(g) + "</span>").join("") + "</div>" : "") +
      "</div></div><p class=\"desc\">" + esc(manga.description || "") + "</p><div class=\"actions\">" + actions.map((a) => a[0]).join("") + "</div>";
    let right;
    if (frame.loading && !chapters.length) right = '<div class="empty"><h2>Caricamento…</h2></div>';
    else if (frame.error && !chapters.length) right = '<div class="empty"><p>' + esc(frame.error) + '</p><button type="button" class="text-btn" data-focus data-act="detail-refresh">Riprova</button></div>';
    else if (!chapters.length) right = '<div class="empty"><h2>Nessun episodio</h2></div>';
    else right = '<div class="eps-head">Episodi' + (choice.watchedCount ? " · " + choice.watchedCount + " visti" : "") + '</div><div class="vgrid-host" data-mount="episodes" data-focus data-grid="1" tabindex="0"></div>';
    return '<section class="screen detail-screen" data-screen="detail"><div class="detail-left">' + left + '</div><div class="detail-right">' + right + "</div></section>";
  }

  // Player overlay as in Mangayomi: title and episode on top, seek bar with
  // times, then the control row (episodes, play/pause, skip intro, quality, subtitles).
  const ICON = {
    prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
    back10: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6zM11.5 12l8.5 6V6z"/></svg>',
    fwd10: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6zM13 6v12l8.5-6z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6zM14 5v14h4V5z"/></svg>',
  };
  function renderPlayer(frame) {
    const buttons = qualityRows(frame.videos);
    const b = (id, label, icon, extra) => '<button type="button" class="pctl' + (extra || "") + '" data-pc="' + id + '" aria-label="' + esc(label) + '">' + (icon || "") + (icon && extra && extra.indexOf("icon-only") >= 0 ? "" : '<span class="pctl-label">' + esc(label) + "</span>") + "</button>";
    return '<section class="screen player-screen" data-screen="player"><video id="player-video" playsinline></video>' +
      '<div id="player-shade" class="player-shade is-shown">' +
      '<div class="player-top"><div class="player-name">' + esc(frame.title) + '</div><div class="player-ep">' + esc(frame.episodeName) + "</div></div>" +
      '<div id="player-center" class="player-center" hidden>' + ICON.play + "</div>" +
      '<div id="player-wait" class="player-wait" role="status" aria-label="Caricamento"></div>' +
      '<p id="player-error" class="player-error" hidden></p>' +
      '<div class="player-bottom">' +
      '<div class="seek-row"><span id="player-cur" class="player-t">0:00</span><div class="track"><div id="player-bar" class="track-fill"></div><div id="player-knob" class="track-knob"></div></div><span id="player-dur" class="player-t">0:00</span></div>' +
      '<div id="player-ctl" class="ctl-row"><div class="ctl-group">' +
      b("prev", "Episodio precedente", ICON.prev, " icon-only") + b("back10", "Indietro 10 s", ICON.back10, " icon-only") +
      b("play", "Pausa", ICON.pause, " icon-only big") + b("fwd10", "Avanti 10 s", ICON.fwd10, " icon-only") + b("next", "Episodio successivo", ICON.next, " icon-only") +
      '</div><div class="ctl-group">' +
      b("skip", "+85 s  Salta intro", "", " pill-btn") + b("quality", "Video", "", " pill-btn") + b("subs", "Sottotitoli", "", " pill-btn") +
      "</div></div>" +
      '<div id="player-time" class="player-time" hidden></div><div id="player-quality" class="player-quality" hidden></div>' +
      '</div><div id="player-qualities" class="quality-sheet" hidden><div class="sheet-handle"></div><h3 class="sheet-title">Qualità</h3><div id="player-quality-rows" class="sheet-rows">' + buttons + "</div></div></div></section>";
  }
  // Rows of the Mangayomi-style quality sheet: full label, check on the current one.
  function qualityRows(videos) {
    return (videos || []).map((v, i) => (
      '<button type="button" class="sheet-row" data-act="quality" data-i="' + i + '"><span class="sheet-check"><svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span><span class="sheet-label">' + esc(v.quality || ("Opzione " + (i + 1))) + "</span></button>"
    )).join("");
  }

  function renderPrefs(frame) {
    let prefs = [];
    let error = "";
    try { prefs = Mly.ext.getPreferences(frame.sourceId); }
    catch (e) { error = e.message; }
    frame.prefs = prefs;
    const src = sourceOf(frame.sourceId) || { name: "Sorgente" };
    let body;
    if (error) body = '<div class="empty"><p>' + esc(error) + "</p></div>";
    else if (!prefs.length) body = '<div class="empty"><h2>Nessuna impostazione</h2></div>';
    else body = '<div class="rows">' + prefs.map((p, i) => prefButton(p, i)).join("") + "</div>";
    return screen("prefs", src.name, body, "");
  }
  function prefButton(p, i) {
    if (p.switchPreferenceCompat || p.checkBoxPreference) {
      const o = p.switchPreferenceCompat || p.checkBoxPreference;
      return '<button type="button" class="row-main" data-focus data-act="pref-bool" data-i="' + i + '"><span class="row-title">' + esc(o.title || p.key) + '</span><span class="row-meta">' + (o.value ? "Attivo" : "Disattivo") + (o.summary ? " · " + esc(o.summary) : "") + "</span></button>";
    }
    if (p.listPreference) {
      const lp = p.listPreference;
      const idx = lp.valueIndex || 0;
      const label = (lp.entries || [])[idx] || "";
      return '<button type="button" class="row-main" data-focus data-act="pref-list" data-i="' + i + '"><span class="row-title">' + esc(lp.title || p.key) + '</span><span class="row-meta">' + esc(label) + "</span></button>";
    }
    if (p.editTextPreference) {
      const ed = p.editTextPreference;
      return '<button type="button" class="row-main" data-focus data-act="pref-text" data-i="' + i + '"><span class="row-title">' + esc(ed.title || p.key) + '</span><span class="row-meta">' + esc(ed.value || "") + "</span></button>";
    }
    if (p.multiSelectListPreference) {
      const ms = p.multiSelectListPreference;
      const chosen = ms.values || [];
      return '<div class="filter-block"><div class="filter-name">' + esc(ms.title || p.key) + "</div>" + (ms.entryValues || []).map((val, j) => {
        const on = chosen.includes(val);
        const name = (ms.entries || [])[j] || val;
        return '<button type="button" class="pill' + (on ? " is-on" : "") + '" data-focus data-act="pref-multi" data-i="' + i + '" data-j="' + j + '">' + esc(name) + "</button>";
      }).join("") + "</div>";
    }
    return "";
  }

  function rememberFocus() {
    const cur = Mly.nav.current();
    paintDialog.returnTo = cur && document.contains(cur) ? cur : null;
    paintDialog.returnFid = cur && cur.dataset && cur.dataset.fid ? cur.dataset.fid : "";
  }
  function restoreFocus() {
    const back = paintDialog.returnTo;
    const fid = paintDialog.returnFid || "";
    paintDialog.returnTo = null;
    paintDialog.returnFid = "";
    if (back && document.contains(back)) { Mly.nav.focus(back); return; }
    const again = fid && stage() && stage().querySelector('[data-fid="' + fid + '"]');
    const fallback = again || (stage() && (stage().querySelector("[data-autofocus]") || stage().querySelector("[data-focus]")));
    if (fallback) Mly.nav.focus(fallback);
  }
  function paintDialog() {
    let el = document.getElementById("dialog");
    if (!root.dialog) {
      if (el) el.remove();
      restoreFocus();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "dialog";
      el.dataset.modal = "1";
      document.getElementById("app").appendChild(el);
    }
    if (root.dialog.confirm) {
      // As in Mangayomi: Annulla / confirm, with the safe choice focused first.
      el.innerHTML = '<div class="sheet confirm-sheet"><h2>' + esc(root.dialog.title) + "</h2><p>" + esc(root.dialog.body) + '</p><div class="button-row confirm-row"><button type="button" class="text-btn" data-focus data-autofocus data-act="close-dialog" data-fid="confirm-cancel">Annulla</button><button type="button" class="primary danger" data-focus data-act="confirm-ok" data-fid="confirm-ok">' + esc(root.dialog.okLabel || "OK") + "</button></div></div>";
      Mly.nav.focus(el.querySelector("[data-autofocus]"));
      return;
    }
    el.innerHTML = '<div class="sheet"><h2>' + esc(root.dialog.title) + "</h2><p>" + esc(root.dialog.body) + '</p><button type="button" class="primary" data-focus data-autofocus data-act="close-dialog">OK</button></div>';
    Mly.nav.focus(el.querySelector("[data-focus]"));
  }
  function paintOsk() {
    let el = document.getElementById("osk");
    if (!root.osk) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "osk";
      el.dataset.modal = "1";
      document.getElementById("app").appendChild(el);
    }
    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", ".:/-_"];
    const keys = rows.map((row) => '<div class="osk-row">' + [...row].map((ch) => '<button type="button" class="key" data-focus data-act="osk" data-key="' + esc(ch) + '">' + esc(ch) + "</button>").join("") + "</div>").join("");
    el.innerHTML = '<div class="sheet osk-sheet"><h2>' + esc(root.osk.title) + '</h2><p id="osk-value" class="mono">' + esc(root.osk.value || "") + '</p>' + keys +
      '<div class="osk-row"><button type="button" class="key wide" data-focus data-act="osk" data-key=" ">Spazio</button><button type="button" class="key" data-focus data-act="osk" data-key="back">Cancella</button><button type="button" class="key" data-focus data-act="osk" data-key="clear">Svuota</button><button type="button" class="primary" data-focus data-act="osk" data-key="done">Fatto</button></div></div>';
    const first = el.querySelector("[data-focus]");
    if (first) Mly.nav.focus(first);
  }
  function paintFilters() {
    let el = document.getElementById("filters");
    const frame = root.filtersFor;
    if (!frame || !frame.showFilters) {
      if (el) el.remove();
      if (paintFilters.wasOpen) { paintFilters.wasOpen = false; restoreFocus(); }
      return;
    }
    if (!el) {
      rememberFocus();
      paintFilters.wasOpen = true;
      el = document.createElement("div");
      el.id = "filters";
      el.dataset.modal = "1";
      document.getElementById("app").appendChild(el);
    }
    const blocks = (frame.filterDraft || []).map((f, i) => filterBlock(f, i)).join("");
    el.innerHTML = '<div class="sheet filter-sheet"><h2>Filtri</h2><div class="filter-scroll">' + (blocks || "<p>Questa sorgente non ha filtri.</p>") + '</div><div class="button-row"><button type="button" class="text-btn" data-focus data-act="filter-reset">Azzera</button><button type="button" class="primary" data-focus data-autofocus data-act="filter-apply">Cerca</button></div></div>';
    Mly.nav.focus(el.querySelector("[data-autofocus]"));
  }
  function filterBlock(f, i) {
    const type = f.type_name || "";
    if (type === "HeaderFilter") return '<p class="filter-note">' + esc(f.name || "") + "</p>";
    if (type === "SeparatorFilter") return "<hr>";
    if (type === "SelectFilter") {
      return '<div class="filter-block"><div class="filter-name">' + esc(f.name) + "</div>" + (f.values || []).map((o, j) => (
        '<button type="button" class="pill' + (j === f.state ? " is-on" : "") + '" data-focus data-act="fopt" data-fi="' + i + '" data-j="' + j + '">' + esc(o.name) + "</button>"
      )).join("") + "</div>";
    }
    if (type === "TextFilter") return '<button type="button" class="row-main" data-focus data-act="ftext" data-fi="' + i + '"><span class="row-title">' + esc(f.name) + '</span><span class="row-meta">' + esc(f.state || "") + "</span></button>";
    if (type === "SortFilter") {
      const st = f.state || { index: 0, ascending: true };
      return '<div class="filter-block"><div class="filter-name">' + esc(f.name) + "</div>" + (f.values || []).map((o, j) => (
        '<button type="button" class="pill' + (j === st.index ? " is-on" : "") + '" data-focus data-act="fsort" data-fi="' + i + '" data-j="' + j + '">' + esc(o.name || o) + "</button>"
      )).join("") + '<button type="button" class="text-btn" data-focus data-act="fsort-dir" data-fi="' + i + '">' + (st.ascending ? "Crescente" : "Decrescente") + "</button></div>";
    }
    if (type === "CheckBox" || type === "CheckBoxFilter") {
      return '<button type="button" class="pill' + (f.state ? " is-on" : "") + '" data-focus data-act="fcheck" data-fi="' + i + '">' + esc(f.name) + "</button>";
    }
    if (type === "TriState") {
      return '<button type="button" class="pill" data-focus data-act="ftri" data-fi="' + i + '">' + esc(f.name) + " (" + (f.state || 0) + ")</button>";
    }
    if (type === "GroupFilter") {
      return '<div class="filter-block"><div class="filter-name">' + esc(f.name) + "</div>" + (f.state || []).map((s, j) => (
        '<button type="button" class="pill' + (s.state ? " is-on" : "") + '" data-focus data-act="fgroup" data-fi="' + i + '" data-j="' + j + '">' + esc(s.name) + "</button>"
      )).join("") + "</div>";
    }
    return "";
  }

  function openOsk(opts) {
    rememberFocus();
    root.osk = { title: opts.title || "Cerca", value: opts.value || "", apply: opts.apply };
    paintOsk();
  }
  function closeOsk() {
    root.osk = null;
    const el = document.getElementById("osk");
    if (el) el.remove();
    restoreFocus();
  }

  async function ensureIndex() {
    if (root.extLoading) return;
    root.extLoading = true;
    root.extError = "";
    if (!top() && root.tab === "browse") render();
    try {
      root.extIndex = await Mly.ext.fetchIndex(Mly.memory.settings.repoUrls);
      root.extLoading = false;
    } catch (e) {
      root.extLoading = false;
      root.extError = e.message || String(e);
    }
    if (!top() && root.tab === "browse" && root.browse === "extensions") render();
  }

  function openSource(id) {
    const frame = {
      name: "source", sourceId: String(id), tab: "popular", items: [], page: 1, hasNext: false,
      loading: true, error: "", query: "", filters: null, filterDraft: null, showFilters: false,
      focusIndex: 0, supportsLatest: true,
    };
    try { frame.supportsLatest = Mly.ext.supportsLatest(id); } catch (e) { frame.supportsLatest = true; }
    stack.push(frame);
    render();
    loadSource(frame, false);
  }

  async function loadSource(frame, append) {
    frame.loading = !append;
    frame.error = "";
    if (!append) render();
    const page = append ? frame.page + 1 : 1;
    try {
      let res;
      if (frame.tab === "latest") res = await Mly.ext.call(frame.sourceId, "getLatestUpdates", (e) => e.getLatestUpdates(page));
      else if (frame.tab === "search") res = await Mly.ext.call(frame.sourceId, "search", (e) => e.search(frame.query || "", page, frame.filters || []));
      else res = await Mly.ext.call(frame.sourceId, "getPopular", (e) => e.getPopular(page));
      if (top() !== frame) return;
      const list = ((res && res.list) || []).map((item) => ({
        name: item.name || "",
        link: item.link || "",
        imageUrl: absUrl((sourceOf(frame.sourceId) || {}).baseUrl, item.imageUrl || ""),
      }));
      frame.page = page;
      frame.hasNext = !!(res && res.hasNextPage && list.length);
      frame.items = append ? frame.items.concat(list) : list;
      frame.loading = false;
      if (!frame.items.length) {
        const note = Mly.runtime.blockNote();
        if (note) frame.error = note;
      }
      render();
    } catch (e) {
      if (top() !== frame) return;
      frame.loading = false;
      frame.error = e.message || String(e);
      render();
    }
  }

  function openDetail(sourceId, link, preview) {
    const saved = findLibrary(sourceId, link);
    const frame = {
      name: "detail",
      sourceId: String(sourceId),
      link,
      preview: preview || saved || { name: "", imageUrl: "", link },
      manga: saved ? Object.assign({}, saved) : null,
      loading: true,
      error: "",
      epFocus: null,
    };
    stack.push(frame);
    render();
    refreshDetail(frame);
  }
  async function refreshDetail(frame) {
    try {
      const manga = await Mly.ext.call(frame.sourceId, "getDetail", (e) => e.getDetail(frame.link));
      if (!stack.includes(frame)) return;
      const prev = frame.preview || {};
      frame.manga = Object.assign({ name: prev.name, imageUrl: prev.imageUrl, link: frame.link }, manga || {});
      if (!frame.manga.name) frame.manga.name = prev.name;
      if (!frame.manga.imageUrl) frame.manga.imageUrl = prev.imageUrl;
      frame.loading = false;
      frame.error = "";
      const saved = findLibrary(frame.sourceId, frame.link);
      if (saved && frame.manga) {
        saved.chapters = chaptersOf(frame.manga);
        saved.description = frame.manga.description || saved.description;
        saved.status = frame.manga.status;
        saved.genre = frame.manga.genre || saved.genre;
        saved.imageUrl = frame.manga.imageUrl || saved.imageUrl;
        saved.name = frame.manga.name || saved.name;
        Mly.db.saveLibrary();
      }
      if (top() === frame) render();
    } catch (e) {
      if (!stack.includes(frame)) return;
      frame.loading = false;
      frame.error = e.message || String(e);
      if (top() === frame) render();
    }
  }

  function toggleLibrary(frame) {
    const id = seriesKey(frame.sourceId, frame.link);
    const idx = Mly.memory.library.findIndex((item) => item.id === id);
    if (idx >= 0) Mly.memory.library.splice(idx, 1);
    else {
      const src = sourceOf(frame.sourceId) || {};
      const manga = frame.manga || frame.preview || {};
      const chapters = chaptersOf(manga);
      Mly.memory.library.unshift({
        id,
        sourceId: frame.sourceId,
        sourceName: src.name || "",
        nsfw: !!src.isNsfw,
        link: frame.link,
        name: manga.name || (frame.preview && frame.preview.name) || "Senza titolo",
        imageUrl: manga.imageUrl || (frame.preview && frame.preview.imageUrl) || "",
        description: manga.description || "",
        author: manga.author || "",
        status: manga.status,
        genre: manga.genre || [],
        chapters,
        categories: [],
        knownUrls: chapters.map((c) => c.url),
        addedAt: Date.now(),
      });
    }
    Mly.db.saveLibrary();
    render();
  }

  async function playFromDetail(frame, index) {
    const chapters = chaptersOf(frame.manga || {});
    const prog = progressOf(frame.sourceId, frame.link);
    const ch = chapters[index];
    if (!ch) return;
    const startAt = startAtFor(prog, ch.url);
    const manga = frame.manga || frame.preview || {};
    await startPlayback({
      sourceId: frame.sourceId,
      seriesLink: frame.link,
      title: manga.name || "",
      imageUrl: manga.imageUrl || "",
      episodes: chapters,
      episodeIndex: index,
      startAt,
    });
  }

  async function startPlayback(info) {
    const ep = info.episodes[info.episodeIndex];
    if (!ep) { openDialog("Riproduzione", "Questo titolo non ha episodi."); return; }
    let videos;
    try {
      videos = await Mly.ext.call(info.sourceId, "getVideoList", (e) => e.getVideoList(ep.url));
    } catch (e) {
      openDialog("Riproduzione", e.message || String(e));
      return;
    }
    const usable = (videos || []).filter((v) => v && v.url).map((v) => ({
      url: v.url,
      originalUrl: v.originalUrl || v.url,
      quality: v.quality || "",
      subtitles: (v.subtitles || []).filter((t) => t && t.file).map((t) => ({ file: t.file, label: t.label || "" })),
      headers: v.headers || {},
    }));
    if (!usable.length) { openDialog("Riproduzione", "Nessun flusso da riprodurre."); return; }
    stack.push({
      name: "player",
      sourceId: info.sourceId,
      seriesLink: info.seriesLink,
      title: info.title || ep.name,
      imageUrl: info.imageUrl || "",
      episodes: info.episodes,
      episodeIndex: info.episodeIndex,
      episodeName: ep.name,
      videos: usable,
      startAt: info.startAt || 0,
    });
    render();
  }

  async function resumeItem(item) {
    try {
      const manga = await Mly.ext.call(item.sourceId, "getDetail", (e) => e.getDetail(item.seriesLink || item.link));
      const episodes = chaptersOf(manga);
      let idx = episodes.findIndex((c) => c.url === item.episodeUrl);
      if (idx < 0) idx = 0;
      await startPlayback({
        sourceId: item.sourceId,
        seriesLink: item.seriesLink || item.link,
        title: item.title || (manga && manga.name) || "",
        imageUrl: (manga && manga.imageUrl) || item.imageUrl || "",
        episodes,
        episodeIndex: idx,
        startAt: item.startAt || 0,
      });
    } catch (e) {
      openDialog("Riproduzione", e.message || String(e));
    }
  }

  function openDialog(title, body) {
    rememberFocus();
    root.dialog = { title, body };
    paintDialog();
  }
  function openConfirm(title, body, okLabel, onOk) {
    rememberFocus();
    root.dialog = { title, body, confirm: true, okLabel, onOk };
    paintDialog();
  }

  function rememberPlayback(frame, positionMs, durationMs, done) {
    const key = seriesKey(frame.sourceId, frame.seriesLink);
    const prev = Mly.memory.progress[key] || { watched: {} };
    const ep = frame.episodes[frame.episodeIndex];
    if (!ep) return;
    const ratio = durationMs ? positionMs / durationMs : 0;
    if (!prev.watched) prev.watched = {};
    if (done || ratio >= 0.9) prev.watched[ep.url] = true;
    if (!durationMs && prev.positions && prev.positions[ep.url]) durationMs = prev.positions[ep.url].durationMs || 0;
    prev.positions = prev.positions || {};
    prev.positions[ep.url] = { positionMs: done ? durationMs || positionMs : positionMs, durationMs, at: Date.now() };
    const keys = Object.keys(prev.positions);
    if (keys.length > 400) keys.sort((a, b) => prev.positions[a].at - prev.positions[b].at).slice(0, keys.length - 400).forEach((k) => delete prev.positions[k]);
    prev.episodeUrl = ep.url;
    prev.positionMs = positionMs;
    prev.durationMs = durationMs;
    prev.at = Date.now();
    Mly.memory.progress[key] = prev;
    Mly.db.saveProgress();
    const entry = {
      id: frame.sourceId + "|" + ep.url,
      sourceId: frame.sourceId,
      nsfw: nsfwSource(frame.sourceId),
      seriesLink: frame.seriesLink,
      episodeUrl: ep.url,
      title: frame.title,
      episodeName: ep.name,
      imageUrl: frame.imageUrl,
      positionMs,
      durationMs,
      at: Date.now(),
    };
    Mly.memory.history = [entry].concat(Mly.memory.history.filter((h) => h.id !== entry.id)).slice(0, 200);
    Mly.db.saveHistory();
    if (prev.watched[ep.url]) {
      Mly.memory.updates = Mly.memory.updates.filter((u) => !(u.seriesLink === frame.seriesLink && u.episodeUrl === ep.url));
      Mly.db.saveUpdates();
      updateRail();
    }
    const saved = findLibrary(frame.sourceId, frame.seriesLink);
    if (saved) { saved.lastReadAt = Date.now(); Mly.db.saveLibrary(); }
  }

  async function playEpisode(frame, episodeIndex, startAt) {
    const ep = frame.episodes[episodeIndex];
    if (!ep) return;
    let videos;
    try {
      videos = await Mly.ext.call(frame.sourceId, "getVideoList", (e) => e.getVideoList(ep.url));
    } catch (e) {
      const err = document.getElementById("player-error");
      if (err) { err.hidden = false; err.textContent = e.message || String(e); }
      return;
    }
    const usable = (videos || []).filter((v) => v && v.url).map((v) => ({
      url: v.url, originalUrl: v.originalUrl || v.url, quality: v.quality || "", headers: v.headers || {},
      subtitles: (v.subtitles || []).filter((t) => t && t.file).map((t) => ({ file: t.file, label: t.label || "" })),
    }));
    if (!usable.length) return;
    frame.episodeIndex = episodeIndex;
    frame.episodeName = ep.name;
    frame.videos = usable;
    frame.startAt = startAt || 0;
    const label = document.querySelector(".player-ep");
    if (label) label.textContent = ep.name;
    const list = document.getElementById("player-quality-rows");
    if (list) list.innerHTML = qualityRows(usable);
    Mly.player.attach(frame);
  }

  async function checkUpdates() {
    if (root.checking) return;
    root.checking = true;
    if (!top() && root.tab === "updates") render();
    for (const item of Mly.memory.library) {
      try {
        const manga = await Mly.ext.call(item.sourceId, "getDetail", (e) => e.getDetail(item.link));
        const chapters = chaptersOf(manga);
        const known = new Set(item.knownUrls || []);
        chapters.forEach((ch) => {
          if (known.has(ch.url)) return;
          const id = item.id + "|" + ch.url;
          if (Mly.memory.updates.some((u) => u.id === id)) return;
          Mly.memory.updates.unshift({
            id,
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            nsfw: !!item.nsfw || nsfwSource(item.sourceId),
            seriesLink: item.link,
            episodeUrl: ch.url,
            title: item.name,
            episodeName: ch.name,
            imageUrl: item.imageUrl,
            foundAt: Date.now(),
          });
        });
        item.chapters = chapters;
        item.knownUrls = chapters.map((c) => c.url);
        if (manga && manga.name) item.name = manga.name;
        if (manga && manga.imageUrl) item.imageUrl = manga.imageUrl;
      } catch (e) {
        item.updateError = e.message || String(e);
      }
    }
    Mly.db.saveLibrary();
    Mly.db.saveUpdates();
    root.checking = false;
    if (!top() && root.tab === "updates") render();
    else updateRail();
  }

  async function runMigrateSearch() {
    const m = root.migrate;
    const entry = Mly.memory.library.find((item) => item.id === m.entryId);
    m.loading = true;
    m.error = "";
    m.results = [];
    render();
    try {
      const res = await Mly.ext.call(m.sourceId, "search", (e) => e.search(entry ? entry.name : "", 1, []));
      const base = (sourceOf(m.sourceId) || {}).baseUrl || "";
      m.results = ((res && res.list) || []).map((item) => ({
        name: item.name || "",
        meta: sourceOf(m.sourceId).name,
        imageUrl: absUrl(base, item.imageUrl || ""),
        link: item.link || "",
      }));
      m.loading = false;
      if (!m.results.length) {
        const note = Mly.runtime.blockNote();
        m.error = note || "Nessun risultato";
      }
    } catch (e) {
      m.loading = false;
      m.error = e.message || String(e);
    }
    if (!top() && root.tab === "browse") render();
  }

  async function confirmMigrate(item) {
    const m = root.migrate;
    const entry = Mly.memory.library.find((lib) => lib.id === m.entryId);
    if (!entry) return;
    m.loading = true;
    render();
    try {
      const manga = await Mly.ext.call(m.sourceId, "getDetail", (e) => e.getDetail(item.link));
      const chapters = chaptersOf(Object.assign({ name: item.name, imageUrl: item.imageUrl }, manga || {}));
      const src = sourceOf(m.sourceId) || {};
      entry.sourceId = String(m.sourceId);
      entry.sourceName = src.name || "";
      entry.link = item.link;
      entry.id = seriesKey(entry.sourceId, entry.link);
      entry.name = (manga && manga.name) || item.name || entry.name;
      entry.imageUrl = (manga && manga.imageUrl) || item.imageUrl || entry.imageUrl;
      entry.description = (manga && manga.description) || entry.description;
      entry.chapters = chapters;
      entry.knownUrls = chapters.map((c) => c.url);
      entry.status = manga && manga.status;
      Mly.db.saveLibrary();
      m.step = 0;
      m.loading = false;
      openDialog("Migra", entry.name + " ora si apre da " + (src.name || "la nuova sorgente") + ".");
      render();
    } catch (e) {
      m.loading = false;
      openDialog("Migra", e.message || String(e));
      render();
    }
  }

  function onAct(act, el) {
    const frame = top();
    if (act === "tab") { selectTab(el.dataset.tab, false); return; }
    if (act === "goto-browse") { selectTab("browse", false); return; }
    if (act === "browse") { root.browse = el.dataset.tab; if (root.browse === "extensions") ensureIndex(); render(); return; }
    if (act === "open-source") { openSource(el.dataset.id); return; }
    if (act === "pin") { const s = sourceOf(el.dataset.id); if (s) Mly.ext.setPinned(s.id, !s.pinned); render(); return; }
    if (act === "open-prefs") {
      stack.push({ name: "prefs", sourceId: String(el.dataset.id || (frame && frame.sourceId)) });
      render();
      return;
    }
    if (act === "install") return installEntry(el.dataset.eid, el.dataset.fid);
    if (act === "uninstall") {
      const eid = el.dataset.eid;
      const ext = Mly.memory.extensions[String(eid)];
      const name = (ext && ext.name) || "questa estensione";
      openConfirm("Disinstalla", "Vuoi disinstallare " + name + "? Potrai reinstallarla da Estensioni.", "Disinstalla", () => {
        Mly.ext.uninstall(eid);
        render();
        const row = document.querySelector('[data-fid="ext-' + eid + '-b1"]') || document.querySelector('[data-fid="ext-' + eid + '"]') || stage().querySelector("[data-focus]");
        if (row) Mly.nav.focus(row);
      });
      return;
    }
    if (act === "reload-index") { root.extIndex = null; ensureIndex(); return; }
    if (act === "noop") return;
    if (act === "push") { stack.push({ name: el.dataset.screen }); render(); return; }
    if (act === "toggle-av") { Mly.memory.settings.useAvPlay = !Mly.memory.settings.useAvPlay; Mly.db.saveSettings(); render(); return; }
    if (act === "add-repo") {
      openOsk({ title: "Repository anime", value: "https://", apply: (value) => {
        const url = value.trim();
        if (!/^https?:\/\/\S+$/i.test(url)) { openDialog("Repository anime", "Indirizzo di un anime_index.json (repository di estensioni Mangayomi)."); return; }
        const list = Mly.memory.settings.repoUrls || [];
        if (!list.includes(url)) list.push(url);
        Mly.memory.settings.repoUrls = list;
        Mly.db.saveSettings();
        root.extIndex = null;
        render();
      } });
      return;
    }
    if (act === "del-repo") {
      const list = (Mly.memory.settings.repoUrls || []).slice();
      list.splice(Number(el.dataset.i), 1);
      Mly.memory.settings.repoUrls = list;
      Mly.db.saveSettings();
      root.extIndex = null;
      render();
      const next = document.querySelector('[data-fid="repo-del-' + Math.min(Number(el.dataset.i), list.length - 1) + '"]') || document.querySelector('[data-fid="repo-add"]');
      if (next) Mly.nav.focus(next);
      return;
    }
    if (act === "set-lang") {
      Mly.memory.settings.lang = el.dataset.lang;
      Mly.db.saveSettings();
      // Ricarica: testi della barra laterale e schermate si ridisegnano nella lingua scelta.
      setTimeout(() => location.reload(), 150);
      return;
    }
    if (act === "add-cat") {
      openOsk({ title: "Nuova categoria", value: "", apply: (value) => {
        const name = value.trim();
        if (!name) return;
        const cats = Mly.memory.settings.categories;
        if (!cats.includes(name)) cats.push(name);
        Mly.db.saveSettings();
        render();
      } });
      return;
    }
    if (act === "del-cat") {
      Mly.memory.settings.categories = (Mly.memory.settings.categories || []).filter((c) => c !== el.dataset.cat);
      Mly.memory.library.forEach((item) => { item.categories = (item.categories || []).filter((c) => c !== el.dataset.cat); });
      Mly.db.saveSettings();
      Mly.db.saveLibrary();
      render();
      return;
    }
    if (act === "cat") { root.libCat = el.dataset.cat; root.libFocus = 0; render(); return; }
    if (act === "lib-search") {
      openOsk({ title: "Cerca", value: root.libQuery, apply: (value) => { root.libQuery = value.trim(); root.libFocus = 0; render(); } });
      return;
    }
    if (act === "lib-clear") { root.libQuery = ""; render(); return; }
    if (act === "check-updates") { checkUpdates(); return; }
    if (act === "src-tab") {
      frame.tab = el.dataset.tab;
      frame.query = frame.tab === "search" ? frame.query : "";
      frame.focusIndex = 0;
      frame.page = 1;
      loadSource(frame, false);
      return;
    }
    if (act === "src-search") {
      openOsk({ title: "Cerca", value: frame.query, apply: (value) => {
        frame.query = value.trim();
        frame.tab = "search";
        frame.focusIndex = 0;
        loadSource(frame, false);
      } });
      return;
    }
    if (act === "src-filter") {
      try { frame.filterDraft = Mly.ext.getFilters(frame.sourceId); }
      catch (e) { frame.filterDraft = []; }
      frame.showFilters = true;
      root.filtersFor = frame;
      paintFilters();
      return;
    }
    if (act === "filter-apply") {
      frame.filters = JSON.parse(JSON.stringify(frame.filterDraft || []));
      frame.showFilters = false;
      root.filtersFor = null;
      paintFilters();
      frame.tab = "search";
      frame.focusIndex = 0;
      loadSource(frame, false);
      return;
    }
    if (act === "filter-reset") {
      try { frame.filterDraft = Mly.ext.getFilters(frame.sourceId); }
      catch (e) { frame.filterDraft = []; }
      paintFilters();
      return;
    }
    if (act === "fopt") {
      const f = frame.filterDraft[Number(el.dataset.fi)];
      if (f) f.state = Number(el.dataset.j);
      paintFilters();
      return;
    }
    if (act === "ftext") {
      const f = frame.filterDraft[Number(el.dataset.fi)];
      openOsk({ title: f.name, value: f.state || "", apply: (value) => { f.state = value; paintFilters(); } });
      return;
    }
    if (act === "fsort") {
      const f = frame.filterDraft[Number(el.dataset.fi)];
      f.state = f.state || { index: 0, ascending: true };
      f.state.index = Number(el.dataset.j);
      paintFilters();
      return;
    }
    if (act === "fsort-dir") {
      const f = frame.filterDraft[Number(el.dataset.fi)];
      f.state = f.state || { index: 0, ascending: true };
      f.state.ascending = !f.state.ascending;
      paintFilters();
      return;
    }
    if (act === "fcheck") {
      const f = frame.filterDraft[Number(el.dataset.fi)];
      f.state = !f.state;
      paintFilters();
      return;
    }
    if (act === "ftri") {
      const f = frame.filterDraft[Number(el.dataset.fi)];
      f.state = ((f.state || 0) + 1) % 3;
      paintFilters();
      return;
    }
    if (act === "fgroup") {
      const f = frame.filterDraft[Number(el.dataset.fi)];
      const s = f.state[Number(el.dataset.j)];
      if (s) s.state = s.state ? 0 : 1;
      paintFilters();
      return;
    }
    if (act === "more") { loadSource(frame, true); return; }
    if (act === "src-retry") { loadSource(frame, false); return; }
    if (act === "detail-play") {
      const chapters = chaptersOf(frame.manga || {});
      const choice = resumeChoice(frame.sourceId, frame.link, chapters);
      playFromDetail(frame, choice.idx);
      return;
    }
    if (act === "toggle-lib") { toggleLibrary(frame); return; }
    if (act === "detail-refresh") { frame.loading = true; render(); refreshDetail(frame); return; }
    if (act === "detail-cats") { openCategoryAssign(frame); return; }
    if (act === "detail-track") { openDialog("Tracciamento", "Il tracciamento richiede un account collegato da browser. Questa app per TV non ha WebView, quindi i tracker non si possono collegare qui."); return; }
    if (act === "detail-rec" || act === "detail-order") { openDialog("Non disponibile sulla TV", "Consigliati e ordine di visione usano tracker online che richiedono un accesso da browser, che questa app per TV non può aprire."); return; }
    if (act === "detail-migrate") {
      const saved = findLibrary(frame.sourceId, frame.link);
      if (!saved) { openDialog("Migra", "Prima aggiungi il titolo alla libreria."); return; }
      stack.length = 0;
      root.tab = "browse";
      root.browse = "migrate";
      root.migrate = { step: 1, entryId: saved.id, sourceId: "", results: [], loading: false, error: "" };
      render();
      return;
    }
    if (act === "no-webview") {
      const src = frame ? sourceOf(frame.sourceId) : null;
      const url = frame && frame.link ? absUrl(src && src.baseUrl, frame.link) : (src && src.baseUrl) || "";
      const fallback = () => openDialog("Nessuna WebView", "Questa TV non ha WebView. Apri la pagina da telefono o computer" + (url ? ": " + url : "."));
      // Sulla TV la pagina si apre nel browser di sistema (Samsung Internet). Serve solo a
      // vederla: il login fatto lì resta nel browser e non sblocca le estensioni.
      if (!url || !/^https?:/i.test(url) || !(window.tizen && tizen.application && tizen.ApplicationControl)) { fallback(); return; }
      try {
        tizen.application.launchAppControl(new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/view", url, null, null, null), null, () => {}, fallback);
      } catch (e) { fallback(); }
      return;
    }
    if (act === "mig-title") { root.migrate.entryId = el.dataset.id; root.migrate.step = 1; render(); return; }
    if (act === "mig-source") { root.migrate.sourceId = el.dataset.id; root.migrate.step = 2; runMigrateSearch(); return; }
    if (act === "close-dialog") { root.dialog = null; paintDialog(); return; }
    if (act === "confirm-ok") {
      const d = root.dialog;
      paintDialog.returnTo = null;
      paintDialog.returnFid = "";
      root.dialog = null;
      paintDialog();
      if (d && d.onOk) d.onOk();
      return;
    }
    if (act === "quality") { Mly.player.chooseQuality(Number(el.dataset.i)); return; }
    if (act === "osk") { onOsk(el.dataset.key); return; }
    if (act === "pref-bool") { togglePref(frame, Number(el.dataset.i)); return; }
    if (act === "pref-list") { cyclePref(frame, Number(el.dataset.i)); return; }
    if (act === "pref-text") { editPref(frame, Number(el.dataset.i)); return; }
    if (act === "pref-multi") { multiPref(frame, Number(el.dataset.i), Number(el.dataset.j)); return; }
  }

  function togglePref(frame, i) {
    const p = frame.prefs[i];
    const o = p.switchPreferenceCompat || p.checkBoxPreference;
    o.value = !o.value;
    Mly.ext.savePreference(frame.sourceId, p);
    render();
  }
  function cyclePref(frame, i) {
    const p = frame.prefs[i];
    const lp = p.listPreference;
    const n = (lp.entryValues || lp.entries || []).length || 1;
    lp.valueIndex = ((lp.valueIndex || 0) + 1) % n;
    Mly.ext.savePreference(frame.sourceId, p);
    render();
  }
  function editPref(frame, i) {
    const p = frame.prefs[i];
    const ed = p.editTextPreference;
    openOsk({ title: ed.title || "Modifica", value: ed.value || "", apply: (value) => {
      ed.value = value.trim();
      Mly.ext.savePreference(frame.sourceId, p);
      render();
    } });
  }
  function multiPref(frame, i, j) {
    const p = frame.prefs[i];
    const ms = p.multiSelectListPreference;
    const val = (ms.entryValues || [])[j];
    ms.values = ms.values || [];
    if (ms.values.includes(val)) ms.values = ms.values.filter((v) => v !== val);
    else ms.values = ms.values.concat([val]);
    Mly.ext.savePreference(frame.sourceId, p);
    render();
  }

  function openCategoryAssign(frame) {
    const saved = findLibrary(frame.sourceId, frame.link);
    if (!saved) { openDialog("Categorie", "Prima aggiungi il titolo alla libreria."); return; }
    const cats = Mly.memory.settings.categories || [];
    if (!cats.length) { openDialog("Categorie", "Crea una categoria in Altro › Categorie."); return; }
    root.dialog = null;
    const html = '<div class="sheet"><h2>Categorie</h2>' + cats.map((c) => {
      const on = (saved.categories || []).includes(c);
      return '<button type="button" class="pill' + (on ? " is-on" : "") + '" data-focus data-act="assign-cat" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("") + '<div class="button-row"><button type="button" class="primary" data-focus data-act="close-dialog">Fatto</button></div></div>';
    let el = document.getElementById("dialog");
    if (!el) {
      el = document.createElement("div");
      el.id = "dialog";
      el.dataset.modal = "1";
      document.getElementById("app").appendChild(el);
    }
    root.dialog = { title: "Categorie", body: "" };
    el.innerHTML = html;
    el.querySelectorAll("[data-act='assign-cat']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.cat;
        saved.categories = saved.categories || [];
        if (saved.categories.includes(name)) saved.categories = saved.categories.filter((c) => c !== name);
        else saved.categories.push(name);
        Mly.db.saveLibrary();
        btn.classList.toggle("is-on");
      });
    });
    Mly.nav.focus(el.querySelector("[data-focus]"));
  }

  async function installEntry(id) {
    const entry = (root.extIndex || []).find((e) => String(e.id) === String(id));
    if (!entry) return;
    root.busyId = String(id);
    render();
    try {
      await Mly.ext.install(entry);
    } catch (e) {
      openDialog("Estensioni", e.message || String(e));
    }
    root.busyId = "";
    if (!top() && root.tab === "browse") render();
  }

  function onOsk(key) {
    if (!root.osk) return;
    if (key === "done") {
      const apply = root.osk.apply;
      const value = root.osk.value;
      closeOsk();
      if (apply) apply(value);
      return;
    }
    if (key === "clear") root.osk.value = "";
    else if (key === "back") root.osk.value = root.osk.value.slice(0, -1);
    else root.osk.value += key;
    const node = document.getElementById("osk-value");
    if (node) node.textContent = root.osk.value;
  }

  function isBack(e) {
    return e.key === "Escape" || e.key === "BrowserBack" || e.key === "GoBack" || e.key === "XF86Back" || e.keyCode === 10009 || e.keyCode === 461;
  }

  function back() {
    if (root.osk) { closeOsk(); return; }
    if (root.filtersFor && root.filtersFor.showFilters) {
      root.filtersFor.showFilters = false;
      root.filtersFor = null;
      paintFilters();
      return;
    }
    if (root.dialog) { root.dialog = null; paintDialog(); return; }
    if (stack.length) {
      const leaving = stack.pop();
      if (leaving.name === "player") Mly.player.stop();
      if (leaving.name === "source") root.returnFid = "source-" + leaving.sourceId;
      render();
      return;
    }
    if (root.tab === "browse" && root.browse === "migrate" && root.migrate.step > 0) {
      root.migrate.step -= 1;
      root.migrate.loading = false;
      render();
    }
  }

  function onKey(e) {
    if (!root.osk && (e.key === "0" || e.keyCode === 48 || e.keyCode === 96)) {
      e.preventDefault();
      if (secretPress(secret.zero)) setAdult(!adult);
      return;
    }
    if (e.key === "ArrowUp" && !top() && root.tab === "library") {
      const cur = Mly.nav.current();
      if (cur && cur.dataset.zone === "rail" && cur.dataset.tab === "library") {
        // Nothing is above Library in the rail: Up stays here and only counts.
        e.preventDefault();
        if (secretPress(secret.up)) setAdult(!adult, cur);
        return;
      }
    }
    if (Mly.player.isOpen() && Mly.player.handleKey(e)) { e.preventDefault(); return; }
    if (isBack(e)) { e.preventDefault(); back(); return; }
    if (root.osk && e.key === "Backspace") { e.preventDefault(); onOsk("back"); return; }
    if (root.osk && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      onOsk(e.key);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      Mly.nav.move(e.key.replace("Arrow", "").toLowerCase());
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      const el = Mly.nav.current();
      if (!el) return;
      e.preventDefault();
      if (el._grid) el._grid.activate();
      else el.click();
    }
  }

  function onClick(e) {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    onAct(t.dataset.act, t);
  }

  function selectTab(tab, fromRail) {
    const pushed = stack.length > 0;
    if (pushed) {
      if (top() && top().name === "player") Mly.player.stop();
      stack.length = 0;
    }
    if (!pushed && root.tab === tab && fromRail) return;
    root.tab = tab;
    if (tab === "browse" && root.browse === "extensions") ensureIndex();
    paint(renderRoot(), null);
    if (fromRail && !pushed) {
      const rail = document.querySelector('.rail-btn[data-tab="' + tab + '"]');
      if (rail) Mly.nav.focus(rail);
    }
  }

  function start() {
    const rail = ["library", "updates", "history", "browse", "more"].map((id) => {
      const label = { library: "Libreria", updates: "Aggiornamenti", history: "Cronologia", browse: "Sfoglia", more: "Altro" }[id];
      return '<button type="button" class="rail-btn" data-focus data-zone="rail" data-tab="' + id + '" data-act="tab"><span class="rail-icon">' + svg(ICONS[id]) + '</span><span>' + label + '</span>' +
        (id === "updates" ? '<span id="badge-updates" class="badge" hidden></span>' : "") + "</button>";
    }).join("");
    document.getElementById("app").innerHTML = '<div id="shell"><nav id="rail"><img class="brand" src="icon.png" width="44" height="44" alt=""><div class="rail-list">' + rail + '</div></nav><div id="stage"></div></div>';
    document.addEventListener("keydown", onKey);
    try {
      if (window.tizen && tizen.tvinputdevice) {
        const want = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
        const have = tizen.tvinputdevice.getSupportedKeys().map((k) => k.name);
        tizen.tvinputdevice.registerKeyBatch(want.filter((k) => have.includes(k)));
      }
    } catch (e) {}
    document.getElementById("app").addEventListener("click", onClick);
    selectTab("library", false);
  }

  Mly.ui = { start, selectTab, back, rememberPlayback, playEpisode, qualityRows, nextIndex, prevIndex, chronoOrder, epNumber, resumeChoice, isAdult: () => adult };
})();
