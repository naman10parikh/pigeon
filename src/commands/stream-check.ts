/**
 * `pigeon stream-check <tag> <provider>` — the ALLOW / HARD-REFUSE truth table (O-02 / SCN-05 /
 * PIT-02). Routing a cold/marketing-tagged message through a transactional-only provider is
 * account-death; pigeon REFUSES it (exit non-zero). This is a guardrail, not a knob.
 */
import type { Command } from "commander";
import { checkStream } from "../lib/stream-policy.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface StreamCheckOptions {
  json?: boolean;
}

/** The reusable lib entrypoint (CLI + MCP + the send path + the hook all share checkStream). */
export function runStreamCheck(tag: string, provider: string): VerbResult {
  const start = Date.now();
  // parseStream throws on an unknown stream — convert to a clean refusal, not a crash.
  let decision;
  try {
    decision = checkStream(tag, provider);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const res = fail({ allowed: false, error: msg }, [`stream-check: ${msg}`]);
    logRun({ verb: "stream-check", outcome: "fail", ms: Date.now() - start, note: msg });
    return res;
  }
  const lines = [
    `${decision.allowed ? "ALLOW" : "REFUSE"}: ${decision.stream} → ${decision.provider}`,
    decision.reason,
    `ref: ${decision.ref}`,
  ];
  const res = decision.allowed ? ok({ ...decision }, lines) : fail({ ...decision }, lines);
  logRun({
    verb: "stream-check",
    outcome: decision.allowed ? "ok" : "refused",
    ms: Date.now() - start,
    meta: { stream: decision.stream, provider: decision.provider, allowed: decision.allowed },
  });
  return res;
}

export function registerStreamCheck(program: Command): void {
  program
    .command("stream-check")
    .description("transactional|marketing|cold × provider → ALLOW or HARD-REFUSE (O-02 guardrail)")
    .argument("<tag>", "the message stream: transactional | marketing | cold")
    .argument("<provider>", "the target provider: resend | postmark | sendgrid | ses | ...")
    .option("--json", "emit the structured decision")
    .action((tag: string, provider: string, opts: StreamCheckOptions) => {
      const res = runStreamCheck(tag, provider);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
