/**
 * `pigeon inbound setup [--provider cloudflare]` — emit the Cloudflare Email Routing → webhook →
 * gateway config + runbook (JTBD-9, O-23). This is the G-09 corpus-gap closer: scoped as a
 * GENERATOR + documented runbook (the live round-trip is an honest RSI/Wave-T stretch — PLAN §13
 * risk 2), so this cell may land 🟡 (config present, live round-trip pending) — which is honest.
 *
 * Outbound = Resend (mature); inbound = Cloudflare Email Routing (mature, free). Do NOT use
 * Cloudflare's OUTBOUND send (private beta, no SPF-flattening — O-23).
 */
import type { Command } from "commander";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface InboundOptions {
  provider?: string;
  domain?: string;
  json?: boolean;
}

export function runInboundSetup(opts: InboundOptions): VerbResult {
  const start = Date.now();
  const provider = (opts.provider ?? "cloudflare").toLowerCase();
  const domain = opts.domain ?? "<your-inbound-domain>";

  if (provider !== "cloudflare") {
    const res = fail(
      { error: `inbound provider "${provider}" not supported; default is cloudflare (O-23)` },
      [`inbound setup: only cloudflare is wired (Resend inbound is the documented alt) — O-23`],
    );
    logRun({ verb: "inbound", outcome: "fail", ms: Date.now() - start, note: `unsupported ${provider}` });
    return res;
  }

  const config = {
    provider,
    domain,
    status: "config-only (live round-trip pending — honest 🟡 per the G-09 corpus gap)",
    dnsRecords: [
      { type: "MX", name: domain, value: "route1.mx.cloudflare.net", priority: 53 },
      { type: "MX", name: domain, value: "route2.mx.cloudflare.net", priority: 79 },
      { type: "MX", name: domain, value: "route3.mx.cloudflare.net", priority: 96 },
      { type: "TXT", name: domain, value: "v=spf1 include:_spf.mx.cloudflare.net ~all" },
    ],
    routingRule: {
      matcher: `*@${domain}`,
      action: "send to a Cloudflare Email Worker → POST the parsed message to your gateway webhook",
    },
    webhookContract: {
      route: "POST /inbound/cloudflare",
      body: { from: "string", to: "string", subject: "string", text: "string", html: "string?", headers: "object" },
      perTenant: "route by the `to` localpart/subdomain to the owning tenant (per-tenant identity — O-15)",
    },
    caveats: [
      "Cloudflare Email Routing is FORWARDING/receiving only — do NOT use CF outbound send (private beta, no SPF-flattening) (O-23).",
      "The live inbound round-trip (a real reply parsed end-to-end) is a Wave-T / RSI stretch — this verb emits the config + runbook, not a live receive.",
    ],
    ref: "JTBD-9 / OPINIONS O-23 / field-06 §B",
  };

  const lines = [
    `inbound setup via Cloudflare Email Routing for ${domain}`,
    "  DNS to add:",
    ...config.dnsRecords.map((r) =>
      r.type === "MX"
        ? `    MX  ${r.name}  ${r.priority}  ${r.value}`
        : `    TXT ${r.name}  ${r.value}`,
    ),
    `  routing: ${config.routingRule.matcher} → Email Worker → POST ${config.webhookContract.route}`,
    "  caveats:",
    ...config.caveats.map((c) => `    - ${c}`),
  ];
  const res = ok({ ...config }, lines);
  logRun({ verb: "inbound", outcome: "ok", ms: Date.now() - start, meta: { provider, domain } });
  return res;
}

export function registerInbound(program: Command): void {
  const cmd = program
    .command("inbound")
    .description("Cloudflare Email Routing → webhook → gateway (JTBD-9, the G-09 gap-closer)");
  cmd
    .command("setup")
    .description("emit the inbound config + runbook")
    .option("--provider <name>", "inbound provider (default: cloudflare)", "cloudflare")
    .option("--domain <d>", "the inbound domain")
    .option("--json", "emit the structured config")
    .action((opts: InboundOptions) => {
      const res = runInboundSetup(opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
