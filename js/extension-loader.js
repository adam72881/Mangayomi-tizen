/* Install extension code and call DefaultExtension. */
(function () {
  const Mly = (window.Mly = window.Mly || {});
  const cache = {};

  function metaOf(entry) {
    return {
      apiUrl: entry.apiUrl || "",
      baseUrl: entry.baseUrl || "",
      dateFormat: entry.dateFormat || "",
      dateFormatLocale: entry.dateFormatLocale || "",
      hasCloudflare: !!entry.hasCloudflare,
      id: entry.id,
      isFullData: !!entry.isFullData,
      lang: entry.lang || "",
      name: entry.name || "",
      additionalParams: entry.additionalParams || "",
      notes: entry.notes || "",
    };
  }

  function build(meta, code) {
    const SharedPreferences = Mly.runtime.makeSharedPreferences(String(meta.id));
    let Cls;
    try {
      Cls = new Function(
        "MProvider", "Client", "Document", "Element", "SharedPreferences",
        "evaluateJavascriptViaWebview", "createHlsProxyUrl",
        "cryptoHandler", "encryptAESCryptoJS", "decryptAESCryptoJS", "decryptAESGCM",
        "deobfuscateJsPassword", "unpackJs", "unpackJsAndCombine", "parseDates",
        code + "\nreturn (typeof DefaultExtension !== 'undefined') ? DefaultExtension : null;",
      )(
        Mly.runtime.MProvider, Mly.runtime.Client, Mly.dom.Document, Mly.dom.Element, SharedPreferences,
        Mly.runtime.evaluateJavascriptViaWebview, Mly.runtime.createHlsProxyUrl,
        Mly.runtime.notAvailable("cryptoHandler"),
        Mly.runtime.notAvailable("encryptAESCryptoJS"),
        Mly.runtime.notAvailable("decryptAESCryptoJS"),
        Mly.runtime.notAvailable("decryptAESGCM"),
        Mly.runtime.notAvailable("deobfuscateJsPassword"),
        Mly.runtime.notAvailable("unpackJs"),
        Mly.runtime.notAvailable("unpackJsAndCombine"),
        Mly.runtime.notAvailable("parseDates"),
      );
    } catch (e) {
      throw new Error('L\'estensione "' + (meta.name || meta.id) + '" non si è caricata: ' + e.message);
    }
    if (!Cls) throw new Error('L\'estensione "' + (meta.name || meta.id) + '" non ha la classe DefaultExtension.');
    const ext = new Cls();
    ext.__source = metaOf(meta);
    ext.__sourceId = String(meta.id);
    return ext;
  }

  function instance(id) {
    const key = String(id);
    if (cache[key]) return cache[key];
    const meta = Mly.memory.extensions[key];
    const code = Mly.memory.codes[key];
    if (!meta || !code) throw new Error("La sorgente non è installata.");
    cache[key] = build(meta, code);
    return cache[key];
  }
  function drop(id) { delete cache[String(id)]; }

  function installedList() {
    return Object.values(Mly.memory.extensions).sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  async function fetchText(url) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error("Download non riuscito: " + url + " (" + res.status + ").");
    return res.text();
  }
  async function fetchIndex(url) {
    const data = JSON.parse(await fetchText(url || Mly.memory.settings.repoUrl));
    if (!Array.isArray(data)) throw new Error("L'indice del repository non è una lista.");
    return data.filter((e) => e && e.isManga !== true && (e.itemType == null || e.itemType === 1));
  }
  async function install(entry) {
    if (!entry || !entry.sourceCodeUrl) throw new Error("Questa estensione non ha l'indirizzo del codice.");
    const code = await fetchText(entry.sourceCodeUrl);
    if (!/class\s+DefaultExtension\b/.test(code)) throw new Error(entry.name + " non è un'estensione JavaScript di Mangayomi.");
    new Function(code);
    const id = String(entry.id);
    const prev = Mly.memory.extensions[id];
    Mly.memory.extensions[id] = {
      id: entry.id,
      name: entry.name,
      baseUrl: entry.baseUrl,
      lang: entry.lang,
      iconUrl: entry.iconUrl || "",
      version: entry.version,
      isNsfw: !!entry.isNsfw,
      hasCloudflare: !!entry.hasCloudflare,
      sourceCodeUrl: entry.sourceCodeUrl,
      apiUrl: entry.apiUrl || "",
      pinned: !!(prev && prev.pinned),
    };
    Mly.memory.codes[id] = code;
    Mly.db.saveExtensions();
    drop(id);
    return Mly.memory.extensions[id];
  }
  function uninstall(id) {
    const key = String(id);
    delete Mly.memory.extensions[key];
    delete Mly.memory.codes[key];
    Mly.db.saveExtensions();
    drop(key);
  }
  function setPinned(id, pinned) {
    const meta = Mly.memory.extensions[String(id)];
    if (!meta) return;
    meta.pinned = !!pinned;
    Mly.db.saveExtensions();
  }

  async function call(id, label, fn) {
    const meta = Mly.memory.extensions[String(id)];
    Mly.runtime.beginCall();
    try {
      return await fn(instance(id));
    } catch (e) {
      const reported = e && e.message ? e.message : String(e);
      const note = Mly.runtime.blockNote();
      throw new Error('Errore dell\'estensione "' + ((meta && meta.name) || id) + '" (' + label + "): " + reported + (note ? " " + note : ""));
    }
  }

  function notImplemented(e) { return !!(e && /not implemented/i.test(String(e.message || e))); }

  function supportsLatest(id) {
    try { return instance(id).supportsLatest !== false; }
    catch (e) { return notImplemented(e); }
  }
  function getFilters(id) {
    try {
      const list = instance(id).getFilterList();
      return Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : [];
    } catch (e) {
      if (notImplemented(e)) return [];
      throw e;
    }
  }
  function getPreferences(id) {
    let defs = [];
    try { defs = instance(id).getSourcePreferences() || []; }
    catch (e) { if (notImplemented(e)) return []; throw e; }
    const saved = Mly.memory.prefs[String(id)] || {};
    return defs.map((d) => {
      const copy = JSON.parse(JSON.stringify(d));
      const prev = saved[copy.key];
      if (!prev) return copy;
      ["editTextPreference", "listPreference", "checkBoxPreference", "switchPreferenceCompat", "multiSelectListPreference"].forEach((k) => {
        if (copy[k] && prev[k]) Object.assign(copy[k], prev[k]);
      });
      return copy;
    });
  }
  function savePreference(id, pref) {
    const key = String(id);
    if (!Mly.memory.prefs[key]) Mly.memory.prefs[key] = {};
    Mly.memory.prefs[key][pref.key] = JSON.parse(JSON.stringify(pref));
    Mly.db.savePrefs();
    drop(key);
  }

  Mly.ext = {
    instance, drop, installedList, fetchIndex, install, uninstall, setPinned,
    call, supportsLatest, getFilters, getPreferences, savePreference, notImplemented,
  };
})();
