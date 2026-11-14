// Telecomando di rete Samsung (Tizen) per la TV di Adam.
// Uso:
//   node tv-remote.mjs pair                      -> abbina (sulla TV premere "Consenti"), salva il token
//   node tv-remote.mjs key KEY_0 [volte] [ms]    -> invia un tasto (default 1 volta, 250 ms tra le pressioni)
//   node tv-remote.mjs keys KEY_UP,KEY_DOWN [ms] -> sequenza di tasti
//   node tv-remote.mjs launch <appId>            -> avvia un'app (REST, ripiego ed.apps.launch)
//   node tv-remote.mjs status                    -> info della TV (REST)
// Il token resta solo nel file tv-remote-token.txt accanto a questo script e non viene mai stampato.
// Richiede il pacchetto "ws" (npm install ws) nella stessa cartella: il WebSocket integrato di Node
// apriva la connessione ma la TV non mostrava mai la richiesta "Consenti".
import fs from "node:fs";
import { createRequire } from "node:module";
const WS = createRequire(import.meta.url)("ws");
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TV = process.env.TV_IP || "192.168.1.3";
const TOKEN_FILE = path.join(HERE, "tv-remote-token.txt");
const NAME = Buffer.from("GrokBot").toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readToken = () => { try { return fs.readFileSync(TOKEN_FILE, "utf8").trim(); } catch { return ""; } };

function open(timeoutMs) {
  const token = readToken();
  const urls = [
    `wss://${TV}:8002/api/v2/channels/samsung.remote.control?name=${NAME}` + (token ? `&token=${token}` : ""),
    `ws://${TV}:8001/api/v2/channels/samsung.remote.control?name=${NAME}`,
  ];
  return new Promise(async (resolve, reject) => {
    let lastErr = "";
    for (const url of urls) {
      const label = url.startsWith("wss") ? "wss:8002" : "ws:8001";
      try {
        const ws = await new Promise((res, rej) => {
          // la TV usa un certificato autofirmato sulla rete di casa; niente compressione
          const s = new WS(url, { rejectUnauthorized: false, perMessageDeflate: false, handshakeTimeout: 10000 });
          const timer = setTimeout(() => { try { s.close(); } catch {} rej(new Error("tempo scaduto (nessuna risposta o Consenti non premuto)")); }, timeoutMs);
          s.onopen = () => { if (process.env.TV_DEBUG) console.log("[debug]", label, "socket aperto"); };
          s.onclose = (e) => { if (process.env.TV_DEBUG) console.log("[debug]", label, "chiuso", e.code, e.reason || ""); };
          s.onmessage = (e) => {
            let m; try { m = JSON.parse(e.data); } catch { return; }
            if (process.env.TV_DEBUG) console.log("[debug]", label, "evento", m.event, m.data && m.data.token ? "(con token)" : "");
            if (m.event === "ms.channel.connect") {
              clearTimeout(timer);
              const t = m.data && m.data.token;
              if (t && t !== token) { fs.writeFileSync(TOKEN_FILE, String(t), { mode: 0o600 }); console.log("token salvato in", TOKEN_FILE); }
              s.channel = label; res(s);
            } else if (m.event === "ms.channel.unauthorized" || m.event === "ms.channel.timeOut") {
              clearTimeout(timer); try { s.close(); } catch {} rej(new Error(m.event));
            }
          };
          s.onerror = (e) => { clearTimeout(timer); rej(new Error("connessione rifiutata " + ((e && e.message) || ""))); };
        });
        return resolve(ws);
      } catch (e) { lastErr = label + ": " + e.message; console.log("tentativo", lastErr); }
    }
    reject(new Error(lastErr));
  });
}
function sendKey(ws, key) {
  ws.send(JSON.stringify({ method: "ms.remote.control", params: { Cmd: "Click", DataOfCmd: key, Option: "false", TypeOfRemote: "SendRemoteKey" } }));
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "status") {
  const r = await fetch(`http://${TV}:8001/api/v2/`); const j = await r.json();
  console.log(JSON.stringify({ name: j.name, model: j.device && j.device.modelName, os: j.device && j.device.OS, tokenAuth: j.device && j.device.TokenAuthSupport, powerState: j.device && j.device.PowerState, token_su_file: !!readToken() }, null, 1));
} else if (cmd === "pair") {
  const ws = await open(90000); console.log("abbinamento OK via", ws.channel, "| token su file:", !!readToken()); ws.close();
} else if (cmd === "key" || cmd === "keys") {
  const list = cmd === "key" ? Array(Math.max(1, parseInt(b || "1", 10))).fill(a) : String(a).split(",").filter(Boolean);
  const gap = parseInt((cmd === "key" ? c : b) || "250", 10);
  const ws = await open(15000);
  for (const k of list) { sendKey(ws, k); await sleep(gap); }
  await sleep(300); ws.close(); console.log("inviati", list.length, "tasti via", ws.channel, ":", list.join(" "));
} else if (cmd === "launch") {
  let ok = false;
  try { const r = await fetch(`http://${TV}:8001/api/v2/applications/${a}`, { method: "POST" }); ok = r.ok; console.log("REST launch", r.status); } catch (e) { console.log("REST launch errore", e.message); }
  if (!ok) {
    const ws = await open(15000);
    ws.send(JSON.stringify({ method: "ms.channel.emit", params: { event: "ed.apps.launch", to: "host", data: { appId: a, action_type: "DEEP_LINK" } } }));
    await sleep(1500); ws.close(); console.log("ed.apps.launch inviato via", ws.channel);
  }
} else {
  console.log("comandi: pair | key KEY_X [volte] [ms] | keys K1,K2 [ms] | launch <appId> | status");
}
process.exit(0);
