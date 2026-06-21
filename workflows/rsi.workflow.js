#!/usr/bin/env node
/**
 * pigeon RSI engine (PLAN §11; Darwin DSIP-conformant, level L1).
 *
 * Two halves, by design:
 *   1. DETERMINISTIC ($0, tokenless) — implemented here. Re-runs the golden eval (regression gate),
 *      confirms the dsip spec parses, and appends a run record. This is what CI (.github/workflows/
 *      rsi-reusable.yml) executes nightly. No model, no credits, always reproducible.
 *   2. CLAUDE PROPOSAL (gated) — documented here, fires only when CLAUDE_CODE_OAUTH_TOKEN is present
 *      (chairman checklist D8). It would: read the lowest-scoring golden tasks + brain gaps, draft a
 *      surgical brain/skill patch in an isolated worktree, re-run the deterministic half, and open a PR
 *      with the eval delta as evidence. Tokenless environments skip it cleanly (advisory, exit 0).
 *
 * Run: `node workflows/rsi.workflow.js`  (deterministic half only; the Claude half logs that it is gated).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => console.log(`[rsi] ${m}`);

function deterministicHalf() {
  log("half 1/2 — deterministic ($0):");

  // 1a. dsip spec parses (Darwin conformance ≥ L1)
  const dsipPath = join(root, "dsip.json");
  if (!existsSync(dsipPath)) throw new Error("dsip.json missing — pigeon is not Darwin-conformant");
  const dsip = JSON.parse(readFileSync(dsipPath, "utf8"));
  log(`  dsip.json ok (levelTarget=${dsip.levelTarget ?? dsip.dsip ?? "?"})`);

  // 1b. golden-eval regression gate (the immune system)
  log("  running golden eval (npm run eval)…");
  execFileSync("npm", ["run", "eval"], { cwd: root, stdio: "inherit" });
  log("  eval passed (F1 ≥ 0.80 gate held)");

  // 1c. record the run
  const logsDir = join(root, "logs");
  mkdirSync(logsDir, { recursive: true });
  appendFileSync(join(logsDir, "runs.jsonl"), JSON.stringify({ verb: "rsi", outcome: "ok", ms: 0, model: "deterministic-$0" }) + "\n");
  log("  recorded run → logs/runs.jsonl");
}

function claudeHalf() {
  log("half 2/2 — Claude proposal (gated):");
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    log("  SKIP — CLAUDE_CODE_OAUTH_TOKEN not set (chairman checklist D8). Deterministic half is sufficient for CI.");
    return;
  }
  // Gated path — present so the contract is explicit; the actual proposal/PR loop is intentionally
  // conservative and runs only when a human-supplied token is available.
  log("  token present — would draft a surgical brain/skill patch + open an evidence-backed PR.");
  log("  (proposal loop is opt-in; no autonomous PRs without an explicit dispatch.)");
}

deterministicHalf();
claudeHalf();
log("done.");
