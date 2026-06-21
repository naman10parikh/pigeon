#!/usr/bin/env node
// pigeon eval — L1 (deterministic, $0) + L2 (binary grade, F1) over eval/golden/*.json.
// Runs the BUILT CLI against each golden task and asserts. CI-blocking: exit 1 on any fail.
// L3 (calibrated LLM judge) lives in eval/judge.mjs and is cred-gated / nightly (not run here).
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const goldenDir = join(root, "eval", "golden");
const cli = join(root, "dist", "cli.js");

const tasks = readdirSync(goldenDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(goldenDir, f), "utf8")));

function run(argv) {
  try {
    return { out: execFileSync("node", [cli, ...argv], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), rc: 0 };
  } catch (e) {
    // non-zero exit still carries stdout (e.g. a verify that reports not-ready)
    return { out: `${e.stdout || ""}${e.stderr || ""}`, rc: e.status ?? 1 };
  }
}

function grade(task) {
  const { out } = run(task.argv);
  const e = task.expect || {};
  if (e.stdout && !out.includes(e.stdout)) return { pass: false, why: `stdout lacked "${e.stdout}"` };
  if (e.json) {
    let parsed;
    try { parsed = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)); }
    catch { return { pass: false, why: "stdout not parseable JSON" }; }
    for (const [k, v] of Object.entries(e.json))
      if (parsed[k] !== v) return { pass: false, why: `json.${k}=${JSON.stringify(parsed[k])} ≠ ${JSON.stringify(v)}` };
  }
  return { pass: true, why: "ok" };
}

let pass = 0;
const fails = [];
console.log(`pigeon eval — ${tasks.length} golden tasks (L1 deterministic + L2 binary grade)\n`);
for (const t of tasks) {
  const r = grade(t);
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${t.id} (${t.scn}) — ${t.symptom.slice(0, 70)}${r.pass ? "" : "  <-- " + r.why}`);
  if (r.pass) pass++; else fails.push(t.id);
}
// L2: binary single-class F1 (precision = recall = pass/total when all predictions are "pass")
const f1 = tasks.length ? pass / tasks.length : 0;
console.log(`\nCI-blocking (L1/L2): ${pass} pass / ${tasks.length - pass} fail  (F1=${f1.toFixed(2)}, floor 0.80)`);
console.log("L3 (LLM judge, GT-SES narrative): nightly / cred-gated — see eval/judge.mjs");
if (pass !== tasks.length || f1 < 0.8) { console.error(`\nFAIL: ${fails.join(", ")}`); process.exit(1); }
process.exit(0);
