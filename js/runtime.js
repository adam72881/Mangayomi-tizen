/* Client, MProvider and SharedPreferences.
   Cookie, Referer and User-Agent cannot be set from a TV webview.
   They are dropped and, if the site then demands them, the UI says so.
   One exception: GET https://play.saturncdn.net/embed/<id>/playlist
   goes through the Tizen Download API, which can send
   Referer: https://play.saturncdn.net/. The query string (the playlist
   token) is never written to logs or to errors.
   Nothing here bypasses Cloudflare, anti-bot, paywalls or age checks. */
(function () {
  const Mly = (window.Mly = window.Mly || {});
  const FORBIDDEN = /^(user-agent|referer|referrer|cookie|cookie2|host|origin|connection|content-length|accept-charset|accept-encoding|keep-alive|te|trailer|transfer-encoding|upgrade|via|dnt|expect|date)$/i;

  if (!String.prototype.substringAfter) {
    String.prototype.substringAfter = function (pattern) {
      const i = this.indexOf(pattern);
      return i === -1 ? this.substring(0) : this.substring(i + pattern.length);
    };
    String.prototype.substringAfterLast = function (pattern) { return this.split(pattern).pop(); };
    String.prototype.substringBefore = function (pattern) {
      const i = this.indexOf(pattern);
      return i === -1 ? this.substring(0) : this.substring(0, i);
    };
    String.prototype.substringBeforeLast = function (pattern) {
      const i = this.lastIndexOf(pattern);
      return i === -1 ? this.substring(0) : this.substring(0, i);
    };
    String.prototype.substringBetween = function (left, right) {
      const i = this.indexOf(left);
      if (i === -1) return "";
      const j = this.indexOf(right, i + left.length);
      return j === -1 ? "" : this.substring(i + left.length, j);
    };
  }

  const callState = { stripped: [], issue: "", issueDetail: "" };
  function beginCall() {
    callState.stripped = [];
    callState.issue = "";
    callState.issueDetail = "";
  }
  function noteIssue(kind, detail) {
    if (!callState.issue) {
      callState.issue = kind;
      callState.issueDetail = detail || "";
    }
  }
  function blockNote() {
    if (callState.issue === "cloudflare") {
      return "Il sito ha risposto con un controllo del browser. Questa TV non ha WebView e non può impostare lo User-Agent, quindi il controllo non si può completare. L'app non lo aggira.";
    }
    if (callState.issue === "age") {
      return "Il sito chiede una verifica dell'età. Questa TV non può aprire quella pagina né impostare il cookie richiesto. L'app non aggira la verifica dell'età.";
    }
    if (callState.issue === "headers") {
      return "Questa sorgente imposta " + [...new Set(callState.stripped)].join(", ") + ", che il browser della TV non può inviare. Accesso o riproduzione che richiedono Cookie, Referer o User-Agent non funzioneranno. L'app non aggira questo limite.";
    }
    return "";
  }

  function splitHeaders(headers) {
    const ok = {};
    const stripped = [];
    if (headers) {
      Object.keys(headers).forEach((k) => {
        if (headers[k] == null) return;
        if (FORBIDDEN.test(k) || /^(proxy-|sec-)/i.test(k)) stripped.push(k);
        else ok[k] = String(headers[k]);
      });
    }
    return { ok, stripped };
  }

  function detectIssue(status, body, stripped) {
    const text = String(body || "").slice(0, 200000);
    const title = ((text.match(/<title[^>]*>([^<]{0,180})/i) || [])[1] || "").trim();
    const head = (title + "\n" + text.slice(0, 5000)).toLowerCase();
    if (/just a moment|attention required|cf-browser-verification|cf-chl|checking your browser|verify you are human/.test(head)) {
      noteIssue("cloudflare", title);
      return;
    }
    if ((status >= 400 || /verify your age|age verification/.test(title.toLowerCase())) &&
        /verify your age|age verification|yoti|agekey|visitors in italy/.test(head)) {
      noteIssue("age", title);
      return;
    }
    if (stripped.length && status >= 400) noteIssue("headers");
  }

  function headerMap(response) {
    const map = {};
    response.headers.forEach((value, key) => { map[key.toLowerCase()] = value; });
    if (response.headers.getSetCookie) {
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length) map["set-cookie"] = cookies.join(", ");
    }
    return map;
  }

  // Siti per cui la richiesta con i cookie fallisce (es. CORS con "*"): lì si torna a "omit".
  const noCookieHosts = {};
  function hostOf(u) { try { return new URL(u).host; } catch (e) { return ""; } }

  // Only the AnimeSaturn playlist. The id is one path segment; the token stays in the query.
  function isSaturnPlaylist(method, url) {
    if (String(method || "").toUpperCase() !== "GET") return false;
    let u;
    try { u = new URL(url); } catch (e) { return false; }
    if (u.protocol !== "https:" || u.hostname !== "play.saturncdn.net" || u.port) return false;
    const parts = u.pathname.split("/");
    return parts.length === 4 && parts[1] === "embed" && parts[3] === "playlist" && !!parts[2] && parts[2] !== "." && parts[2] !== "..";
  }

  function playlistUrlWithoutSecret(url) {
    try {
      const u = new URL(url);
      return u.origin + u.pathname;
    } catch (e) {
      const s = String(url || "");
      const cut = s.search(/[?#]/);
      return cut === -1 ? "https://play.saturncdn.net/embed/<id>/playlist" : s.slice(0, cut);
    }
  }

  // Drop the playlist URL and its token from any text that might be shown or logged.
  function redactSecrets(text, url) {
    let s = String(text == null ? "" : text);
    const full = url == null ? "" : String(url);
    if (full) s = s.split(full).join(playlistUrlWithoutSecret(full));
    let token = "";
    try { token = new URL(full).searchParams.get("token") || ""; } catch (e) { token = ""; }
    if (token.length >= 8) {
      s = s.split(token).join("");
      try {
        const enc = encodeURIComponent(token);
        if (enc !== token) s = s.split(enc).join("");
      } catch (e) {}
    }
    s = s.replace(/https?:\/\/play\.saturncdn\.net\/embed\/[^?\s"'<>]*\/playlist(?:\?[^ \t\r\n"'<>]*)?/gi, "https://play.saturncdn.net/embed/<id>/playlist");
    s = s.replace(/([?&]token=)[^&\s"'<>]*/gi, "$1");
    return s;
  }

  function downloadFail(error, url) {
    const name = error && error.name ? String(error.name) : "";
    const message = error instanceof Error ? error.message : (error && error.message ? String(error.message) : (typeof error === "string" ? error : ""));
    let detail = redactSecrets([name, message].filter(Boolean).join(": "), url).replace(/\s+/g, " ").trim();
    detail = detail.replace(/^[:\s.]+|[:\s.]+$/g, "");
    if (!detail) return new Error("Download della playlist di AnimeSaturn non riuscito.");
    return new Error("Download della playlist di AnimeSaturn non riuscito: " + detail + ".");
  }

  let saturnPlaylistSeq = 0;

  function deleteDownloaded(file) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const timer = setTimeout(finish, 2000);
      const ok = () => { clearTimeout(timer); finish(); };
      try {
        const full = file && (file.fullPath || file.path);
        if (file && file.parent && typeof file.parent.deleteFile === "function" && full) {
          file.parent.deleteFile(full, ok, ok);
          return;
        }
      } catch (e) {}
      ok();
    });
  }

  function readFileText(file, url) {
    return new Promise((resolve, reject) => {
      const bad = (error) => {
        const detail = redactSecrets(error && (error.message || error.name) || "", url).replace(/\s+/g, " ").trim();
        reject(new Error(detail ? "Impossibile leggere la playlist di AnimeSaturn: " + detail + "." : "Impossibile leggere la playlist di AnimeSaturn."));
      };
      if (file && typeof file.readAsText === "function") {
        file.readAsText((text) => resolve(text == null ? "" : String(text)), bad, "UTF-8");
        return;
      }
      if (file && typeof file.openStream === "function") {
        file.openStream("r", (stream) => {
          try {
            const n = file.fileSize > 0 ? file.fileSize : 65536;
            const text = stream.read(n);
            try { stream.close(); } catch (e) {}
            resolve(text == null ? "" : String(text));
          } catch (e) {
            try { stream.close(); } catch (e2) {}
            bad(e);
          }
        }, bad, "UTF-8");
        return;
      }
      bad(null);
    });
  }

  function readDownloaded(path, url) {
    const api = window.tizen;
    if (!api || !api.filesystem || typeof api.filesystem.resolve !== "function") {
      return Promise.reject(new Error("tizen.filesystem non è disponibile: la playlist di AnimeSaturn è stata scaricata ma non si può leggere."));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const ok = (text) => { if (!settled) { settled = true; resolve(text); } };
      const bad = (error) => { if (!settled) { settled = true; reject(error instanceof Error ? error : downloadFail(error, url)); } };
      try {
        api.filesystem.resolve(String(path), (file) => {
          const drop = () => deleteDownloaded(file);
          readFileText(file, url).then(
            (text) => drop().then(() => ok(text)),
            (error) => drop().then(() => bad(error)),
          );
        }, (error) => bad(downloadFail(error, url)), "r");
      } catch (e) {
        bad(downloadFail(e, url));
      }
    });
  }

  function playlistResponse(text, url) {
    return {
      body: text == null ? "" : String(text),
      headers: {},
      isRedirect: false,
      persistentConnection: false,
      reasonPhrase: "OK",
      statusCode: 200,
      request: {
        method: "GET",
        url: playlistUrlWithoutSecret(url),
        headers: { Referer: "https://play.saturncdn.net/" },
        followRedirects: true,
      },
    };
  }

  function downloadSaturnPlaylist(url) {
    const api = window.tizen;
    if (!api || !api.download || typeof api.download.start !== "function" || typeof api.DownloadRequest !== "function") {
      return Promise.reject(new Error("Il Download API di Tizen non è disponibile su questo dispositivo. Senza non si può inviare il Referer di play.saturncdn.net, quindi la playlist di AnimeSaturn non si apre."));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      let downloadId = null;
      const timerBox = { id: 0 };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerBox.id);
        fn(value);
      };
      const fail = (error) => finish(reject, error instanceof Error ? error : downloadFail(error, url));
      timerBox.id = setTimeout(() => {
        const id = downloadId;
        fail(new Error("Download della playlist di AnimeSaturn non riuscito: tempo scaduto."));
        try { if (id != null && typeof api.download.cancel === "function") api.download.cancel(id); } catch (e) {}
      }, 45000);
      let req;
      try {
        saturnPlaylistSeq += 1;
        req = new api.DownloadRequest(url, "downloads", "as-playlist-" + saturnPlaylistSeq + ".json", "ALL", {
          Referer: "https://play.saturncdn.net/",
        });
      } catch (e) {
        fail(downloadFail(e, url));
        return;
      }
      try {
        downloadId = api.download.start(req, {
          onprogress: function () {},
          onpaused: function () {},
          oncanceled: function () {
            fail(new Error("Download della playlist di AnimeSaturn annullato."));
          },
          oncompleted: function (id, path) {
            if (!path) {
              fail(new Error("Download della playlist di AnimeSaturn non riuscito: percorso del file assente."));
              return;
            }
            readDownloaded(path, url).then((text) => finish(resolve, playlistResponse(text, url)), fail);
          },
          onfailed: function (id, error) {
            fail(downloadFail(error, url));
          },
        });
      } catch (e) {
        fail(downloadFail(e, url));
      }
    });
  }

  async function http(method, url, headers, body, options) {
    if (isSaturnPlaylist(method, url)) return downloadSaturnPlaylist(url);
    const follow = !options || options.followRedirects !== false;
    const split = splitHeaders(headers);
    if (split.stripped.length) callState.stripped.push(...split.stripped);
    const withCookies = !!(Mly.memory && Mly.memory.settings && Mly.memory.settings.siteCookies) && !noCookieHosts[hostOf(url)];
    const init = { method, headers: split.ok, redirect: follow ? "follow" : "manual", credentials: withCookies ? "include" : "omit" };
    if (method !== "GET" && method !== "HEAD" && body != null) {
      const ctypeKey = Object.keys(split.ok).find((k) => k.toLowerCase() === "content-type");
      const ctype = ctypeKey ? split.ok[ctypeKey].toLowerCase() : "";
      if (typeof body === "string") init.body = body;
      else if (ctype.includes("application/json")) init.body = JSON.stringify(body);
      else if (typeof body === "object") {
        const form = new URLSearchParams();
        Object.keys(body).forEach((k) => form.append(k, body[k] == null ? "" : String(body[k])));
        init.body = form.toString();
        if (!ctypeKey) init.headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    init.signal = ctrl.signal;
    let response;
    try {
      try {
        response = await fetch(url, init);
      } catch (first) {
        if (!withCookies || (first && first.name === "AbortError")) throw first;
        // Con i cookie la richiesta è stata rifiutata: si riprova come prima, senza cookie.
        noCookieHosts[hostOf(url)] = true;
        init.credentials = "omit";
        response = await fetch(url, init);
      }
    } catch (e) {
      clearTimeout(timer);
      noteIssue(callState.issue || "network");
      const why = e && e.name === "AbortError" ? "tempo scaduto" : "errore di rete";
      throw new Error(
        "Impossibile caricare la pagina (" + why + "). L'app Tizen contatta il sito direttamente. " +
        "Se il sito è giù, blocca questo dispositivo o chiede un controllo del browser, resta chiuso. " +
        "L'app non aggira Cloudflare, anti-bot, paywall o verifiche dell'età.",
      );
    }
    clearTimeout(timer);
    let status = response.status;
    if (response.type === "opaqueredirect") status = status || 302;
    const text = response.type === "opaqueredirect" ? "" : await response.text();
    detectIssue(status, text, split.stripped);
    return {
      body: text,
      headers: response.type === "opaqueredirect" ? {} : headerMap(response),
      isRedirect: (status >= 300 && status < 400) || response.type === "opaqueredirect",
      persistentConnection: false,
      reasonPhrase: response.statusText || "",
      statusCode: status,
      request: { method, url: response.url || url, headers: split.ok, followRedirects: follow },
    };
  }

  class Client {
    constructor(reqcopyWith) { this.reqcopyWith = reqcopyWith || {}; }
    head(url, headers) { return http("HEAD", url, headers, null, this.reqcopyWith); }
    get(url, headers) { return http("GET", url, headers, null, this.reqcopyWith); }
    post(url, headers, body) { return http("POST", url, headers, body, this.reqcopyWith); }
    put(url, headers, body) { return http("PUT", url, headers, body, this.reqcopyWith); }
    delete(url, headers, body) { return http("DELETE", url, headers, body, this.reqcopyWith); }
    patch(url, headers, body) { return http("PATCH", url, headers, body, this.reqcopyWith); }
  }

  class MProvider {
    get source() { return this.__source || {}; }
    get supportsLatest() { throw new Error("supportsLatest not implemented"); }
    getHeaders() { throw new Error("getHeaders not implemented"); }
    async getPopular() { throw new Error("getPopular not implemented"); }
    async getLatestUpdates() { throw new Error("getLatestUpdates not implemented"); }
    async search() { throw new Error("search not implemented"); }
    async getDetail() { throw new Error("getDetail not implemented"); }
    async getPageList() { throw new Error("getPageList not implemented"); }
    async getVideoList() { throw new Error("getVideoList not implemented"); }
    getFilterList() { throw new Error("getFilterList not implemented"); }
    getSourcePreferences() { throw new Error("getSourcePreferences not implemented"); }
  }

  function valueOf(pref) {
    if (!pref) return "";
    if (pref.listPreference) {
      const lp = pref.listPreference;
      const i = lp.valueIndex == null ? 0 : lp.valueIndex;
      return (lp.entryValues || [])[i] != null ? lp.entryValues[i] : "";
    }
    if (pref.checkBoxPreference) return !!pref.checkBoxPreference.value;
    if (pref.switchPreferenceCompat) return !!pref.switchPreferenceCompat.value;
    if (pref.editTextPreference) return pref.editTextPreference.value == null ? "" : String(pref.editTextPreference.value);
    if (pref.multiSelectListPreference) return pref.multiSelectListPreference.values || [];
    return "";
  }

  function prefGet(sourceId, key) {
    const bag = Mly.memory.prefs[sourceId] || {};
    if (Object.prototype.hasOwnProperty.call(bag, key)) return valueOf(bag[key]);
    if (Mly.memory._readingPrefs) return "";
    Mly.memory._readingPrefs = true;
    let defs = [];
    try { defs = Mly.ext.instance(sourceId).getSourcePreferences() || []; }
    finally { Mly.memory._readingPrefs = false; }
    const found = defs.find((d) => d && d.key === key);
    if (!found) throw new Error("Error when getting source preference");
    if (!Mly.memory.prefs[sourceId]) Mly.memory.prefs[sourceId] = {};
    Mly.memory.prefs[sourceId][key] = found;
    Mly.db.savePrefs();
    return valueOf(found);
  }
  function stringGet(sourceId, key, def) {
    if (!Mly.memory.strings[sourceId]) Mly.memory.strings[sourceId] = {};
    const bag = Mly.memory.strings[sourceId];
    if (Object.prototype.hasOwnProperty.call(bag, key)) return bag[key] == null ? "" : String(bag[key]);
    bag[key] = def == null ? "" : String(def);
    Mly.db.saveStrings();
    return bag[key];
  }
  function stringSet(sourceId, key, value) {
    if (!Mly.memory.strings[sourceId]) Mly.memory.strings[sourceId] = {};
    Mly.memory.strings[sourceId][key] = value == null ? "" : String(value);
    Mly.db.saveStrings();
  }
  function makeSharedPreferences(sourceId) {
    return class SharedPreferences {
      get(key) { return prefGet(sourceId, key); }
      getString(key, defaultValue) { return stringGet(sourceId, key, defaultValue); }
      setString(key, value) { return stringSet(sourceId, key, value); }
    };
  }

  async function evaluateJavascriptViaWebview() {
    throw new Error("Questa TV non ha WebView, quindi una pagina visibile solo in un browser non si può leggere. L'app non aggira questo controllo.");
  }
  async function createHlsProxyUrl(url) { return url; }
  function notAvailable(name) {
    return function () { throw new Error(name + " non è disponibile su questa TV."); };
  }

  Mly.runtime = {
    Client, MProvider, beginCall, blockNote, callState, valueOf, prefGet,
    makeSharedPreferences, evaluateJavascriptViaWebview, createHlsProxyUrl, notAvailable,
  };
})();
