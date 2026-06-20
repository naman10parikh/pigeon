/**
 * `pigeon suppress add|check <addr>` — the cross-provider hard-bounce/complaint suppression list
 * (JTBD-4 / PIT-05). Consume bounce/complaint → suppress → NEVER re-send. 0.3% complaint is the
 * Gmail/Yahoo blocklist line.
 */
import type { Command } from "commander";
import { suppressAdd, suppressCheck } from "../lib/suppression.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface SuppressOptions {
  reason?: "hard-bounce" | "complaint" | "manual";
  json?: boolean;
}

export function runSuppress(
  op: string,
  address: string,
  opts: SuppressOptions,
): VerbResult {
  const start = Date.now();
  if (op === "add") {
    const entry = suppressAdd(address, opts.reason ?? "manual");
    const res = ok({ suppressed: true, ...entry }, [
      `suppressed: ${entry.address} (${entry.reason}) — will never be re-sent (PIT-05)`,
    ]);
    logRun({ verb: "suppress", outcome: "ok", ms: Date.now() - start, meta: { op, address: entry.address } });
    return res;
  }
  if (op === "check") {
    const entry = suppressCheck(address);
    const suppressed = entry !== null;
    const res = ok({ suppressed, entry }, [
      suppressed
        ? `SUPPRESSED: ${address} (${entry?.reason}, since ${entry?.at})`
        : `not suppressed: ${address}`,
    ]);
    logRun({ verb: "suppress", outcome: "ok", ms: Date.now() - start, meta: { op, address, suppressed } });
    return res;
  }
  const res = fail({ error: `unknown suppress op "${op}" — use add|check` }, [
    `suppress: unknown op "${op}" — use add|check`,
  ]);
  logRun({ verb: "suppress", outcome: "fail", ms: Date.now() - start, note: `bad op ${op}` });
  return res;
}

export function registerSuppress(program: Command): void {
  program
    .command("suppress")
    .description("cross-provider hard-bounce/complaint suppression list (JTBD-4, PIT-05)")
    .argument("<op>", "add | check")
    .argument("<address>", "the email address")
    .option("--reason <r>", "hard-bounce | complaint | manual (for add)", "manual")
    .option("--json", "emit the structured result")
    .action((op: string, address: string, opts: SuppressOptions) => {
      const res = runSuppress(op, address, opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
