// Test v0.3.2 in Chromium headless via CDP. Uso: node v032test.mjs <porta>
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
const ev = async x => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); return r.result?.exceptionDetails ? "ERR " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 300) : r.result?.result?.value; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEYS = { 37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown", 13: "Enter", 10009: "XF86Back", 48: "0" };
const key = async code => { for (const type of ["rawKeyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: KEYS[code], code: code === 48 ? "Digit0" : KEYS[code] }); };
const waitFor = async (x, ms = 45000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await ev(x); if (v && !String(v).startsWith("ERR")) return true; await sleep(400); } return false; };
const click = sel => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'manca'; e.click(); return 'ok'})()`);
const results = []; const ok = (name, cond, info) => { results.push((cond ? "PASS " : "FAIL ") + name + (info !== undefined ? "  → " + JSON.stringify(info) : "")); };
// Test conferma disinstallazione (v0.3.5). Uso: node uninstalltest.mjs <porta>
await send("Runtime.enable");
await waitFor("window.Mly && Mly.ui && document.querySelector('.rail-btn')"); await sleep(600);
const cur = "(()=>{const c=Mly.nav.current(); return c? (c.dataset.act||'')+'|'+c.textContent.trim():null})()";
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(300);
await click('[data-act="browse"][data-tab="extensions"]');
await waitFor("document.querySelectorAll('#stage [data-eid]').length>0", 30000);
const awId = await ev("String((Mly.ext.installedList().find(e=>e.name==='AnimeWorld')||{}).id||'')");
if (!awId) { await ev(`(()=>{const r=[...document.querySelectorAll('#stage .row')].find(r=>r.querySelector('.row-title').textContent==='AnimeWorld'); r.querySelector('[data-act=install]').click(); return 1})()`); await waitFor("Mly.ext.installedList().some(e=>e.name==='AnimeWorld')", 30000); await sleep(600); }
const extId = await ev("String(Mly.ext.installedList().find(e=>e.name==='AnimeWorld').id)");
const installed = () => ev(`!!Mly.memory.extensions['${extId}']`);
const btnSel = `[data-act=uninstall][data-eid="${extId}"]`;
await ev(`Mly.nav.focus(document.querySelector('${btnSel}')); 1`);
await key(13); await sleep(300);
const d1 = await ev("(()=>{const d=document.getElementById('dialog'); return d? {titolo:d.querySelector('h2').textContent, testo:d.querySelector('p').textContent, pulsanti:[...d.querySelectorAll('button')].map(b=>b.textContent)}:null})()");
ok("OK su Disinstalla apre la conferma", !!d1 && d1.titolo === "Disinstalla" && /AnimeWorld/.test(d1.testo) && JSON.stringify(d1.pulsanti) === '["Annulla","Disinstalla"]', d1);
ok("focus iniziale su Annulla", await ev(cur) === "close-dialog|Annulla", await ev(cur));
ok("ancora installata mentre la conferma è aperta", await installed());
await key(13); await sleep(300);
ok("Annulla chiude senza disinstallare", await ev("!document.getElementById('dialog')") && await installed());
ok("focus torna su Disinstalla", await ev(cur) === "uninstall|Disinstalla", await ev(cur));
await key(13); await sleep(300); await key(10009); await sleep(300);
ok("Indietro chiude senza disinstallare", await ev("!document.getElementById('dialog')") && await installed());
await key(13); await sleep(300); await key(39); await sleep(200);
ok("Destra passa a Disinstalla nella conferma", await ev(cur) === "confirm-ok|Disinstalla", await ev(cur));
await key(37); await sleep(200);
ok("Sinistra torna su Annulla", await ev(cur) === "close-dialog|Annulla", await ev(cur));
await key(40); await sleep(200);
ok("Giù resta nella conferma", await ev("Mly.nav.current() && !!Mly.nav.current().closest('#dialog')"));
await key(39); await sleep(200); await key(13); await sleep(500);
ok("Disinstalla conferma rimuove l'estensione", await ev("!document.getElementById('dialog')") && !(await installed()));
const row = await ev(`(()=>{const r=[...document.querySelectorAll('#stage .row')].find(r=>r.querySelector('.row-title').textContent==='AnimeWorld'); return r? r.innerText.replace(/\\n/g,' | '):null})()`);
ok("riga torna a Installa e il focus resta sul pulsante della riga", /Installa/.test(row) && await ev(cur) === "install|Installa" && await ev(`Mly.nav.current().dataset.eid==='${extId}'`), { riga: row, focus: await ev(cur) });
await key(13); await waitFor(`!!Mly.memory.extensions['${extId}']`, 30000); await sleep(600);
ok("reinstallata con OK", await installed());
ok("dopo l'installazione il focus resta sul pulsante (ora Disinstalla)", await ev(cur) === "uninstall|Disinstalla" && await ev(`Mly.nav.current().dataset.eid==='${extId}'`), await ev(cur));
// --- Navigazione con le frecce nella lista Estensioni ---
if (!(await ev("Mly.ui.isAdult()"))) { for (let i = 0; i < 5; i++) { await key(48); await sleep(80); } await sleep(400); }
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(200); await click('[data-act="browse"][data-tab="extensions"]'); await sleep(500);
const where = "(()=>{const c=Mly.nav.current(); if(!c) return null; const r=c.closest('.row'); const rows=r? [...r.parentNode.querySelectorAll('.row')]:[]; return {riga: r? rows.indexOf(r):-1, nome: r? r.querySelector('.row-title').textContent:null, col: r? [...r.querySelectorAll('[data-focus]')].indexOf(c):-1, testo: c.classList.contains('row-main')? 'riga': c.textContent.trim(), rail: c.dataset.zone==='rail'}})()";
const nrows = await ev("document.querySelectorAll('#stage [data-rownav] .row').length");
await ev("Mly.nav.focus(document.querySelector('#stage [data-rownav] .row .row-main')); 1");
let w = await ev(where);
ok("parto dalla prima riga", w.riga === 0 && w.col === 0, w);
let skipped = 0, visited = [];
for (let i = 0; i < nrows; i++) {
  w = await ev(where); visited.push(w.nome);
  const btns = await ev(`[...document.querySelectorAll('#stage [data-rownav] .row')[${i}].querySelectorAll('[data-focus]')].length`);
  for (let b = 1; b < btns; b++) { await key(39); await sleep(60); const x = await ev(where); if (x.riga !== i || x.col !== b) skipped++; }
  await key(39); await sleep(60); if ((await ev(where)).col !== btns - 1) skipped++;
  for (let b = btns - 2; b >= 0; b--) { await key(37); await sleep(60); const x = await ev(where); if (x.riga !== i || x.col !== b) skipped++; }
  if (i < nrows - 1) { await key(40); await sleep(60); const x = await ev(where); if (x.riga !== i + 1 || x.col !== 0) skipped++; }
}
ok("Giù visita ogni riga in ordine; Destra/Sinistra raggiungono ogni pulsante e tornano alla riga", skipped === 0 && visited.length === nrows, { righe: nrows, errori: skipped, visitate: visited.join(", ") });
await key(37); await sleep(100);
ok("Sinistra dalla riga va sulla scheda selezionata della barra", (await ev(where)).rail === true && await ev("Mly.nav.current().classList.contains('is-selected')"));
await key(39); await sleep(100);
// riga installata: colonna Disinstalla, poi Su/Giù mantengono la colonna se possibile
await ev(`Mly.nav.focus(document.querySelector('[data-fid="ext-${extId}"]')); 1`);
await key(39); await sleep(80);
w = await ev(where);
ok("Destra sulla riga installata va su Disinstalla", w.nome === "AnimeWorld" && w.testo === "Disinstalla", w);
await key(40); await sleep(80); const below = await ev(where); await key(38); await sleep(80); const back = await ev(where);
ok("Giù poi Su da Disinstalla torna su Disinstalla della stessa riga", back.nome === "AnimeWorld" && back.testo === "Disinstalla" && below.riga !== back.riga, { giu: below, su: back });
// ultima riga -> Giù va su "Aggiorna" in fondo
await ev("Mly.nav.focus([...document.querySelectorAll('#stage [data-rownav] .row')].pop().querySelector('.row-main')); 1");
await key(40); await sleep(80);
ok("Giù dall'ultima riga va su Aggiorna (elenco)", await ev(cur) === "reload-index|Aggiorna", await ev(cur));
await key(38); await sleep(80);
ok("Su da Aggiorna torna all'ultima riga", (await ev(where)).riga === nrows - 1, await ev(where));
// installa una non installata con le frecce + OK, il focus resta sul pulsante
const tgt = await ev("(()=>{const r=[...document.querySelectorAll('#stage [data-rownav] .row')].find(r=>r.querySelector('[data-act=install].row-btn')); return r? r.querySelector('.row-main').dataset.eid:null})()");
if (tgt) {
  await ev(`Mly.nav.focus(document.querySelector('[data-fid="ext-${tgt}"]')); 1`);
  await key(39); await sleep(80);
  ok("Destra su riga non installata va su Installa", await ev(cur) === "install|Installa", await ev(cur));
  await key(13); await waitFor(`!!Mly.memory.extensions['${tgt}']`, 30000); await sleep(600);
  ok("dopo Installa il focus è su Disinstalla della stessa riga", await ev(cur) === "uninstall|Disinstalla" && await ev(`Mly.nav.current().dataset.eid==='${tgt}'`), await ev(cur));
  await key(13); await sleep(300); await key(39); await sleep(100); await key(13); await sleep(500);
  ok("e la si disinstalla di nuovo passando dalla conferma", !(await ev(`!!Mly.memory.extensions['${tgt}']`)));
}
for (let i = 0; i < 5 && await ev("Mly.ui.isAdult()"); i++) { await key(48); await sleep(80); }
await ev("Mly.ui.selectTab('library', true); 1");
console.log(results.join("\n")); console.log("--- errori console ---\n" + logs.join("\n")); process.exit(0);
