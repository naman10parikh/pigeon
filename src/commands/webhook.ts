/**
 * `pigeon webhook verify <provider> <payload>` — validate a bounce/complaint webhook signature,
 * then suppress the affected address (JTBD-4). Consume → suppress → never re-send (PIT-05). CI uses
 * a fixture payload + fixture signing secret (no live account needed — PLAN §8 S-WEBHOOK).
 *
 * Signature scheme (Resend/Svix-style): HMAC-SHA256 over the raw payload, base64. The secret comes
 * from <PROVIDER>_WEBHOOK_SIGNING_SECRET (or --secret for the fixture path).
 */
import type { Command } from "commander";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { suppressAdd } from "../lib/suppression.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface WebhookOptions {
  signature?: string;
  secret?: string;
  json?: boolean;
}

/** Compute the expected signature for a raw payload + secret (Resend/Svix-style HMAC base64). */
export function computeSignature(rawPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(rawPayload).digest("base64");
}

/** Extract the bounced/complained address + event type from a bounce/complaint payload. */
function extractEvent(payload: unknown): { type: string; address: string | null } {
  if (typeof payload !== "object" || payload === null) return { type: "unknown", address: null };
  const p = payload as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : "unknown";
  // Resend shape: { type, data: { to: [...] | "addr", email } }
  const data = (p.data ?? {}) as Record<string, unknown>;
  let address: string | null = null;
  if (typeof data.email === "string") address = data.email;
  else if (typeof data.to === "string") address = data.to;
  else if (Array.isArray(data.to) && typeof data.to[0] === "string") address = data.to[0];
  return { type, address };
}

export function runWebhookVerify(
  provider: string,
  payloadArg: string,
  opts: WebhookOptions,
): VerbResult {
  const start = Date.now();
  // payloadArg may be a path or inline JSON.
  let raw: string;
  try {
    raw = payloadArg.trim().startsWith("{") ? payloadArg : readFileSync(payloadArg, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const res = fail({ valid: false, error: msg }, [`webhook verify: cannot read payload — ${msg}`]);
    logRun({ verb: "webhook", outcome: "fail", ms: Date.now() - start, note: msg });
    return res;
  }

  const secret =
    opts.secret ??
    process.env[`${provider.toUpperCase()}_WEBHOOK_SIGNING_SECRET`] ??
    process.env.RESEND_WEBHOOK_SIGNING_SECRET ??
    "";
  if (!secret) {
    const res = fail({ valid: false, error: "no signing secret" }, [
      `webhook verify: no signing secret (set ${provider.toUpperCase()}_WEBHOOK_SIGNING_SECRET or pass --secret)`,
    ]);
    logRun({ verb: "webhook", outcome: "fail", ms: Date.now() - start, note: "no secret" });
    return res;
  }

  const expected = computeSignature(raw, secret);
  const provided = opts.signature ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const valid = a.length === b.length && timingSafeEqual(a, b);

  if (!valid) {
    const res = fail({ valid: false, action: "rejected" }, [
      "webhook verify: signature INVALID — payload rejected (possible forgery).",
    ]);
    logRun({ verb: "webhook", outcome: "fail", ms: Date.now() - start, meta: { provider, valid } });
    return res;
  }

  // Valid → on a bounce/complaint, suppress the address (consume → suppress, PIT-05).
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const event = extractEvent(parsed);
  let action = "verified";
  if (
    event.address &&
    (event.type.includes("bounce") || event.type.includes("complaint") || event.type.includes("complained"))
  ) {
    const reason = event.type.includes("complaint") || event.type.includes("complained") ? "complaint" : "hard-bounce";
    suppressAdd(event.address, reason);
    action = `suppressed ${event.address} (${reason})`;
  }

  const res = ok({ valid: true, action, event }, [
    "webhook verify: signature VALID.",
    `  event: ${event.type}`,
    `  action: ${action}`,
  ]);
  logRun({ verb: "webhook", outcome: "ok", ms: Date.now() - start, meta: { provider, type: event.type } });
  return res;
}

export function registerWebhook(program: Command): void {
  program
    .command("webhook")
    .description("validate a bounce/complaint webhook signature → suppress (JTBD-4)")
    .argument("<op>", "verify")
    .argument("<provider>", "the provider (resend | ...)")
    .argument("<payload>", "path to the webhook payload JSON, or inline JSON")
    .option("--signature <sig>", "the provided signature header to verify")
    .option("--secret <secret>", "the signing secret (fixture path; else read from env)")
    .option("--json", "emit the structured result")
    .action((op: string, provider: string, payload: string, opts: WebhookOptions) => {
      if (op !== "verify") {
        console.error(`webhook: unknown op "${op}" — use verify`);
        process.exitCode = 1;
        return;
      }
      const res = runWebhookVerify(provider, payload, opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
