/**
 * Resend provider adapter (the wired default — O-18). Sits behind the thin send() interface so a
 * provider swap is a one-file change (O-12: the SDK is isolated; the next regression is a one-file
 * pin). PIN: `resend@6.14.0` (exact in package.json) — v6.9.0+ added mailparser that breaks edge
 * runtimes (PIT-03/SCN-06); a Node CLI is unaffected, but the pin is the discipline.
 *
 * Test mode (RQ-7): a restricted/sandbox key + Resend's reserved test addresses
 * (delivered@resend.dev / bounced@resend.dev) — never touches a real recipient.
 *
 * No-key fallback: when RESEND_API_KEY is absent, sendTest returns a DETERMINISTIC stub result so
 * the idempotency property + the deterministic merge-gate run with ZERO creds (D15 local-first).
 * This is honest: the LIVE send half is 🔄 until the key lands; the testable property is proven now.
 *
 * Raw-REST escape hatch (O-14): if the SDK misbehaves (#644 missing_api_key while cURL works), the
 * documented fallback is a direct POST to https://api.resend.com/emails with the same body; left as
 * a documented path (not wired) per Karpathy minimum-viable.
 */
import { createHash } from "node:crypto";
import type { OutboundMessage, ProviderAdapter, SendResult } from "../send.js";

/** Resend's reserved test inbox (accepts, never delivers to a human). */
export const RESEND_TEST_TO = "delivered@resend.dev";

export class ResendProvider implements ProviderAdapter {
  readonly name = "resend";
  private readonly apiKey: string | undefined;

  constructor(apiKey: string | undefined = process.env.RESEND_API_KEY) {
    this.apiKey = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : undefined;
  }

  /** True when a live key is present (the live send half can run). */
  hasKey(): boolean {
    return this.apiKey !== undefined;
  }

  async sendTest(msg: OutboundMessage, idempotencyKey: string): Promise<SendResult> {
    // No key → deterministic stub (D15 local-first; live half stays 🔄). Same content → same id.
    if (!this.apiKey) {
      const stubId =
        "stub_" +
        createHash("sha256")
          .update(idempotencyKey + "|" + msg.to + "|" + msg.subject)
          .digest("hex")
          .slice(0, 24);
      return {
        id: stubId,
        accepted: true,
        provider: this.name,
        idempotencyKey,
        testMode: true,
      };
    }

    // Live test-mode send via the pinned SDK. Dynamic import keeps the SDK off the no-key path
    // (and off edge bundlers that choke on its mailparser dep — PIT-03).
    const { Resend } = await import("resend");
    const client = new Resend(this.apiKey);
    const { data, error } = await client.emails.send(
      {
        from: msg.from ?? "pigeon <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
      },
      // Resend honors an Idempotency-Key header (O-13).
      { idempotencyKey },
    );
    if (error || !data?.id) {
      throw new Error(`resend send failed: ${error?.message ?? "no id returned"}`);
    }
    return {
      id: data.id,
      accepted: true,
      provider: this.name,
      idempotencyKey,
      testMode: true,
    };
  }
}
