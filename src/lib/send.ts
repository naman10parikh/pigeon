/**
 * The provider-agnostic send adapter — the thin `send()` interface every provider sits behind
 * (TOOL-MATRIX §6, O-18). The whole point of pigeon: the provider is swappable; the deliverability
 * discipline (stream check, idempotency, audit log) lives ABOVE it. send-test, notify, and migrate
 * all speak this shape.
 *
 * Wired default: Resend (O-18 "Resend = DX/default"). Alts (Postmark/SES/SendGrid) are documented,
 * not wired (Karpathy minimum-viable; PLAN §7).
 */
import type { Stream } from "./stream-policy.js";

/** A message handed to a provider. */
export interface OutboundMessage {
  to: string;
  from?: string;
  subject: string;
  /** rendered HTML body (already inlined via @react-email/render at the call site). */
  html: string;
  /** the message stream — drives the HARD-REFUSE guardrail (O-02). */
  stream: Stream;
}

/** What a provider returns from an accepted send. */
export interface SendResult {
  /** the provider's message id (non-empty iff accepted). */
  id: string;
  accepted: boolean;
  provider: string;
  /** the idempotency key attached to this send (O-13). */
  idempotencyKey: string;
  /** true when the result came from the test-mode/stub path (no real recipient touched). */
  testMode: boolean;
}

/** The contract every provider adapter implements. */
export interface ProviderAdapter {
  readonly name: string;
  /**
   * Send a message in test mode (reserved test addresses, no real recipient — RQ-7). `idempotencyKey`
   * is forwarded to the provider's Idempotency-Key surface where supported, and always attached to
   * the result so the dedup cache can key on it (O-13).
   */
  sendTest(msg: OutboundMessage, idempotencyKey: string): Promise<SendResult>;
}
