#!/usr/bin/env node
/**
 * pigeon observability — append-only runtime audit trail → logs/runs.jsonl.
 *
 * Per HARNESS-OVERRIDES §10: sending email is the canonical state-mutating action the
 * checklist requires an append-only audit trail for. Every pigeon verb (especially
 * send-test / notify / suppress) appends ONE JSON line here: { verb, outcome, ms, model, ... }.
 *
 * Reuses energy's CP122-proven log-run.mjs pattern; adapted to pigeon's {verb,outcome} schema.
 * NEVER throws fatally (always exits 0) so it is safe to wire into every verb + lifecycle hooks.
 *
 * Usage: node scripts/log-run.mjs <verb> [--outcome ok|fail|refused|blocked] [--ms N]
 *        [--model M] [--actor X] [--note "..."] [--meta '{"k":"v"}']
 * View with: node scripts/runs-view.mjs
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOG = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "logs",
  "runs.jsonl",
);

try {
  const a = process.argv.slice(2);
  const verb = a[0] && !a[0].startsWith("--") ? a[0] : "run";
  const get = (k, d) => {
    const i = a.indexOf(k);
    return i >= 0 && a[i + 1] ? a[i + 1] : d;
  };
  let meta = {};
  const rawMeta = get("--meta", "");
  if (rawMeta) {
    try {
      meta = JSON.parse(rawMeta);
    } catch {
      meta = { _rawMeta: rawMeta }; // tolerate non-JSON meta rather than drop the line
    }
  }
  const rec = {
    ts: new Date().toISOString(),
    verb,
    outcome: get("--outcome", "ok"),
    ms: Number(get("--ms", "0")) || 0,
    model: get("--model", process.env.ANTHROPIC_MODEL || ""),
    actor: get("--actor", process.env.USER || "pigeon"),
    note: get("--note", ""),
    ...meta,
  };
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(LOG, JSON.stringify(rec) + "\n");
  console.log(`[obs] logged ${rec.verb} (${rec.outcome}) @ ${rec.ts}`);
} catch (e) {
  console.warn(`[obs] log-run skipped: ${e?.message || e}`); // never fatal
}
process.exit(0);
