/**
 * `pigeon migrate plan <from> <to>` — the safe provider-migration runbook (SCN-08, O-19). Reputation
 * does NOT transfer; export logs BEFORE flipping DNS; warm the new subdomain from zero. The #1
 * migration mistake is blasting on arrival.
 */
import type { Command } from "commander";
import { logRun } from "../lib/log.js";
import { ok, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface MigrateOptions {
  json?: boolean;
}

/** Per-provider log retention windows (the reason export-first matters — O-19 / PIT-10). */
const RETENTION_DAYS: Record<string, string> = {
  resend: "1 (Free) / 3 (Pro) / 7 (Scale)",
  postmark: "45",
  sendgrid: "varies by plan",
  ses: "via your own CloudWatch/SNS sink",
};

export function runMigratePlan(from: string, to: string, opts: MigrateOptions): VerbResult {
  const start = Date.now();
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const steps = [
    `EXPORT logs from ${f} BEFORE flipping DNS — retention is ${RETENTION_DAYS[f] ?? "unknown; assume short"} days; there is no native migration tool (O-19/PIT-10).`,
    `Re-verify the domain (SPF/DKIM/DMARC + alignment) on ${t}'s sending subdomain (\`pigeon verify\`).`,
    `Update DNS — add ${t}'s DKIM CNAME/TXT selector; adjust SPF include: (mind the 10-lookup ceiling, SCN-03).`,
    "Rewrite the integration behind pigeon's provider adapter — ONE file if abstracted, app-wide if not.",
    "Re-test EVERY template on the new provider (rendering differs — see lint / SCN-09/SCN-10).",
    `Warm ${t}'s IP/subdomain from ZERO via the control loop (\`pigeon warmup plan\`) — reputation did NOT transfer (PIT-09).`,
  ];
  const plan = {
    from: f,
    to: t,
    steps,
    logRetentionDays: RETENTION_DAYS[f] ?? "unknown",
    warmupRequired: true,
    budgetHours: "10-20 minimum",
    ref: "SCN-08 / OPINIONS O-19 / PIT-09/PIT-10",
  };
  const lines = [
    `migration runbook: ${f} → ${t}`,
    ...steps.map((s, i) => `  ${i + 1}. ${s}`),
    `  warmup required: yes — never blast on arrival.`,
    `  budget: ${plan.budgetHours}.`,
  ];
  const res = ok({ ...plan }, lines);
  logRun({ verb: "migrate", outcome: "ok", ms: Date.now() - start, meta: { from: f, to: t } });
  return res;
}

export function registerMigrate(program: Command): void {
  const cmd = program
    .command("migrate")
    .description("the safe provider-migration runbook: export-logs-first, re-verify, warm-from-zero (JTBD-8)");
  cmd
    .command("plan")
    .description("emit the migration runbook")
    .argument("<from>", "current provider")
    .argument("<to>", "target provider")
    .option("--json", "emit the structured runbook")
    .action((from: string, to: string, opts: MigrateOptions) => {
      const res = runMigratePlan(from, to, opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
