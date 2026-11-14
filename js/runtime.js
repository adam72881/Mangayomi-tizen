/* Client, MProvider and SharedPreferences.
   Cookie, Referer and User-Agent cannot be set from a TV webview.
   They are dropped and, if the site then demands them, the UI says so.
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

  async function http(method, url, headers, body, options) {
    const follow = !options || options.followRedirects !== false;
    const split = splitHeaders(headers);
    if (split.stripped.length) callState.stripped.push(...split.stripped);
    const init = { method, headers: split.ok, redirect: follow ? "follow" : "manual", credentials: "omit" };
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
      response = await fetch(url, init);
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
