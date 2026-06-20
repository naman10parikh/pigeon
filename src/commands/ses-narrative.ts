/**
 * `pigeon ses-narrative [--domain <d>]` — author the SES production-access narrative from the
 * handling pigeon implements (SCN-15, O-17/O-25). The narrative IS the product; auth FIRST. Denials
 * are quality-of-narrative failures, not technical ones — so pigeon writes the concrete answers.
 */
import type { Command } from "commander";
import { logRun } from "../lib/log.js";
import { ok, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface SesNarrativeOptions {
  domain?: string;
  json?: boolean;
}

export function runSesNarrative(opts: SesNarrativeOptions): VerbResult {
  const start = Date.now();
  const domain = opts.domain ?? "<your-sending-domain>";

  const prerequisites = [
    `SPF + DKIM + DMARC published AND aligned for ${domain} (run \`pigeon verify ${domain}\` — O-25)`,
    "A professional landing page + a privacy policy (AWS inspects your site)",
    "A real bounce/complaint handler in place (consume webhook → suppress → never re-send)",
  ];

  const narrative = {
    businessAndUse:
      `We send TRANSACTIONAL email (account verification, password resets, receipts) for ${domain}. ` +
      "These are user-triggered, one-to-one messages — not marketing campaigns.",
    addressCollection:
      "Recipients are our own registered users; addresses are collected at sign-up with explicit consent and double opt-in confirmation. We never send to purchased or scraped lists.",
    subscribeUnsubscribe:
      "Transactional mail is exempt from one-click unsubscribe (it's not promotional). For any promotional stream we run a SEPARATE domain with RFC-8058 POST-only one-click unsubscribe (opaque IDs, DKIM-covered headers).",
    bounceComplaintHandling:
      "We consume SES bounce + complaint notifications via SNS, immediately add hard bounces and complaints to a suppression list, and NEVER re-send to a suppressed address. We auto-pause sending if bounce >5% or complaint >0.1%, and we monitor the SES reputation dashboard. (This is the answer reviewers most often reject as vague — ours is concrete because pigeon implements it.)",
  };

  const lines = [
    `SES production-access narrative for ${domain}`,
    "",
    "PREREQUISITES (auth + site BEFORE you ask — O-25):",
    ...prerequisites.map((p) => `  - ${p}`),
    "",
    "THE FOUR ANSWERS (specific, not word-salad — O-17):",
    `  1. Business + SES use: ${narrative.businessAndUse}`,
    `  2. How addresses are collected: ${narrative.addressCollection}`,
    `  3. Subscribe/unsubscribe flow: ${narrative.subscribeUnsubscribe}`,
    `  4. Bounce/complaint handling: ${narrative.bounceComplaintHandling}`,
  ];
  const res = ok({ domain, prerequisites, narrative, ref: "SCN-15 / O-17 / O-25 / PIT-13" }, lines);
  logRun({ verb: "ses-narrative", outcome: "ok", ms: Date.now() - start, meta: { domain } });
  return res;
}

export function registerSesNarrative(program: Command): void {
  program
    .command("ses-narrative")
    .description("author the SES production-access narrative from implemented handling (JTBD-7)")
    .option("--domain <d>", "the sending domain")
    .option("--json", "emit the structured narrative")
    .action((opts: SesNarrativeOptions) => {
      const res = runSesNarrative(opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
