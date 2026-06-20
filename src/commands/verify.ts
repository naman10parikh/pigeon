/**
 * `pigeon verify <domain>` — dig SPF/DKIM/DMARC out-of-band AND check DMARC ALIGNMENT (O-11/O-10,
 * SCN-02). Exits 0 iff SPF+DKIM+DMARC present AND aligned. Supports --dns-fixture for the
 * reproducible $0 CI merge-gate (PLAN §5 / RQ-1). This is the readiness half of THE acceptance test.
 */
import type { Command } from "commander";
import {
  bundleFromFixture,
  loadDnsFixture,
  resolveLive,
  type DnsBundle,
} from "../lib/dns.js";
import { hintsFromFixture, judgeReadiness } from "../lib/alignment.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface VerifyOptions {
  dnsFixture?: string;
  from?: string;
  json?: boolean;
}

/** The reusable lib entrypoint (CLI + MCP both call this). */
export async function runVerify(
  domainArg: string | undefined,
  opts: VerifyOptions,
): Promise<VerbResult> {
  const start = Date.now();
  let bundle: DnsBundle;
  let hints: { fromDomain?: string; signingDomain?: string; envelopeFrom?: string } = {};

  if (opts.dnsFixture) {
    const fx = loadDnsFixture(opts.dnsFixture);
    bundle = bundleFromFixture(fx);
    hints = { ...hintsFromFixture(fx) };
  } else {
    if (!domainArg) {
      const res = fail(
        { error: "no domain given and no --dns-fixture provided" },
        ["pigeon verify: provide a <domain> or --dns-fixture <path>"],
      );
      logRun({ verb: "verify", outcome: "fail", ms: Date.now() - start, note: "no input" });
      return res;
    }
    bundle = await resolveLive(domainArg);
  }
  if (opts.from) hints.fromDomain = opts.from;

  const readiness = judgeReadiness(bundle, hints);
  const lines: string[] = [
    `domain:  ${readiness.domain}`,
    `spf:     ${readiness.spf ? "present" : "MISSING"}`,
    `dkim:    ${readiness.dkim ? "present" : "MISSING"}`,
    `dmarc:   ${readiness.dmarc ? "present" : "MISSING"}`,
    `aligned: ${readiness.aligned ? "yes" : "NO"}`,
    `ready:   ${readiness.ready}`,
    "",
    "findings:",
  ];
  for (const f of readiness.findings) {
    lines.push(`  [${f.severity}] ${f.code} — ${f.message}  (${f.ref})`);
  }

  const res = readiness.ready ? ok({ ...readiness }, lines) : fail({ ...readiness }, lines);
  logRun({
    verb: "verify",
    outcome: readiness.ready ? "ok" : "fail",
    ms: Date.now() - start,
    meta: {
      domain: readiness.domain,
      ready: readiness.ready,
      aligned: readiness.aligned,
      source: opts.dnsFixture ? "fixture" : "live",
    },
  });
  return res;
}

export function registerVerify(program: Command): void {
  program
    .command("verify")
    .description("dig SPF/DKIM/DMARC + ALIGNMENT out-of-band; never trust a provider's verified flag (O-11, JTBD-1)")
    .argument("[domain]", "the sending domain to verify (omit when using --dns-fixture)")
    .option("--dns-fixture <path>", "verify against a vendored DNS fixture (reproducible $0 CI gate)")
    .option("--from <domain>", "the visible From: domain to check alignment against (defaults to <domain>)")
    .option("--json", "emit the structured readiness JSON")
    .action(async (domain: string | undefined, opts: VerifyOptions) => {
      const res = await runVerify(domain, opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
