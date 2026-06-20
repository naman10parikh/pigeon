/**
 * `pigeon send-test` — render a React-Email template + send it through the provider adapter in
 * TEST MODE with a default idempotency key (THE bar, half 2 — PLAN §5). Returns { id, accepted,
 * idempotencyKey }. A second identical call with the same key does NOT create a second send
 * (O-13/PIT-15) — the dedup proof is owned here.
 *
 * Render uses @react-email/render (PINNED + explicit — PIT-14). Provider defaults to Resend
 * (O-18); with no RESEND_API_KEY the adapter returns a deterministic stub so the property + the
 * deterministic gate run with zero creds (D15), and the LIVE half is honestly 🔄.
 */
import type { Command } from "commander";
import { render } from "@react-email/render";
import * as React from "react";
import { WelcomeEmail } from "../templates/welcome.js";
import { ResendProvider } from "../lib/providers/resend.js";
import type { OutboundMessage, ProviderAdapter, SendResult } from "../lib/send.js";
import {
  IdempotencyCache,
  deriveIdempotencyKey,
  hashBody,
} from "../lib/idempotency.js";
import { parseStream, checkStream } from "../lib/stream-policy.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface SendTestOptions {
  provider?: string;
  template?: string;
  to?: string;
  testMode?: boolean;
  stream?: string;
  idempotencyKey?: string;
  json?: boolean;
}

/** Map a template name → its rendered HTML + subject. Only `welcome` is shipped (the acceptance template). */
async function renderTemplate(
  name: string,
): Promise<{ html: string; subject: string }> {
  if (name !== "welcome") {
    throw new Error(`unknown template "${name}" — only "welcome" is shipped`);
  }
  // @react-email/render inlines styles automatically (the O-04 discipline made automatic).
  const html = await render(React.createElement(WelcomeEmail, { name: "there" }));
  return { html, subject: "Welcome — your account is ready" };
}

/**
 * The reusable lib entrypoint (CLI + MCP + the chaos test). `deps` lets a test inject a mock
 * provider + a shared cache to assert exactly-once on a repeated key.
 */
export async function runSendTest(
  opts: SendTestOptions,
  deps?: { provider?: ProviderAdapter; cache?: IdempotencyCache<SendResult> },
): Promise<VerbResult> {
  const start = Date.now();
  const providerName = (opts.provider ?? "resend").toLowerCase();
  const templateName = opts.template ?? "welcome";
  const to = opts.to ?? "delivered@resend.dev";
  const stream = parseStream(opts.stream ?? "transactional");

  // Guardrail (O-02): even a test send respects the HARD-REFUSE truth table.
  const gate = checkStream(stream, providerName);
  if (!gate.allowed) {
    const res = fail({ allowed: false, reason: gate.reason }, [
      `send-test REFUSED: ${gate.reason}`,
    ]);
    logRun({ verb: "send-test", outcome: "refused", ms: Date.now() - start, note: gate.reason });
    return res;
  }

  const provider =
    deps?.provider ?? (providerName === "resend" ? new ResendProvider() : new ResendProvider());

  const { html, subject } = await renderTemplate(templateName);
  const msg: OutboundMessage = { to, subject, html, stream };

  const idempotencyKey =
    opts.idempotencyKey ??
    deriveIdempotencyKey({
      provider: providerName,
      to,
      template: templateName,
      subject,
      bodyHash: hashBody(html),
    });

  const cache = deps?.cache ?? new IdempotencyCache<SendResult>();
  const { result, deduped } = await cache.runOnce(idempotencyKey, () =>
    provider.sendTest(msg, idempotencyKey),
  );

  const lines = [
    `provider:       ${result.provider}`,
    `to:             ${to}`,
    `template:       ${templateName}`,
    `id:             ${result.id}`,
    `accepted:       ${result.accepted}`,
    `idempotencyKey: ${result.idempotencyKey}`,
    `testMode:       ${result.testMode}`,
    deduped ? "deduped:        true (idempotency prevented a second send — O-13)" : "deduped:        false",
  ];
  const data = { ...result, deduped };
  const success = result.accepted && result.id.length > 0;
  const res = success ? ok(data, lines) : fail(data, lines);
  logRun({
    verb: "send-test",
    outcome: success ? "ok" : "fail",
    ms: Date.now() - start,
    meta: {
      provider: result.provider,
      id: result.id,
      idempotencyKey: result.idempotencyKey,
      testMode: result.testMode,
      deduped,
    },
  });
  return res;
}

export function registerSendTest(program: Command): void {
  program
    .command("send-test")
    .description("send a React-Email template in provider TEST MODE with an idempotency key (THE bar)")
    .option("--provider <name>", "provider adapter (default: resend)", "resend")
    .option("--template <name>", "template to render + send (default: welcome)", "welcome")
    .option("--to <addr>", "recipient (default: delivered@resend.dev test inbox)", "delivered@resend.dev")
    .option("--stream <tag>", "message stream (default: transactional)", "transactional")
    .option("--test-mode", "send in test mode (reserved test addresses, no real recipient)")
    .option("--idempotency-key <key>", "override the derived idempotency key")
    .option("--json", "emit the structured send result")
    .action(async (opts: SendTestOptions) => {
      const res = await runSendTest(opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
