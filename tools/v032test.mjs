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
await send("Runtime.enable");
const screenName = "(document.querySelector('#stage [data-screen]')||{}).dataset?.screen";
const rows = "[...document.querySelectorAll('#stage .row .row-title')].map(e=>e.textContent)";
await waitFor("window.Mly && Mly.ui && document.querySelector('.rail-btn')");
await sleep(800);

// 1) Italiano + modalità nascosta
const rail = await ev("[...document.querySelectorAll('.rail-btn')].map(b=>b.textContent.trim())");
ok("rail in italiano", JSON.stringify(rail) === JSON.stringify(["Libreria","Aggiornamenti","Cronologia","Sfoglia","Altro"]), rail);
ok("avvio su Libreria", (await ev(screenName)) === "library" && (await ev("document.querySelector('.top h1').textContent")) === "Libreria");
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(300);
await click('[data-act="browse"][data-tab="extensions"]');
await waitFor("document.querySelectorAll('#stage [data-eid]').length>0", 30000);
const extHidden = await ev(rows);
ok("Estensioni nascoste: solo non-18+", extHidden.length >= 1 && extHidden.every(n => n === "AnimeWorld"), extHidden);
ok("pill Sorgenti/Estensioni/Migra", (await ev("[...document.querySelectorAll('#stage .pill')].map(p=>p.textContent).join('|')")) === "Sorgenti|Estensioni|Migra");
for (let i = 0; i < 5; i++) { await key(48); await sleep(150); }
await sleep(200);
ok("toast neutro dopo 0×5", (await ev("(document.getElementById('toast')||{}).textContent")) === "OK" && await ev("Mly.ui.isAdult()") === true);
const extAll = await ev(rows);
ok("Estensioni visibili dopo 0×5", extAll.length >= 9, extAll);
ok("pulsanti Installa in italiano", (await ev("[...document.querySelectorAll('#stage .row-action')].map(e=>e.textContent)")).every(t => /^(Installa|Installata|Aggiorna|…)$/.test(t)));
for (const name of ["AnimeWorld", "PMVHaven"]) {
  await ev(`(()=>{const row=[...document.querySelectorAll('#stage .row')].find(r=>r.querySelector('.row-title').textContent===${JSON.stringify(name)}); const b=row&&row.querySelector('[data-act="install"]'); if(b) b.click(); return 1})()`);
  await waitFor(`Object.values(Mly.memory.extensions).some(e=>e.name===${JSON.stringify(name)})`, 30000); await sleep(600);
}
ok("AnimeWorld e PMVHaven installate", await ev("Object.values(Mly.memory.extensions).map(e=>e.name).sort().join(',')") === "AnimeWorld,PMVHaven");
ok("Disinstalla in italiano", await ev("[...document.querySelectorAll('[data-act=uninstall]')].every(b=>b.textContent==='Disinstalla')"));

// 2) Sorgente PMV: Popolari, Carica altro, Su → griglia, miniature
await click('[data-act="browse"][data-tab="sources"]'); await sleep(300);
const pmvId = await ev("Object.values(Mly.memory.extensions).find(e=>e.name==='PMVHaven').id");
const awId = await ev("Object.values(Mly.memory.extensions).find(e=>e.name==='AnimeWorld').id");
ok("Sorgenti con adulti attivi: 2", (await ev(rows)).length === 2, await ev(rows));
await click(`[data-act="open-source"][data-id="${pmvId}"]`);
await waitFor("document.querySelectorAll('#grid-source .vgrid-track > *').length>0", 45000); await sleep(3000);
ok("sorgente: pill Popolari/Ultimi e strumenti", (await ev("[...document.querySelectorAll('#stage .pill')].map(p=>p.textContent+(p.classList.contains('is-on')?'*':'')).join(' ')")) === "Popolari* Ultimi" && (await ev("[...document.querySelectorAll('.top-actions .text-btn')].map(b=>b.textContent).join('|')")) === "Cerca|Filtri|Impostazioni|Web", await ev("[...document.querySelectorAll('.top-actions .text-btn')].map(b=>b.textContent).join('|')"));
const more = await ev("(document.querySelector('[data-act=more]')||{}).textContent");
ok("pulsante Carica altro", more === "Carica altro", more);
await ev("Mly.nav.focus(document.querySelector('#grid-source')); 1");
await key(40); await key(39); await key(39); await sleep(200);
const gi = await ev("document.querySelector('#grid-source')._grid.index");
await ev("Mly.nav.focus(document.querySelector('[data-act=more]')); 1"); await key(38); await sleep(200);
ok("Su da Carica altro torna alla griglia (stesso elemento)", await ev("Mly.nav.current()===document.querySelector('#grid-source')") === true && await ev("document.querySelector('#grid-source')._grid.index") === gi, { prima: gi, dopo: await ev("document.querySelector('#grid-source')._grid.index") });
const thumbs = await ev("[...document.querySelectorAll('#grid-source img')].filter(i=>i.naturalWidth).slice(0,6).map(i=>i.naturalWidth+'x'+i.naturalHeight+' '+i.currentSrc.slice(0,90))");
ok("miniature PMV caricate", thumbs.length > 0, thumbs);
await key(10009); await sleep(300);

// 3) Nascondi di nuovo: sparisce tutto ciò che è 18+
await ev(`(()=>{ const now=Date.now();
  Mly.memory.library.push({id:'${pmvId}|/v/x', sourceId:'${pmvId}', sourceName:'PMVHaven', link:'/v/x', name:'TEST-PMV', imageUrl:'', chapters:[], categories:[], knownUrls:[], addedAt:now});
  Mly.memory.library.push({id:'${awId}|/a/y', sourceId:'${awId}', sourceName:'AnimeWorld', link:'/a/y', name:'TEST-AW', imageUrl:'', chapters:[], categories:[], knownUrls:[], addedAt:now-1});
  Mly.memory.history.unshift({id:'h1', sourceId:'${pmvId}', seriesLink:'/v/x', episodeUrl:'/v/x/e', title:'TEST-PMV', episodeName:'Episodio 1', positionMs:1000, durationMs:9000, at:now});
  Mly.memory.history.unshift({id:'h2', sourceId:'${awId}', seriesLink:'/a/y', episodeUrl:'/a/y/e', title:'TEST-AW', episodeName:'Episodio 1', positionMs:1000, durationMs:9000, at:now});
  Mly.memory.updates.unshift({id:'u1', sourceId:'${pmvId}', seriesLink:'/v/x', episodeUrl:'/v/x/e2', title:'TEST-PMV', episodeName:'Episodio 2'});
  return 1; })()`);
for (let i = 0; i < 5; i++) { await key(48); await sleep(150); }
await sleep(200);
ok("0×5 di nuovo → nascosto", await ev("Mly.ui.isAdult()") === false);
const visText = async (tab) => { await ev(`Mly.ui.selectTab('${tab}', true); 1`); await sleep(500); return ev("document.getElementById('stage').innerText"); };
let t = await visText("browse"); ok("Sfoglia (Sorgenti) senza PMVHaven", !/PMVHaven/.test(t) && /AnimeWorld/.test(t));
await click('[data-act="browse"][data-tab="extensions"]'); await sleep(500);
t = await ev("document.getElementById('stage').innerText"); ok("Estensioni senza voci 18+", !/PMVHaven|Chaturbate|HentaiWorld|BongaCams|Stripchat|HypnoTube|JAV/.test(t), (await ev(rows)));
await ev("Mly.ui.selectTab('library', true); 1"); await sleep(600);
const libNames = await ev("[...document.querySelectorAll('#grid-library .vcell:not([hidden]) .vcell-title')].map(e=>e.textContent)");
ok("Libreria: solo TEST-AW", JSON.stringify(libNames) === '["TEST-AW"]', libNames);
await ev("Mly.ui.selectTab('history', true); 1"); await sleep(600);
const hisNames = await ev("[...document.querySelectorAll('.vrow:not([hidden]) .vrow-title')].map(e=>e.textContent)");
ok("Cronologia: solo TEST-AW", !hisNames.includes("TEST-PMV") && hisNames.includes("TEST-AW"), hisNames);
await ev("Mly.ui.selectTab('updates', true); 1"); await sleep(400);
t = await ev("document.getElementById('stage').innerText");
ok("Aggiornamenti: niente PMV, badge vuoto", !/TEST-PMV/.test(t) && await ev("document.getElementById('badge-updates').hidden") === true);
await ev("Mly.ui.selectTab('library', true); 1"); await sleep(300);
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(300);
await ev("document.querySelector('.rail-btn[data-tab=library]').click(); 1"); await sleep(300);
await ev("Mly.nav.focus(document.querySelector('.rail-btn[data-tab=library]')); 1");
for (let i = 0; i < 5; i++) { await key(38); await sleep(120); }
await sleep(200);
ok("ripiego Su×5 sulla Libreria → visibile", await ev("Mly.ui.isAdult()") === true);
const libNames2 = await ev("[...document.querySelectorAll('#grid-library .vcell:not([hidden]) .vcell-title')].map(e=>e.textContent)");
ok("Libreria con adulti: 2 titoli", libNames2.length === 2, libNames2);
for (let i = 0; i < 5; i++) { await key(38); await sleep(120); }
ok("Su×5 di nuovo → nascosto", await ev("Mly.ui.isAdult()") === false);
// pulizia elementi finti
await ev("Mly.memory.library=Mly.memory.library.filter(x=>!/^TEST/.test(x.name)); Mly.memory.history=Mly.memory.history.filter(x=>!/^TEST/.test(x.title)); Mly.memory.updates=Mly.memory.updates.filter(x=>x.title!=='TEST-PMV'); Mly.db.saveLibrary(); Mly.db.saveHistory(); Mly.db.saveUpdates(); 1");

// 4) Logica Riprendi/Continua (sintetica, lista decrescente come AnimeWorld)
const unit = await ev(`(()=>{
  const ch=[]; for(let n=12;n>=1;n--) ch.push({name:'Episodio '+n, url:'/e'+n});
  const key='${awId}|/serie-test'; const out={};
  delete Mly.memory.progress[key];
  out.mai = Mly.ui.resumeChoice('${awId}','/serie-test',ch);
  Mly.memory.progress[key]={watched:{}, episodeUrl:'/e1', positionMs:754000, durationMs:1440000, positions:{'/e1':{positionMs:754000,durationMs:1440000}}};
  out.parziale = Mly.ui.resumeChoice('${awId}','/serie-test',ch);
  Mly.memory.progress[key]={watched:{}, episodeUrl:'/e1', positionMs:1380000, durationMs:1440000, positions:{'/e1':{positionMs:1380000,durationMs:1440000}}};
  out.finito = Mly.ui.resumeChoice('${awId}','/serie-test',ch);
  Mly.memory.progress[key]={watched:{'/e1':true,'/e2':true,'/e3':true}, episodeUrl:'/e3', positionMs:1440000, durationMs:1440000};
  out.tre = Mly.ui.resumeChoice('${awId}','/serie-test',ch);
  Mly.memory.progress[key]={watched:{'/e12':true}, episodeUrl:'/e12', positionMs:1440000, durationMs:1440000};
  out.ultimo = Mly.ui.resumeChoice('${awId}','/serie-test',ch);
  const asc = ch.slice().reverse(); delete Mly.memory.progress[key];
  out.crescente = Mly.ui.resumeChoice('${awId}','/serie-test',asc);
  out.next_desc = Mly.ui.nextIndex(ch, ch.findIndex(c=>c.url==='/e5'));
  delete Mly.memory.progress[key];
  const f=o=>({ep:ch[o.idx]?ch[o.idx].name:null, label:o.label, startAt:o.startAt});
  return {mai:f(out.mai), parziale:f(out.parziale), finito:f(out.finito), tre:f(out.tre), ultimo:f(out.ultimo), crescente:{ep:asc[out.crescente.idx].name,label:out.crescente.label}, next_dopo_ep5:ch[out.next_desc].name};
})()`);
ok("mai vista → Ep. 1 (lista decrescente)", unit.mai.ep === "Episodio 1" && unit.mai.label.startsWith("Inizia"), unit.mai);
ok("parziale → Riprendi Ep. 1 a 12:34", unit.parziale.ep === "Episodio 1" && unit.parziale.startAt === 754000 && unit.parziale.label === "Riprendi Ep. 1  ·  12:34", unit.parziale);
ok("finito (>90%) → Continua Ep. 2", unit.finito.ep === "Episodio 2" && unit.finito.startAt === 0 && unit.finito.label === "Continua Ep. 2", unit.finito);
ok("visti 1-3 → Continua Ep. 4", unit.tre.ep === "Episodio 4", unit.tre);
ok("visto l'ultimo → Rivedi Ep. 12", unit.ultimo.ep === "Episodio 12" && unit.ultimo.label.startsWith("Rivedi"), unit.ultimo);
ok("lista crescente → Ep. 1", unit.crescente.ep === "Episodio 1", unit.crescente);
ok("successivo dopo Ep. 5 = Ep. 6", unit.next_dopo_ep5 === "Episodio 6", unit.next_dopo_ep5);

// 5) Prova reale AnimeWorld: One Piece
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(300);
await click('[data-act="browse"][data-tab="sources"]'); await sleep(300);
await click(`[data-act="open-source"][data-id="${awId}"]`);
await waitFor("document.querySelectorAll('#grid-source .vgrid-track > *').length>0", 45000); await sleep(1500);
const op = await ev("(()=>{const f=[...document.querySelectorAll('#grid-source .vcell')].find(c=>/One Piece/i.test(c.textContent)); if(!f) return null; f.click(); return f.textContent})()");
if (!op) await ev("document.querySelector('#grid-source .vcell').click(); 1");
await waitFor("document.querySelectorAll('[data-mount=episodes] .vrow').length>0", 45000); await sleep(1000);
const series = await ev("document.querySelector('.detail-hero h1').textContent");
const btn1 = await ev("document.querySelector('[data-act=detail-play]').textContent");
ok("dettaglio reale: pulsante Inizia · Ep. 1", /^Inizia/.test(btn1) && /Ep\. 1$/.test(btn1), { serie: series, pulsante: btn1 });
ok("dettaglio in italiano", await ev("document.querySelector('.eps-head').textContent").then(x => /^Episodi/.test(x)) && /episodi/.test(await ev("document.querySelector('.detail-hero .meta').textContent")), await ev("document.querySelector('.detail-hero .meta').textContent"));
await click('[data-act=detail-play]');
const started = await waitFor("(()=>{const v=document.getElementById('player-video'); return v && v.readyState>=2 && v.currentTime>0.5})()", 60000);
const ep1 = await ev("({ep:document.querySelector('.player-ep').textContent, src:(document.getElementById('player-video').currentSrc||'').slice(-60)})");
ok("riproduce l'episodio 1", started && /(^|\D)1$/.test(ep1.ep.trim()), ep1);
await ev("document.getElementById('player-video').currentTime=125; 1");
await sleep(3500);
await key(10009); await sleep(800);
const btn2 = await ev("document.querySelector('[data-act=detail-play]').textContent");
ok("dopo l'uscita: Riprendi Ep. 1 · 2:0x", /^Riprendi Ep\. 1  ·  2:\d\d$/.test(btn2), btn2);
// L'elenco parte dall'alto (ultimo uscito): si scende fino all'Ep. 1, in fondo, come col telecomando.
await ev("(()=>{const h=document.querySelector('[data-mount=episodes]'); h._grid.jump(h._grid.length-1); return 1})()"); await sleep(300);
const row1 = await ev("(()=>{const r=[...document.querySelectorAll('[data-mount=episodes] .vrow')].find(r=>r.classList.contains('is-resume')); return r? r.innerText.replace(/\\n/g,' | '):null})()");
ok("lista: episodio segnato 'Riprendi da'", row1 && /Riprendi da 2:\d\d/.test(row1), row1);
await click('[data-act=detail-play]');
await waitFor("(()=>{const v=document.getElementById('player-video'); return v && v.readyState>=2 && v.currentTime>100})()", 60000);
const resumedAt = await ev("Math.round(document.getElementById('player-video').currentTime)");
ok("ripresa alla posizione salvata", resumedAt >= 120 && resumedAt < 160, resumedAt);
await ev("(()=>{const v=document.getElementById('player-video'); v.currentTime=v.duration*0.95; return 1})()");
await sleep(3500);
await key(10009); await sleep(800);
const btn3 = await ev("document.querySelector('[data-act=detail-play]').textContent");
ok("guardato oltre il 90% → Continua Ep. 2", /^Continua Ep\. 2$/.test(btn3), btn3);
await ev("(()=>{const h=document.querySelector('[data-mount=episodes]'); h._grid.jump(h._grid.length-1); return 1})()"); await sleep(300);
const watchedRows = await ev("[...document.querySelectorAll('[data-mount=episodes] .vrow.is-watched')].map(r=>r.innerText.replace(/\\n/g,' | '))");
ok("lista: Ep. 1 segnato come visto", watchedRows.length === 1 && /✓/.test(watchedRows[0]) && /Visto/.test(watchedRows[0]), watchedRows);
// pulizia progressi e cronologia del test
await ev("Mly.memory.history=[]; Mly.db.saveHistory(); Mly.memory.progress={}; Mly.db.saveProgress(); 1");

// 6) Ripartenza: torna nascosto
await send("Page.reload", {}); await sleep(3000);
await waitFor("window.Mly && Mly.ui && document.querySelector('.rail-btn')");
await sleep(800);
ok("dopo il riavvio la modalità è nascosta", await ev("Mly.ui.isAdult()") === false);
await ev("Mly.ui.selectTab('browse', true); 1"); await sleep(400);
ok("dopo il riavvio Sorgenti senza PMVHaven", !/PMVHaven/.test(await ev("document.getElementById('stage').innerText")));

console.log(results.join("\n"));
console.log("--- errori console ---\n" + logs.join("\n"));
process.exit(0);
