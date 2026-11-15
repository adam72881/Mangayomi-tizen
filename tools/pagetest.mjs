// Paginazione di Sfoglia e riassunto del dettaglio, senza siti veri.
// Una sorgente finta risponde a più pagine. Uso: node pagetest.mjs <porta>
const [port = "9444"] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = list.find(t => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = {}; const logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; return; }
  if (m.method === "Runtime.exceptionThrown") logs.push("[exception] " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
  if (m.method === "Runtime.consoleAPICalled" && /error/.test(m.params.type)) logs.push("[console.error] " + m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 300)); };
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); return r.result?.exceptionDetails ? "ERR " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 400) : r.result?.result?.value; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEYS = { 37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown", 13: "Enter", 10009: "XF86Back" };
const key = async code => { for (const type of ["rawKeyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: KEYS[code], code: KEYS[code] }); };
const waitFor = async (x, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await ev(x); if (v && !String(v).startsWith("ERR")) return true; await sleep(80); } return false; };
const click = sel => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'manca'; e.click(); return 'ok'})()`);
const results = []; const ok = (name, cond, info) => { results.push((cond ? "PASS " : "FAIL ") + name + (info !== undefined ? "  → " + JSON.stringify(info) : "")); };
await send("Runtime.enable");
await waitFor("window.Mly && Mly.ui && document.querySelector('.rail-btn')");

const CODE = `
class DefaultExtension extends MProvider {
  get supportsLatest() { return true; }
  async getPopular(page) { return this.build("Popolari", page); }
  async getLatestUpdates(page) { return this.build("Recenti", page); }
  async search(q, page, filters) {
    var tag = "Ricerca";
    if (q) tag += " " + q;
    if (filters && filters.length) {
      for (var i = 0; i < filters.length; i++) {
        var f = filters[i];
        if (f && f.type_name === "SelectFilter" && f.values && f.values[f.state]) tag += " " + f.values[f.state].name;
      }
    }
    return this.build(tag, page);
  }
  async getDetail(url) {
    var tail = "";
    for (var i = 0; i < 160; i++) tail += "parola ";
    return { name: "Titolo prova", description: "Grazie alla sua esperienza " + tail + "FINE SINOSSI.", chapters: [{ name: "Episodio 1", url: url + "/1" }] };
  }
  async getVideoList() { return []; }
  getFilterList() {
    return [{ type_name: "SelectFilter", name: "Ordine", state: 0, values: [
      { type_name: "SelectOption", name: "Standard", value: "0" },
      { type_name: "SelectOption", name: "Novità", value: "1" }
    ] }];
  }
  getSourcePreferences() { return []; }
  async build(prefix, page) {
    var g = window.__pages || {};
    var max = g.pages || 3;
    var size = g.size || 18;
    if (g.delay && page > 1) await new Promise(function (r) { setTimeout(r, g.delay); });
    if (g.mode === "fail2" && page === 2 && g.failLeft > 0) { g.failLeft -= 1; throw new Error("rete di prova"); }
    if (g.mode === "empty2" && page === 2) return { list: [], hasNextPage: true };
    var list = [];
    for (var i = 0; i < size; i++) list.push({ name: prefix + " " + page + "-" + i, link: "/" + prefix + "/" + page + "/" + i, imageUrl: "" });
    var next = page < max;
    if (g.mode === "str") next = next ? "true" : "false";
    return { list: list, hasNextPage: next };
  }
}
`;

await ev(`(() => {
  Mly.memory.settings.lang = "it";
  Mly.db.saveSettings();
  const id = "99001";
  Mly.memory.extensions[id] = { id: 99001, name: "Prova Pagine", baseUrl: "https://example.test", lang: "it", version: "1", isNsfw: false, sourceCodeUrl: "test" };
  Mly.memory.codes[id] = ${JSON.stringify(CODE)};
  Mly.db.saveExtensions();
  Mly.ext.drop(id);
  return 1;
})()`);
await send("Page.reload", {});
await waitFor("window.Mly && Mly.ui && document.querySelector('.rail-btn')", 15000);
await sleep(400);
await ev(`window.__pages = { mode: "ok", pages: 3, size: 18, delay: 0, failLeft: 0 }; 1`);
await ev("Mly.ui.selectTab('browse', true); 1");
await sleep(200);
await click('[data-act="browse"][data-tab="sources"]');
await sleep(200);
const opened = await click('[data-act="open-source"][data-id="99001"]');
ok("si apre la sorgente di prova", opened === "ok", opened);
const first = await waitFor("document.querySelector('#grid-source') && document.querySelector('#grid-source')._grid.length === 18", 8000);
ok("Popolari: prima pagina da 18 titoli", first, await ev("document.querySelector('#grid-source') && document.querySelector('#grid-source')._grid.length"));
ok("c'è Carica altro finché la fonte ha pagine", (await ev("(document.querySelector('[data-act=more]')||{}).textContent")) === "Carica altro");

const len = () => ev("document.querySelector('#grid-source') ? document.querySelector('#grid-source')._grid.length : 0");
const seen = async (re) => ev(`[...document.querySelectorAll('#grid-source .vcell-title')].map(e=>e.textContent).join('|')`);

async function goEnd() {
  await ev("Mly.nav.focus(document.querySelector('#grid-source')); 1");
  for (let i = 0; i < 40; i++) {
    const n = await len();
    const more = await ev("!!document.querySelector('[data-act=more], #source-status p')");
    if (n >= 54 && !(await ev("!!document.querySelector('[data-act=more]')"))) return n;
    await key(40);
    await sleep(40);
    if (more && (await ev("!!document.querySelector('#source-status p')"))) await sleep(30);
  }
  return len();
}

const afterRemote = await goEnd();
ok("telecomando: si caricano pagina 2 e 3 e poi ci si ferma", afterRemote === 54, afterRemote);
await ev("document.querySelector('#grid-source')._grid.jump(20); 1");
await sleep(50);
const mid = await seen();
ok("i titoli della pagina 2 sono in griglia", /Popolari 2-/.test(mid), mid.slice(0, 180));
await sleep(400);
ok("dopo l'ultima pagina non parte un altro caricamento", (await len()) === 54 && (await ev("!!document.querySelector('[data-act=more]')")) === false && !(await ev("!!document.querySelector('#source-status p')")));

await ev(`window.__pages.mode = "str"; 1`);
await click('[data-act="src-tab"][data-tab="latest"]');
ok("Ultimi: prima pagina", await waitFor("document.querySelector('#grid-source') && /Recenti 1-/.test(document.querySelector('#grid-source').innerText)", 8000));
await ev("document.querySelector('#grid-source')._grid.jump(document.querySelector('#grid-source')._grid.length - 1); 1");
ok("Ultimi: hasNextPage come stringa carica ancora", await waitFor("document.querySelector('#grid-source')._grid.length >= 36", 8000), await len());
await ev("document.querySelector('#grid-source')._grid.jump(20); 1");
await sleep(40);
ok("Ultimi: titoli della pagina 2", /Recenti 2-/.test(await seen()));

await ev(`window.__pages.mode = "ok"; 1`);
await click('[data-act="src-search"]');
await waitFor("document.querySelector('#osk')", 3000);
await click('[data-key="a"]');
await click('[data-key="done"]');
ok("ricerca: prima pagina", await waitFor("/Ricerca a 1-/.test((document.querySelector('#grid-source')||{}).innerText||'')", 8000), await ev("(document.querySelector('#grid-source')||{}).innerText||''").then(t => String(t).slice(0, 120)));
await ev("document.querySelector('#grid-source')._grid.jump(document.querySelector('#grid-source')._grid.length - 1); 1");
ok("ricerca: pagina successiva", await waitFor("document.querySelector('#grid-source')._grid.length >= 36", 8000), await len());

await click('[data-act="src-filter"]');
await waitFor("document.getElementById('filters')", 3000);
await click('#filters [data-act="fopt"][data-j="1"]');
await click('[data-act="filter-apply"]');
ok("filtri: prima pagina col filtro", await waitFor("/Novit/.test((document.querySelector('#grid-source')||{}).innerText||'')", 8000));
await ev("document.querySelector('#grid-source')._grid.jump(document.querySelector('#grid-source')._grid.length - 1); 1");
ok("filtri: pagina successiva", await waitFor("document.querySelector('#grid-source')._grid.length >= 36", 8000), await len());

await ev(`window.__pages.mode = "empty2"; 1`);
await click('[data-act="src-tab"][data-tab="popular"]');
ok("pagina vuota: si riparte da Popolari", await waitFor("document.querySelector('#grid-source') && document.querySelector('#grid-source')._grid.length === 18 && /Popolari 1-/.test(document.querySelector('#grid-source').innerText)", 8000), await len());
await ev("document.querySelector('#grid-source')._grid.jump(document.querySelector('#grid-source')._grid.length - 1); 1");
ok("pagina 2 vuota ma con hasNextPage: si arriva alla pagina 3", await waitFor("document.querySelector('#grid-source')._grid.length === 36", 8000), await len());
await ev("document.querySelector('#grid-source')._grid.jump(20); 1");
await sleep(40);
ok("i titoli sono quelli della pagina 3, non una lista finita", /Popolari 3-/.test(await seen()) && (await ev("!!document.querySelector('[data-act=more]')")) === false);

await ev(`window.__pages = { mode: "fail2", pages: 3, size: 18, delay: 0, failLeft: 1 }; 1`);
await click('[data-act="src-tab"][data-tab="popular"]');
await waitFor("document.querySelector('#grid-source') && document.querySelector('#grid-source')._grid.length === 18", 8000);
await ev("document.querySelector('#grid-source')._grid.jump(document.querySelector('#grid-source')._grid.length - 1); 1");
ok("errore pagina 2: compare il messaggio", await waitFor("/Pagina successiva non caricata/.test(document.getElementById('source-status') ? document.getElementById('source-status').innerText : '')", 8000), await ev("(document.getElementById('source-status')||{}).innerText"));
ok("la lista già caricata resta visibile", (await len()) === 18 && /Popolari 1-/.test(await seen()));
ok("Riprova è pronto per OK", (await ev("(document.querySelector('[data-act=page-retry]')||{}).textContent")) === "Riprova" && (await ev("Mly.nav.current() && Mly.nav.current().dataset.act")) === "page-retry");
await key(13);
ok("OK su Riprova carica la pagina che era fallita", await waitFor("document.querySelector('#grid-source')._grid.length >= 36 && !(document.getElementById('source-status') && /non caricata/.test(document.getElementById('source-status').innerText))", 8000), { n: await len(), stato: await ev("(document.getElementById('source-status')||{}).innerText") });

await ev(`window.__pages = { mode: "ok", pages: 3, size: 18, delay: 700, failLeft: 0 }; 1`);
await click('[data-act="src-tab"][data-tab="popular"]');
await waitFor("document.querySelector('#grid-source') && document.querySelector('#grid-source')._grid.length === 18", 8000);
await ev("document.querySelector('#grid-source')._grid.jump(document.querySelector('#grid-source')._grid.length - 1); 1");
const loading = await waitFor("/Caricamento/.test((document.getElementById('source-status')||{}).innerText||'')", 2000);
ok("in fondo compare Caricamento…", loading, await ev("(document.getElementById('source-status')||{}).innerText"));
ok("finito il caricamento i titoli aumentano", await waitFor("document.querySelector('#grid-source')._grid.length >= 36", 8000), await len());

await ev("document.querySelector('#grid-source')._grid.jump(0); 1");
await sleep(50);
await ev("document.querySelector('#grid-source .vcell:not([hidden])').click(); 1");
ok("dettaglio aperto", await waitFor("document.querySelector('.desc')", 8000));
const desc = await ev("document.querySelector('.desc').textContent");
ok("il riassunto contiene l'inizio e la fine, non è tagliato nel testo", typeof desc === "string" && desc.startsWith("Grazie alla sua esperienza") && desc.includes("FINE SINOSSI."), desc && desc.slice(0, 40) + " … " + desc.slice(-20));
const box = await ev(`(() => { const e = document.querySelector('.desc'); const s = getComputedStyle(e); return { overflow: s.overflowY, max: s.maxHeight, taller: e.scrollHeight > e.clientHeight + 8, h: e.clientHeight, sh: e.scrollHeight }; })()`);
ok("il riquadro scorre invece di tagliare a altezza fissa", box && box.overflow === "auto" && box.max === "none" && box.taller, box);
await ev("Mly.nav.focus(document.querySelector('.desc')); 1");
const before = await ev("document.querySelector('.desc').scrollTop");
await key(40);
await sleep(40);
const after = await ev("document.querySelector('.desc').scrollTop");
ok("Giù sul riassunto scorre il testo", typeof after === "number" && after > before, { before, after });
await key(13);
await sleep(100);
const dialog = await ev("(document.querySelector('#dialog .sheet-body')||{}).textContent || ''");
ok("OK apre il riassunto intero", /FINE SINOSSI\./.test(dialog) && (await ev("document.querySelector('#dialog h2') && document.querySelector('#dialog h2').textContent")) === "Riassunto", String(dialog).slice(-30));
const d0 = await ev("document.querySelector('#dialog .sheet-body').scrollTop");
await key(40);
await sleep(40);
const d1 = await ev("document.querySelector('#dialog .sheet-body').scrollTop");
ok("nel riquadro aperto Giù scorre ancora", typeof d1 === "number" && d1 > d0, { d0, d1 });

await ev("delete Mly.memory.extensions['99001']; delete Mly.memory.codes['99001']; Mly.db.saveExtensions(); Mly.ext.drop('99001'); 1");
console.log(results.join("\n"));
if (logs.length) console.log("--- errori console ---\n" + logs.join("\n"));
process.exit(results.some(r => r.startsWith("FAIL")) ? 1 : 0);
