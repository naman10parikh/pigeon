/**
 * `pigeon lint <template-path|->` — static-analyze email HTML / React-Email source for the
 * detectable cross-client rendering hazards (PIT-16..20 / SCN-09 / SCN-10). Rendering correctness
 * IS a deliverability input (O-03). Reads from a path or stdin (`-`). Exits non-zero iff a
 * blocking (error-severity) hazard is found.
 */
import type { Command } from "commander";
import { readFileSync } from "node:fs";
import { lintHtml, hasBlockingHazard } from "../lib/render-hazards.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface LintOptions {
  json?: boolean;
}

/** Read all of stdin synchronously (for the `lint -` pipe form). */
function readStdin(): string {
  try {
    return readFileSync(0, "utf8"); // fd 0 = stdin
  } catch {
    return "";
  }
}

/** The reusable lib entrypoint (CLI + MCP). `source` is the HTML/JSX string to lint. */
export function lintSource(source: string): VerbResult {
  const start = Date.now();
  const hazards = lintHtml(source);
  const blocking = hasBlockingHazard(hazards);
  const lines: string[] =
    hazards.length === 0
      ? ["lint: no detectable hazards (note: NOT a 100% client-coverage guarantee — O-03)"]
      : hazards.map(
          (h) => `  [${h.severity}/${h.client}] ${h.rule} — ${h.message}\n      fix: ${h.fix}  (${h.ref})`,
        );
  const data = { hazards, blocking, count: hazards.length };
  const res = blocking ? fail(data, lines) : ok(data, lines);
  logRun({
    verb: "lint",
    outcome: blocking ? "fail" : "ok",
    ms: Date.now() - start,
    meta: { hazards: hazards.length, blocking },
  });
  return res;
}

export function registerLint(program: Command): void {
  program
    .command("lint")
    .description("static-analyze email HTML for Gmail/Outlook/Preview/Tailwind hazards (JTBD-3)")
    .argument("<template>", "path to an email HTML/JSX file, or '-' to read from stdin")
    .option("--json", "emit the structured hazard list")
    .action((template: string, opts: LintOptions) => {
      const source = template === "-" ? readStdin() : readFileSync(template, "utf8");
      const res = lintSource(source);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
