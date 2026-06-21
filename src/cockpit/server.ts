/**
 * pigeon cockpit (Cluster G / G28) — stdlib HTTP server + vanilla-JS SPA on localhost:7791 (RQ-14).
 * Four views, all REAL data: Brain browser · Run log · Eval scores · Ask-the-employee.
 * Zero-dep (node:http + node:fs + node:child_process). Warm-black Energy design (G29) in styles.css.
 */
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", ".."); // dist/cockpit -> repo root
const pub = join(here, "public"); // dist/cockpit/public (copied at build) OR src fallback
const pubDir = existsSync(pub) ? pub : join(root, "src", "cockpit", "public");

const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

function send(res: import("node:http").ServerResponse, code: number, body: string | Buffer, ctype = "application/json") {
  res.writeHead(code, { "content-type": ctype, "cache-control": "no-store" });
  res.end(body);
}

function tailRuns(n = 50): unknown[] {
  const f = join(root, "logs", "runs.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").trim().split("\n").filter(Boolean).slice(-n).map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
}

function brainFiles(): { name: string; content: string }[] {
  const d = join(root, "brain");
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".md")).sort().map((name) => ({ name, content: readFileSync(join(d, name), "utf8") }));
}

function goldenTasks(): unknown[] {
  const d = join(root, "eval", "golden");
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".json")).sort().map((f) => { try { return JSON.parse(readFileSync(join(d, f), "utf8")); } catch { return { id: f }; } });
}

export function startCockpit(port = 7791): import("node:http").Server {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const path = url.pathname;

    if (path === "/api/runs") return send(res, 200, JSON.stringify(tailRuns()));
    if (path === "/api/brain") return send(res, 200, JSON.stringify(brainFiles()));
    if (path === "/api/evals") return send(res, 200, JSON.stringify(goldenTasks()));
    if (path === "/api/ask" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        let symptom = "";
        try { symptom = JSON.parse(body || "{}").symptom || ""; } catch { /* ignore */ }
        if (!symptom) return send(res, 400, JSON.stringify({ error: "symptom required" }));
        execFile("node", [join(root, "dist", "cli.js"), "ask", symptom], { cwd: root, timeout: 15000 }, (err, stdout) => {
          send(res, 200, JSON.stringify({ answer: stdout || (err ? String(err.message) : "(no output)") }));
        });
      });
      return;
    }

    // static
    const rel = path === "/" ? "index.html" : path.replace(/^\/+/, "");
    const file = join(pubDir, rel);
    if (!file.startsWith(pubDir) || !existsSync(file)) return send(res, 404, "not found", "text/plain");
    const ext = rel.slice(rel.lastIndexOf("."));
    send(res, 200, readFileSync(file), types[ext] || "application/octet-stream");
  });
  server.listen(port, "127.0.0.1", () => console.log(`pigeon cockpit → http://localhost:${port}`));
  return server;
}
