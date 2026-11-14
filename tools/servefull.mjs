import http from "http"; import fs from "fs"; import path from "path";
const APP = "/workspace/mly/full/mangayomi";
const csp = fs.readFileSync(APP + "/config.xml","utf8").match(/<tizen:content-security-policy>([^<]+)</)[1];
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".png":"image/png" };
http.createServer((q, r) => { const f = path.join(APP, decodeURIComponent(q.url.split("?")[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream", "Content-Security-Policy": csp }); fs.createReadStream(f).pipe(r); }).listen(8770);
