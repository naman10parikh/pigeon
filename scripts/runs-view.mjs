#!/usr/bin/env node
/**
 * pigeon observability — aggregate view over the append-only audit trail (logs/runs.jsonl).
 * Prints a per-verb count + outcome breakdown + the last N lines. Read-only; never mutates.
 *
 * Usage: node scripts/runs-view.mjs [--tail N] [--json]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOG = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "logs",
  "runs.jsonl",
);

const a = process.argv.slice(2);
const get = (k, d) => {
  const i = a.indexOf(k);
  return i >= 0 && a[i + 1] ? a[i + 1] : d;
};
const tail = Number(get("--tail", "10")) || 10;
const asJson = a.includes("--json");

let lines = [];
try {
  lines = readFileSync(LOG, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
} catch {
  console.log("[obs] no runs.jsonl yet — run a pigeon verb first.");
  process.exit(0);
}

const recs = [];
for (const l of lines) {
  try {
    recs.push(JSON.parse(l));
  } catch {
    // skip a corrupt line rather than crash the aggregator
  }
}

// Aggregate: per-verb count + outcome breakdown.
const byVerb = {};
for (const r of recs) {
  const v = r.verb || "unknown";
  byVerb[v] = byVerb[v] || { total: 0, outcomes: {} };
  byVerb[v].total += 1;
  const o = r.outcome || "ok";
  byVerb[v].outcomes[o] = (byVerb[v].outcomes[o] || 0) + 1;
}

if (asJson) {
  console.log(JSON.stringify({ total: recs.length, byVerb }, null, 2));
  process.exit(0);
}

console.log(`pigeon runs — ${recs.length} total\n`);
console.log("verb               total   outcomes");
console.log("----               -----   --------");
for (const [v, s] of Object.entries(byVerb).sort()) {
  const oc = Object.entries(s.outcomes)
    .map(([k, n]) => `${k}:${n}`)
    .join(" ");
  console.log(`${v.padEnd(18)} ${String(s.total).padStart(5)}   ${oc}`);
}
console.log(`\nlast ${Math.min(tail, recs.length)}:`);
for (const r of recs.slice(-tail)) {
  console.log(
    `  ${r.ts}  ${(r.verb || "?").padEnd(14)} ${(r.outcome || "?").padEnd(8)} ${r.ms || 0}ms`,
  );
}
