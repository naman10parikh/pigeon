/**
 * `pigeon ask "<symptom>"` — the ask-the-employee path. Match a free-text symptom against the 19
 * battle-tested scenarios and return symptom → diagnosis → resolution → prevention with the brain
 * citation (and carried uncertainty where the source is disputed, e.g. SCN-05). This is the
 * human-facing face of the deliverability employee.
 */
import type { Command } from "commander";
import { matchScenario } from "../lib/scenarios.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface AskOptions {
  json?: boolean;
}

export function runAsk(symptom: string): VerbResult {
  const start = Date.now();
  const match = matchScenario(symptom);
  if (!match) {
    const res = fail(
      { matched: false, symptom },
      [
        `No scenario matched "${symptom}".`,
        "Try describing the symptom in more detail (e.g. 'SPF and DKIM pass but DMARC fails', 'whole account suspended after a blast', 'email blank in Gmail').",
      ],
    );
    logRun({ verb: "ask", outcome: "fail", ms: Date.now() - start, note: "no match" });
    return res;
  }

  const s = match.scenario;
  const lines = [
    `matched: ${s.id} — ${s.title}`,
    "",
    `DIAGNOSIS:  ${s.diagnosis}`,
    "",
    `RESOLUTION: ${s.resolution}`,
    "",
    `PREVENTION: ${s.prevention}`,
  ];
  if (s.uncertainty) {
    lines.push("", `UNCERTAINTY: ${s.uncertainty}`);
  }
  lines.push("", `ref: ${s.ref}`);

  const res = ok(
    {
      matched: true,
      scenarioId: s.id,
      title: s.title,
      diagnosis: s.diagnosis,
      resolution: s.resolution,
      prevention: s.prevention,
      uncertainty: s.uncertainty ?? null,
      ref: s.ref,
    },
    lines,
  );
  logRun({ verb: "ask", outcome: "ok", ms: Date.now() - start, meta: { scenarioId: s.id } });
  return res;
}

export function registerAsk(program: Command): void {
  program
    .command("ask")
    .description("diagnose a symptom against the 19 battle-tested scenarios (the ask-the-employee path)")
    .argument("<symptom>", "describe the deliverability symptom in quotes")
    .option("--json", "emit the structured diagnosis")
    .action((symptom: string, opts: AskOptions) => {
      const res = runAsk(symptom);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
