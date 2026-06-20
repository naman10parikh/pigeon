/**
 * In-process audit logger for pigeon verbs (the TypeScript companion to scripts/log-run.mjs).
 *
 * Per HARNESS-OVERRIDES §10 (Observability): every verb — especially the state-mutating
 * send-test / notify / suppress — appends ONE append-only line to logs/runs.jsonl:
 *   { ts, verb, outcome, ms, model, ... }
 *
 * Sending email is the canonical state-mutating action; this is its audit trail.
 * Writing NEVER throws (a logging failure must not fail a verb) — it warns and continues.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type RunOutcome = "ok" | "fail" | "refused" | "blocked";

export interface RunRecord {
  verb: string;
  outcome: RunOutcome;
  ms: number;
  /** Free-form metadata (e.g. domain, provider, idempotencyKey) merged into the line. */
  meta?: Record<string, unknown>;
  note?: string;
}

/** Absolute path to the append-only audit trail (logs/runs.jsonl at the repo root). */
export function runsLogPath(): string {
  // src/lib/log.ts -> compiled to dist/lib/log.js; ../../logs reaches the repo root from either.
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "logs", "runs.jsonl");
}

/**
 * Append a single structured run line. Returns true if written, false if it was skipped
 * (logging is best-effort and must never break a verb).
 */
export function logRun(rec: RunRecord): boolean {
  try {
    const line = {
      ts: new Date().toISOString(),
      verb: rec.verb,
      outcome: rec.outcome,
      ms: rec.ms,
      model: process.env.ANTHROPIC_MODEL ?? "",
      actor: process.env.USER ?? "pigeon",
      note: rec.note ?? "",
      ...(rec.meta ?? {}),
    };
    const path = runsLogPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(line) + "\n");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[obs] logRun skipped: ${msg}`); // never fatal
    return false;
  }
}

/**
 * Time a function, log its outcome, and return its result. The standard wrapper a verb uses:
 *   const out = await timed("verify", async () => doVerify(...));
 * On success logs outcome "ok"; on throw logs "fail" and re-throws.
 */
export async function timed<T>(
  verb: string,
  fn: () => Promise<T> | T,
  meta?: Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logRun({ verb, outcome: "ok", ms: Date.now() - start, meta });
    return result;
  } catch (err) {
    logRun({
      verb,
      outcome: "fail",
      ms: Date.now() - start,
      meta,
      note: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
