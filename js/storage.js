/* Library, history, updates, extension code.
   Source prefs and getString stay in memory and localStorage so the
   extension runtime can read them synchronously, the way Mangayomi does.
   Extension code is also written to IndexedDB. */
(function () {
  const Mly = (window.Mly = window.Mly || {});
  const LS = {
    settings: "mly.settings",
    extensions: "mly.extensions",
    prefs: "mly.prefs",
    strings: "mly.strings",
    library: "mly.library",
    history: "mly.history",
    updates: "mly.updates",
    progress: "mly.progress",
    codes: "mly.codes",
  };
  const memory = {
    settings: {},
    extensions: {},
    codes: {},
    prefs: {},
    strings: {},
    library: [],
    history: [],
    updates: [],
    progress: {},
  };
  const DEFAULTS = {
    repoUrl: "https://raw.githubusercontent.com/adam72881/mangayomi-anime-extensions/main/anime_index.json",
    // Più repository di estensioni, come in Mangayomi. repoUrl resta per le installazioni vecchie.
    repoUrls: ["https://raw.githubusercontent.com/adam72881/mangayomi-anime-extensions/main/anime_index.json"],
    // "auto" = lingua di sistema della TV; oppure "it" / "en" scelti in Altro › Lingua.
    lang: "auto",
    // Cookie dei siti gestiti dal motore della TV (credentials: "include"): così i login fatti
    // dalle estensioni (PMVHaven, HypnoTube…) possono restare validi. Sperimentale.
    siteCookies: true,
    useAvPlay: false,
    categories: [],
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  let dbp = null;
  function idb() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open("mangayomi", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("IndexedDB unavailable"));
      });
    }
    return dbp;
  }
  function idbGet(key) {
    return idb().then((db) => new Promise((resolve) => {
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    })).catch(() => undefined);
  }
  function idbSet(key, value) {
    return idb().then((db) => new Promise((resolve) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    })).catch(() => false);
  }

  async function init() {
    memory.settings = Object.assign({}, DEFAULTS, readJson(LS.settings, {}));
    if (!Array.isArray(memory.settings.repoUrls)) memory.settings.repoUrls = [memory.settings.repoUrl || DEFAULTS.repoUrl];
    else memory.settings.repoUrls = memory.settings.repoUrls.slice();
    memory.extensions = readJson(LS.extensions, {}) || {};
    memory.prefs = readJson(LS.prefs, {}) || {};
    memory.strings = readJson(LS.strings, {}) || {};
    memory.library = readJson(LS.library, []) || [];
    // "mly.history" was also used by the old v0.1 app with another shape: keep only entries of this app.
    memory.history = (Array.isArray(readJson(LS.history, [])) ? readJson(LS.history, []) : [])
      .filter((h) => h && h.sourceId && h.episodeUrl && h.title);
    memory.updates = readJson(LS.updates, []) || [];
    memory.progress = readJson(LS.progress, {}) || {};
    memory.codes = readJson(LS.codes, null);
    if (!memory.codes) memory.codes = (await idbGet("codes")) || {};
    return memory;
  }

  const db = {
    memory,
    init,
    saveSettings() { writeJson(LS.settings, memory.settings); },
    saveExtensions() {
      writeJson(LS.extensions, memory.extensions);
      writeJson(LS.codes, memory.codes);
      idbSet("codes", memory.codes);
    },
    savePrefs() { writeJson(LS.prefs, memory.prefs); },
    saveStrings() { writeJson(LS.strings, memory.strings); },
    saveLibrary() { writeJson(LS.library, memory.library); idbSet("library", memory.library); },
    saveHistory() { writeJson(LS.history, memory.history); },
    saveUpdates() { writeJson(LS.updates, memory.updates); },
    saveProgress() { writeJson(LS.progress, memory.progress); },
  };
  Mly.db = db;
  Mly.memory = memory;
})();
