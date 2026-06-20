/**
 * `pigeon unsubscribe gen [--stream marketing]` — emit an RFC-8058 one-click unsubscribe config:
 * POST-only endpoint, opaque (Sqids/HMAC) IDs, DKIM h= coverage list (O-05/O-06, SCN-13, PIT-06).
 * HARD-REFUSES --stream transactional (one-click is marketing-ONLY; O-06).
 */
import type { Command } from "commander";
import { signUnsubToken } from "../lib/opaque-id.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface UnsubOptions {
  stream?: string;
  json?: boolean;
}

export function runUnsubscribeGen(opts: UnsubOptions): VerbResult {
  const start = Date.now();
  const stream = (opts.stream ?? "marketing").toLowerCase();

  if (stream === "transactional") {
    const res = fail(
      { allowed: false, reason: "one-click unsubscribe is for MARKETING mail only (O-06)" },
      [
        "REFUSE: one-click unsubscribe must NEVER be added to transactional mail.",
        "List-Unsubscribe on a password-reset is wrong; the 2024 Gmail/Yahoo rule scopes one-click to marketing only (O-06).",
      ],
    );
    logRun({ verb: "unsubscribe", outcome: "refused", ms: Date.now() - start, note: "transactional stream" });
    return res;
  }

  // A sample opaque token (proves the secret is wired; never a sequential id).
  let sampleToken = "<UNSUBSCRIBE_TOKEN_SECRET not set>";
  let secretWired = false;
  try {
    sampleToken = signUnsubToken(12345, "newsletter");
    secretWired = true;
  } catch {
    // secret missing — the config is still emitted, with a note to set it.
  }

  const config = {
    stream,
    method: "POST", // O-05: GET NEVER unsubscribes
    headers: {
      "List-Unsubscribe": "<https://example.com/u/{opaqueToken}>, <mailto:unsub@example.com?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    endpointContract: {
      route: "POST /u/:opaqueToken",
      getBehavior: "info page only — MUST NOT mutate (PIT-06)",
      idScheme: "Sqids public id + HMAC signature (opaque, enumeration-proof)",
      sampleToken,
    },
    dkimHTags: ["from", "to", "subject", "date", "list-unsubscribe", "list-unsubscribe-post"],
    secretWired,
    rule: "Feb-2024 Gmail/Yahoo one-click requirement; Nov-2025 enforcement escalation",
  };

  const lines = [
    `unsubscribe config (stream: ${stream})`,
    "  method: POST-only (GET never unsubscribes — O-05)",
    "  List-Unsubscribe + List-Unsubscribe-Post headers emitted",
    `  opaque IDs: Sqids + HMAC ${secretWired ? "(secret wired ✓)" : "(set UNSUBSCRIBE_TOKEN_SECRET via `openssl rand -hex 32`)"}`,
    `  DKIM h= MUST cover: ${config.dkimHTags.join(", ")}`,
    `  sample opaque token: ${sampleToken}`,
  ];
  const res = ok({ ...config }, lines);
  logRun({ verb: "unsubscribe", outcome: "ok", ms: Date.now() - start, meta: { stream, secretWired } });
  return res;
}

export function registerUnsubscribe(program: Command): void {
  const cmd = program
    .command("unsubscribe")
    .description("RFC-8058 one-click unsubscribe config (POST-only, opaque IDs, marketing-only) (JTBD-6)");
  cmd
    .command("gen")
    .description("emit the RFC-8058 one-click unsubscribe config")
    .option("--stream <tag>", "stream (marketing only; transactional is REFUSED)", "marketing")
    .option("--json", "emit the structured config")
    .action((opts: UnsubOptions) => {
      const res = runUnsubscribeGen(opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
