import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../site/", import.meta.url).pathname;
const port = Number(process.env.SITE_PORT ?? 4173);
const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json" };
http.createServer(async (req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url ?? "/", `http://${req.headers.host}`).pathname);
  const candidate = normalize(join(root, pathname === "/" ? "index.html" : pathname));
  if (!candidate.startsWith(root)) { res.writeHead(403).end("Forbidden"); return; }
  try {
    const info = await stat(candidate);
    const file = info.isDirectory() ? join(candidate,"index.html") : candidate;
    res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404; res.setHeader("content-type","text/html; charset=utf-8"); res.end(await readFile(join(root,"404.html")));
  }
}).listen(port,"127.0.0.1",()=>console.log(`WEBCHECK static site: http://127.0.0.1:${port}`));
