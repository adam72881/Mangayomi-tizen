// Playlist di AnimeSaturn: il Download API finto, senza siti veri.
// Il valore in query è un segno di prova, non un token del sito. Uso: node saturntest.mjs <porta>
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = "segno-di-prova";
const hide = (v) => String(v == null ? "" : v).split(MARKER).join("[omesso]");

const xml = readFileSync(path.join(root, "config.xml"), "utf8");
const ui = readFileSync(path.join(root, "js/ui.js"), "utf8");
const rt = readFileSync(path.join(root, "js/runtime.js"), "utf8");
const results = [];
const ok = (name, cond, info) => { results.push((cond ? "PASS " : "FAIL ") + name + (info !== undefined ? "  → " + hide(typeof info === "string" ? info : JSON.stringify(info)) : "")); };
ok("config.xml: versione 0.3.10", /version="0\.3\.10"/.test(xml));
ok("config.xml: privilegio download", xml.includes('name="http://tizen.org/privilege/download"'));
ok("config.xml: privilegio mediastorage", xml.includes('name="http://tizen.org/privilege/mediastorage"'));
ok("config.xml: privilegio filesystem.read", xml.includes('name="http://tizen.org/privilege/filesystem.read"'));
ok("Informazioni: versione 0.3.10", ui.includes("Versione 0.3.10") && !ui.includes("Versione 0.3.9"));
ok("runtime.js non scrive in console", !/console\./.test(rt));

const [port = "9444"] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = {}; const logs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; return; }
  if (m.method === "Runtime.exceptionThrown") logs.push("[exception] " + hide(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
  if (m.method === "Runtime.consoleAPICalled") logs.push("[console] " + hide(m.params.args.map((a) => a.value ?? a.description).join(" ")).slice(0, 300));
};
await new Promise((r) => { ws.onopen = r; });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => {
  const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "ERR " + hide(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 400);
  const v = r.result?.result?.value;
  return typeof v === "string" ? hide(v) : v;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (x, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { const v = await ev(x); if (v && !String(v).startsWith("ERR")) return true; await sleep(200); }
  return false;
};

await send("Runtime.enable");
ok("app avviata", await waitFor("window.Mly && Mly.runtime && Mly.runtime.Client && Mly.memory"));

const installed = await ev(`(() => {
  const marker = ${JSON.stringify(MARKER)};
  const prev = {
    tizen: window.tizen,
    fetch: window.fetch,
    log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug,
  };
  const state = window.__saturn = {
    marker,
    logs: [],
    requests: [],
    deleted: [],
    reads: [],
    resolves: [],
    fetches: [],
    events: [],
    body: '{"d":"campo","p":1,"t":""}',
    mode: "ok",
    failMessage: "",
    readError: "",
    deleteError: false,
    useStream: false,
    fetchThrows: true,
    seq: 0,
    playlist() { return "https://play.saturncdn.net/embed/42/playlist?token=" + marker + "&expires=1"; },
  };
  ["log", "info", "warn", "error", "debug"].forEach((k) => {
    console[k] = (...args) => {
      const line = args.map((a) => { try { return typeof a === "string" ? a : JSON.stringify(a); } catch (e) { return String(a); } }).join(" ");
      state.logs.push(line);
      if (!line.includes(marker)) prev[k](...args);
    };
  });
  function fileFor(fullPath) {
    const file = {
      fullPath,
      fileSize: state.body.length,
      parent: {
        deleteFile(full, onOk, onErr) {
          state.events.push("delete");
          state.deleted.push(full);
          if (state.deleteError) onErr({ name: "IOError", message: "cancellazione rifiutata" });
          else onOk();
        },
      },
    };
    if (state.useStream) {
      file.openStream = (mode, onOk, onErr, encoding) => {
        state.events.push("stream");
        state.reads.push(encoding);
        onOk({ read() { return state.body; }, close() {} });
      };
    } else {
      file.readAsText = (onOk, onErr, encoding) => {
        state.events.push("read");
        state.reads.push(encoding);
        if (state.readError) onErr({ name: "IOError", message: state.readError });
        else onOk(state.body);
      };
    }
    return file;
  }
  function DownloadRequest(url, destination, fileName, networkType, httpHeader) {
    this.url = url;
    this.destination = destination;
    this.fileName = fileName;
    this.networkType = networkType;
    this.httpHeader = httpHeader;
    state.requests.push(this);
  }
  window.tizen = {
    DownloadRequest,
    download: {
      start(req, listener) {
        const downloadId = ++state.seq;
        const fullPath = "downloads/" + req.fileName;
        setTimeout(() => {
          if (state.mode === "fail") listener.onfailed(downloadId, { name: "NetworkError", message: state.failMessage });
          else if (state.mode === "nopath") listener.oncompleted(downloadId, "");
          else listener.oncompleted(downloadId, fullPath);
        }, 0);
        return downloadId;
      },
      cancel(downloadId) { state.canceled = downloadId; },
    },
    filesystem: {
      resolve(fullPath, success, error, mode) {
        state.resolves.push({ path: fullPath, mode });
        if (state.mode === "resolve-fail") { error({ name: "NotFoundError", message: state.failMessage || "manca il file" }); return; }
        success(fileFor(fullPath));
      },
    },
  };
  window.fetch = async (url, init) => {
    state.fetches.push(String((init && init.method) || "GET") + " " + String(url));
    if (state.fetchThrows) throw new Error("fetch non previsto");
    return {
      status: 200, statusText: "OK", url: String(url), type: "basic",
      text: async () => "dal-fetch",
      headers: { forEach() {}, getSetCookie() { return []; } },
    };
  };
  state.restore = () => {
    window.tizen = prev.tizen;
    window.fetch = prev.fetch;
    console.log = prev.log; console.info = prev.info; console.warn = prev.warn; console.error = prev.error; console.debug = prev.debug;
  };
  return "ok";
})()`);
ok("mock del Download API installato", installed === "ok", installed);

const success = await ev(`(async () => {
  const s = window.__saturn;
  s.mode = "ok"; s.fetchThrows = true; s.events = []; s.logs = []; s.reads = []; s.resolves = []; s.deleted = []; s.fetches = [];
  Mly.runtime.beginCall();
  const res = await new Mly.runtime.Client().get(s.playlist(), { Referer: "https://evil.example/", "X-Test": "1" });
  const req = s.requests[s.requests.length - 1];
  const raw = JSON.stringify(res);
  return {
    status: res.statusCode,
    body: res.body,
    referer: req && req.httpHeader && req.httpHeader.Referer,
    headerKeys: req && req.httpHeader ? Object.keys(req.httpHeader) : [],
    dest: req && req.destination,
    net: req && req.networkType,
    file: req && req.fileName,
    urlHadMarker: !!(req && String(req.url).includes(s.marker)),
    responseLeaks: raw.includes(s.marker) || raw.includes("token="),
    requestUrl: res.request && res.request.url,
    events: s.events.join(","),
    deleted: s.deleted[0] || "",
    readEncoding: s.reads[0] || "",
    resolveMode: s.resolves[0] && s.resolves[0].mode,
    fetches: s.fetches.length,
    logLeaks: s.logs.some((l) => l.includes(s.marker)),
    stripped: (Mly.runtime.callState.stripped || []).slice(),
  };
})()`);
ok("GET playlist: corpo letto e stato 200", success && success.status === 200 && success.body === '{"d":"campo","p":1,"t":""}', success && success.status);
ok("DownloadRequest: downloads, ALL, solo Referer del player", success && success.dest === "downloads" && success.net === "ALL" && success.referer === "https://play.saturncdn.net/" && success.headerKeys.length === 1 && success.headerKeys[0] === "Referer", success && { dest: success.dest, net: success.net, referer: success.referer, keys: success.headerKeys });
ok("il Download API riceve l'URL intero, la risposta no", success && success.urlHadMarker && !success.responseLeaks && success.requestUrl === "https://play.saturncdn.net/embed/42/playlist", success && { urlHadMarker: success.urlHadMarker, responseLeaks: success.responseLeaks, requestUrl: success.requestUrl });
ok("file letto in UTF-8, poi cancellato, senza fetch", success && success.events === "read,delete" && success.deleted === "downloads/" + success.file && /^as-playlist-\d+\.json$/.test(success.file || "") && !String(success.file).includes(MARKER) && success.readEncoding === "UTF-8" && success.resolveMode === "r" && success.fetches === 0, success && { events: success.events, deleted: success.deleted, file: success.file, fetches: success.fetches });
ok("il Referer passato dall'estensione non finisce tra gli header scartati", success && Array.isArray(success.stripped) && success.stripped.length === 0, success && success.stripped);
ok("il segno di prova non compare nei log", success && success.logLeaks === false, success && success.logLeaks);

const second = await ev(`(async () => {
  const s = window.__saturn;
  const prev = s.requests[s.requests.length - 1].fileName;
  await new Mly.runtime.Client().get(s.playlist());
  const file = s.requests[s.requests.length - 1].fileName;
  return { prev, file, different: prev !== file };
})()`);
ok("due playlist: nomi di file diversi, sempre as-playlist-N.json", second && second.different && /^as-playlist-\d+\.json$/.test(second.file) && /^as-playlist-\d+\.json$/.test(second.prev), second);

const failed = await ev(`(async () => {
  const s = window.__saturn;
  s.mode = "fail";
  s.logs = [];
  s.failMessage = "HTTP 403 " + s.playlist();
  try {
    await new Mly.runtime.Client().get(s.playlist());
    return { threw: false, leak: false, msg: "" };
  } catch (e) {
    const msg = String(e && e.message || e);
    return { threw: true, leak: msg.includes(s.marker) || msg.includes("token="), msg: (msg.includes(s.marker) || msg.includes("token=")) ? "LEAK" : msg, logLeaks: s.logs.some((l) => l.includes(s.marker)) };
  }
})()`);
ok("onfailed rifiuta la promessa, senza il segno di prova", failed && failed.threw && !failed.leak && !failed.logLeaks && /non riuscito/.test(failed.msg || ""), failed && failed.msg);

const encoded = await ev(`(async () => {
  const s = window.__saturn;
  const token = s.marker + "/parte";
  const url = "https://play.saturncdn.net/embed/9/playlist?token=" + encodeURIComponent(token) + "&expires=2";
  s.mode = "fail";
  s.failMessage = "visto " + token + " e " + encodeURIComponent(token);
  try {
    await new Mly.runtime.Client().get(url);
    return { threw: false, leak: true, msg: "" };
  } catch (e) {
    const msg = String(e && e.message || e);
    const leak = msg.includes(s.marker) || msg.includes("token=") || msg.includes("%2F");
    return { threw: true, leak, msg: leak ? "LEAK" : msg };
  }
})()`);
ok("anche il token codificato non resta nel messaggio di errore", encoded && encoded.threw && !encoded.leak, encoded && encoded.msg);

const missing = await ev(`(async () => {
  const s = window.__saturn;
  const saved = window.tizen;
  const cases = [undefined, {}, { download: {}, DownloadRequest: function(){} }, { download: { start() {} } }];
  const out = [];
  for (const api of cases) {
    window.tizen = api;
    try {
      await new Mly.runtime.Client().get(s.playlist());
      out.push({ threw: false, leak: false, api: false });
    } catch (e) {
      const msg = String(e && e.message || e);
      const leak = msg.includes(s.marker);
      out.push({ threw: true, leak, api: msg.indexOf("Download API di Tizen non è disponibile") !== -1, msg: leak ? "LEAK" : msg });
    }
  }
  window.tizen = saved;
  return out;
})()`);
ok("senza Download API: errore chiaro, quattro casi", Array.isArray(missing) && missing.length === 4 && missing.every((c) => c.threw && c.api && !c.leak), missing);

const noFs = await ev(`(async () => {
  const s = window.__saturn;
  s.mode = "ok";
  const saved = window.tizen.filesystem;
  window.tizen.filesystem = undefined;
  try {
    await new Mly.runtime.Client().get(s.playlist());
    return { threw: false, leak: false, msg: "" };
  } catch (e) {
    const msg = String(e && e.message || e);
    const leak = msg.includes(s.marker);
    return { threw: true, leak, fs: msg.indexOf("tizen.filesystem non è disponibile") !== -1, msg: leak ? "LEAK" : msg };
  } finally {
    window.tizen.filesystem = saved;
  }
})()`);
ok("senza tizen.filesystem: errore chiaro, senza il segno di prova", noFs && noFs.threw && noFs.fs && !noFs.leak, noFs && noFs.msg);

const readFail = await ev(`(async () => {
  const s = window.__saturn;
  s.mode = "ok";
  s.readError = "rotto " + s.playlist();
  s.deleteError = false;
  s.useStream = false;
  s.events = [];
  try {
    await new Mly.runtime.Client().get(s.playlist());
    return { threw: false, leak: true, events: s.events.join(",") };
  } catch (e) {
    const msg = String(e && e.message || e);
    const leak = msg.includes(s.marker) || msg.includes("token=");
    return { threw: true, leak, read: msg.indexOf("Impossibile leggere la playlist") === 0, events: s.events.join(","), msg: leak ? "LEAK" : msg };
  } finally {
    s.readError = "";
  }
})()`);
ok("lettura fallita: si cancella comunque e il messaggio non ha il segno", readFail && readFail.threw && readFail.read && !readFail.leak && readFail.events === "read,delete", readFail);

const deleteFail = await ev(`(async () => {
  const s = window.__saturn;
  s.mode = "ok";
  s.deleteError = true;
  s.events = [];
  try {
    const res = await new Mly.runtime.Client().get(s.playlist());
    return { status: res.statusCode, body: res.body, events: s.events.join(","), leak: JSON.stringify(res).includes(s.marker) };
  } finally {
    s.deleteError = false;
  }
})()`);
ok("se la cancellazione fallisce il corpo torna lo stesso", deleteFail && deleteFail.status === 200 && deleteFail.body === '{"d":"campo","p":1,"t":""}' && deleteFail.events === "read,delete" && !deleteFail.leak, deleteFail && deleteFail.status);

const stream = await ev(`(async () => {
  const s = window.__saturn;
  s.mode = "ok";
  s.useStream = true;
  s.events = [];
  try {
    const res = await new Mly.runtime.Client().get(s.playlist());
    return { body: res.body, events: s.events.join(","), encoding: s.reads[0] };
  } finally {
    s.useStream = false;
  }
})()`);
ok("senza readAsText si usa openStream e poi si cancella", stream && stream.body === '{"d":"campo","p":1,"t":""}' && stream.events === "stream,delete" && stream.encoding === "UTF-8", stream);

const others = await ev(`(async () => {
  const s = window.__saturn;
  s.mode = "ok";
  s.fetchThrows = false;
  s.logs = [];
  const beforeLogs = 0;
  const cases = [
    ["altro-host", "https://example.test/embed/42/playlist?token=" + s.marker],
    ["http", "http://play.saturncdn.net/embed/42/playlist?token=" + s.marker],
    ["senza-id", "https://play.saturncdn.net/embed/playlist?token=" + s.marker],
    ["path-extra", "https://play.saturncdn.net/embed/42/playlist/extra?token=" + s.marker],
    ["host-simile", "https://play.saturncdn.net.evil.test/embed/42/playlist?token=" + s.marker],
    ["porta", "https://play.saturncdn.net:444/embed/42/playlist?token=" + s.marker],
  ];
  const out = [];
  for (let i = 0; i < cases.length; i++) {
    const n = s.requests.length;
    const f = s.fetches.length;
    const res = await new Mly.runtime.Client().get(cases[i][1]);
    out.push({ name: cases[i][0], noDownload: s.requests.length === n, fetched: s.fetches.length === f + 1, body: res.body === "dal-fetch" });
  }
  const n = s.requests.length;
  const post = await new Mly.runtime.Client().post(s.playlist(), null, "x");
  out.push({ name: "post", noDownload: s.requests.length === n, fetched: /POST /.test(s.fetches[s.fetches.length - 1] || ""), body: post.body === "dal-fetch" });
  out.push({ name: "log", noDownload: true, fetched: true, body: !s.logs.slice(beforeLogs).some((l) => l.includes(s.marker)) });
  return out;
})()`);
ok("gli altri URL e il POST restano su fetch", Array.isArray(others) && others.length === 8 && others.every((c) => c.noDownload && c.fetched && c.body), others);

await ev("window.__saturn && window.__saturn.restore && window.__saturn.restore(); 1");
ok("mock rimosso", await ev("!window.tizen && window.fetch && String(window.fetch).indexOf('fetchThrows') === -1"));

console.log(results.join("\n"));
if (logs.length) console.log("--- console ---\n" + logs.map((l) => hide(l)).join("\n"));
ws.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
