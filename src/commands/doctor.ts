/**
 * `pigeon doctor` — SDK/runtime health (JTBD-10, O-12). Asserts the email SDK + render libs are
 * PINNED (exact, not ^), that @react-email/render is present (PIT-14), and reports whether the
 * Resend key is set. Pinning is the discipline that makes the next regression a one-file change.
 * Exits 0 iff the pins are correct.
 */
import type { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface DoctorOptions {
  json?: boolean;
}

/** The deploy-risk deps that MUST be exact-pinned (no ^/~) per O-12 / PIT-03 / PIT-14 / PIT-18. */
const MUST_PIN = ["resend", "@react-email/render", "@react-email/components"];

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export function runDoctor(opts: DoctorOptions): VerbResult {
  const start = Date.now();
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "..", "package.json");

  const checks: Check[] = [];
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    deps = pkg.dependencies ?? {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const res = fail({ healthy: false, error: msg }, [`doctor: cannot read package.json — ${msg}`]);
    logRun({ verb: "doctor", outcome: "fail", ms: Date.now() - start, note: msg });
    return res;
  }

  for (const dep of MUST_PIN) {
    const v = deps[dep];
    if (!v) {
      checks.push({ name: dep, ok: false, detail: "MISSING — must be an explicit, pinned dependency (PIT-14)" });
      continue;
    }
    const exact = /^\d+\.\d+\.\d+/.test(v); // no leading ^ / ~ / range
    checks.push({
      name: dep,
      ok: exact,
      detail: exact ? `pinned ${v} ✓` : `version "${v}" is NOT exact-pinned — bumps are a deploy-risk (O-12)`,
    });
  }

  const keySet = Boolean(process.env.RESEND_API_KEY);
  checks.push({
    name: "RESEND_API_KEY",
    ok: true, // informational, not a pin-failure
    detail: keySet ? "set ✓ (live send half available)" : "not set — live send is on-demand (deterministic gate still runs)",
  });

  checks.push({
    name: "runtime",
    ok: true,
    detail: `node ${process.version} — a CLI (not edge); resend's mailparser dep (PIT-03) is irrelevant here, but stays pinned for discipline`,
  });

  const pinChecks = checks.filter((c) => MUST_PIN.includes(c.name));
  const healthy = pinChecks.every((c) => c.ok);
  const lines = ["pigeon doctor:", ...checks.map((c) => `  [${c.ok ? "ok" : "FAIL"}] ${c.name}: ${c.detail}`)];
  const res = healthy ? ok({ healthy, checks }, lines) : fail({ healthy, checks }, lines);
  logRun({ verb: "doctor", outcome: healthy ? "ok" : "fail", ms: Date.now() - start, meta: { healthy } });
  return res;
}

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("SDK/runtime health: pinned versions, @react-email/render present, key valid (JTBD-10)")
    .option("--json", "emit the structured health report")
    .action((opts: DoctorOptions) => {
      const res = runDoctor(opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
