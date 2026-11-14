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
// HypnoTube: Popolari e Ultimi devono dare liste diverse. Uso: node hypnotest.mjs <porta>
await send("Runtime.enable");
await waitFor("window.Mly && Mly.ui && document.querySelector('.rail-btn')"); await sleep(500);
if (!(await ev("Mly.ui.isAdult()"))) { for (let i = 0; i < 5; i++) { await key(48); await sleep(80); } await sleep(400); }
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(200);
await click('[data-act="browse"][data-tab="extensions"]');
await waitFor("document.querySelectorAll('#stage [data-eid]').length>0", 30000);
const hid = await ev("String((Mly.ui && (Mly.ext.installedList().find(e=>e.name==='HypnoTube')||{}).id)||'')");
let installedHere = false;
if (!hid) { await ev(`(()=>{const r=[...document.querySelectorAll('#stage .row')].find(r=>r.querySelector('.row-title').textContent==='HypnoTube'); r.querySelector('[data-act=install]').click(); return 1})()`); await waitFor("Mly.ext.installedList().some(e=>e.name==='HypnoTube')", 30000); installedHere = true; }
const sid = await ev("String(Mly.ext.installedList().find(e=>e.name==='HypnoTube').id)");
const first = (m) => ev(`Mly.ext.call('${sid}','${m}',e=>e.${m}(1)).then(r=>(r.list||[]).slice(0,4).map(x=>x.name+' '+x.link.replace(/^.*\\/video\\//,'')))`, true);
const pop = await first("getPopular"); const lat = await first("getLatestUpdates");
ok("HypnoTube: Popolari e Ultimi diversi (chiamate dirette)", JSON.stringify(pop) !== JSON.stringify(lat) && pop.length > 0, { popolari: pop, ultimi: lat });
// stessa cosa dall'interfaccia
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(200); await click('[data-act="browse"][data-tab="sources"]'); await sleep(300);
await click(`[data-act="open-source"][data-id="${sid}"]`);
await sleep(150);
const f0 = await ev("(()=>{const c=Mly.nav.current(); return c? (c.dataset.fid||c.dataset.act)+'|'+c.textContent.trim().slice(0,20):null})()");
ok("entrando nella sorgente il focus è su Popolari (non su Cerca)", /^src-tab-popular\|Popolari/.test(f0) || /^grid-source/.test(f0), f0);
await waitFor("document.querySelector('#grid-source .vcell .vcell-title') || document.querySelector('#stage .empty h2:not(:empty)') && !/Caricamento/.test(document.querySelector('#stage .empty h2').textContent)", 40000);
const names = () => ev("[...document.querySelectorAll('#grid-source .vcell:not([hidden])')].sort((a,b)=>a.dataset.i-b.dataset.i).slice(0,4).map(c=>c.querySelector('.vcell-title').textContent)");
const uiPop = await names();
ok("a caricamento finito il focus è sulla prima copertina", await ev("Mly.nav.current() && Mly.nav.current().id==='grid-source' && Mly.nav.current()._grid.index===0 && !!document.querySelector('#grid-source .vcell.is-focused[data-i=\"0\"]')"), await ev("(Mly.nav.current()||{}).id"));
const geo = await ev("(()=>{const c=document.querySelector('#grid-source .vcell[data-i=\"1\"]'); const im=c.querySelector('.vcell-img'), card=c.querySelector('.vcell-card'), t=c.querySelector('.vcell-title'); const a=im.getBoundingClientRect(), b=card.getBoundingClientRect(), i=im.querySelector('img').getBoundingClientRect(), tr=t.getBoundingClientRect(); const cs=getComputedStyle(im); return {cella:[c.offsetWidth,c.offsetHeight], img:[Math.round(i.width),Math.round(i.height)], area:[Math.round(a.width),Math.round(a.height)], scostamento:[Math.round(i.left-a.left),Math.round(i.top-a.top)], raggio:cs.borderRadius, overflow:cs.overflow, titolo:t.textContent, titoloDentro: tr.bottom<=a.bottom+1 && tr.top>=a.top, righe: Math.round(tr.height/parseFloat(getComputedStyle(t).lineHeight))}})()");
ok("copertina: immagine allineata e ritagliata con angoli arrotondati, titolo sopra la sfumatura (max 2 righe)", geo && geo.img && geo.scostamento[0]===0 && geo.scostamento[1]===0 && geo.img[0]===geo.area[0] && geo.img[1]===geo.area[1] && geo.raggio==="12px" && geo.overflow==="hidden" && geo.titolo.length>0 && geo.titoloDentro && geo.righe<=2, geo);
await click('[data-act="src-tab"][data-tab="latest"]'); await sleep(300);
await waitFor("!document.querySelector('#stage .empty') && document.querySelector('#grid-source .vcell .vcell-title')", 40000); await sleep(300);
const uiLat = await names();
ok("HypnoTube: Popolari e Ultimi diversi nell'interfaccia", uiPop.length > 0 && JSON.stringify(uiPop) !== JSON.stringify(uiLat), { popolari: uiPop, ultimi: uiLat });
console.log(results.join("\n")); console.log("--- errori console ---\n" + logs.join("\n")); process.exit(0);
