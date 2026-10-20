#!/usr/bin/env node
// pigeon eval L3 — calibrated LLM-judge tier (nightly / PR-advisory, NOT the CI-blocking gate).
// Judges open-ended quality (e.g. GT-09 SES production-access narrative) the deterministic L1/L2
// tiers can't: binary verdict (good-enough yes/no), targeting Cohen's kappa >= 0.6 vs a human label.
//
// CRED-GATED: needs a funded ANTHROPIC_API_KEY (the metered key, currently $0 — see energy
// chairman/CHAIRMAN-CHECKLIST.md "CP123 / C2 — credits at $0"). When unfunded it exits 0 with a
// SKIP (advisory tier, never blocks merge) so `npm run eval` (L1/L2) stays the gate.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const key = process.env.ANTHROPIC_API_KEY;

if (!key) {
  console.log("L3 judge SKIP — no ANTHROPIC_API_KEY (advisory tier, non-blocking). Set a funded key to run.");
  process.exit(0);
}

// The Messages API needs a model name and pigeon never picks one (a fixed ID goes stale): the person names it.
const model = process.env.PIGEON_JUDGE_MODEL?.trim();
if (!model) {
  console.log("L3 judge SKIP: no PIGEON_JUDGE_MODEL (advisory tier, non-blocking). Name the judge model to run.");
  process.exit(0);
}

// Generate the artifact under judgement: the SES production-access narrative (GT-09).
let narrative = "";
try {
  narrative = execFileSync("node", [join(root, "dist", "cli.js"), "ses-narrative"], { cwd: root, encoding: "utf8" });
} catch (e) {
  console.error("could not produce ses-narrative:", e.message);
  process.exit(0); // advisory — don't fail the build on a generation hiccup
}

const rubric = `You are grading an AWS SES production-access request narrative written by an email
deliverability employee. Answer ONLY with a JSON object {"good": true|false, "why": "<one line>"}.
"good" is true iff the narrative concretely describes: (1) how bounces are handled, (2) how
complaints are handled, (3) how unsubscribes/suppression work, and (4) the type/cadence of mail —
i.e. it would plausibly pass a human SES reviewer. Narrative:\n\n${narrative.slice(0, 6000)}`;

const body = {
  model,
  max_tokens: 200,
  messages: [{ role: "user", content: rubric }],
};

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.log(`L3 judge SKIP — API ${res.status} (advisory, non-blocking):`, (await res.text()).slice(0, 200));
  process.exit(0);
}
const data = await res.json();
const text = data?.content?.[0]?.text ?? "";
let verdict;
try { verdict = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
catch { console.log("L3 judge: unparseable verdict (advisory):", text.slice(0, 120)); process.exit(0); }
console.log(`L3 judge GT-09 (SES narrative): good=${verdict.good} — ${verdict.why}`);
process.exit(0); // advisory tier: report, never block
