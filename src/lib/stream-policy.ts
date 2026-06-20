/**
 * Stream policy — the HARD-REFUSE truth table (O-02 / SCN-05 / PIT-02). This is pigeon's
 * signature guardrail, not a tuning knob: routing a cold/marketing-tagged message through a
 * transactional-only provider is account-DEATH (the whole account is suspended, password-resets
 * included), so pigeon REFUSES it.
 *
 * Shared by `stream-check` (B9), the send path (B10), and the stream-refuse hook (B13) — one
 * source of truth for the rule (Karpathy).
 */

/** The three streams pigeon tags every message with (the core primitive — O-01). */
export const STREAMS = ["transactional", "marketing", "cold"] as const;
export type Stream = (typeof STREAMS)[number];

/**
 * Providers pigeon knows, tagged by what they PERMIT. Transactional-only providers ban
 * cold/unsolicited/bulk-to-unverified and suspend the whole account on detection.
 */
const TRANSACTIONAL_ONLY = new Set(["postmark", "resend", "resend-transactional", "ses-transactional"]);
const PERMISSIVE = new Set(["sendgrid", "mailgun-bulk", "ses", "amazonses"]);

export interface StreamDecision {
  allowed: boolean;
  stream: Stream;
  provider: string;
  reason: string;
  /** the brain node the decision traces to. */
  ref: string;
}

/** Validate + normalize a stream tag; throws on an unknown stream (chaos: corrupt input). */
export function parseStream(raw: string): Stream {
  const s = raw.trim().toLowerCase();
  if ((STREAMS as readonly string[]).includes(s)) return s as Stream;
  throw new Error(
    `unknown stream "${raw}" — must be one of: ${STREAMS.join(", ")} (stream-tag is a core primitive, O-01)`,
  );
}

/**
 * The decision rule. `cold`/`marketing` → a transactional-only provider is a HARD-REFUSE
 * (allowed:false). Everything else is allowed (with guidance where relevant).
 */
export function checkStream(rawStream: string, rawProvider: string): StreamDecision {
  const stream = parseStream(rawStream);
  const provider = rawProvider.trim().toLowerCase();

  if ((stream === "cold" || stream === "marketing") && TRANSACTIONAL_ONLY.has(provider)) {
    return {
      allowed: false,
      stream,
      provider,
      reason:
        `HARD-REFUSE: routing a "${stream}" message through "${provider}" (transactional-only) is ` +
        "account-DEATH. Transactional-only providers suspend the WHOLE account — password-resets " +
        "included — within days of detecting cold/bulk. Send cold/marketing through a permissive " +
        "provider on a SEPARATE domain (e.g. sendgrid / ses on news.<domain>); keep transactional here.",
      ref: "OPINIONS O-02 / SCN-05 / PIT-02 (absolute guardrail)",
    };
  }

  // transactional → anywhere is fine; cold/marketing → permissive is fine.
  let reason: string;
  if (stream === "transactional") {
    reason = `ALLOW: transactional through "${provider}" — keep it on its own subdomain, separate from marketing (O-01).`;
  } else {
    reason = `ALLOW: "${stream}" through "${provider}" (a permissive provider) — verify opt-in + warm from zero (O-08).`;
  }
  return {
    allowed: true,
    stream,
    provider,
    reason,
    ref: "OPINIONS O-01 (separate the streams)",
  };
}

/** Is this provider transactional-only? (used by the hook + doctor.) */
export function isTransactionalOnly(provider: string): boolean {
  return TRANSACTIONAL_ONLY.has(provider.trim().toLowerCase());
}

/** Known permissive providers (for guidance/messaging). */
export function isPermissive(provider: string): boolean {
  return PERMISSIVE.has(provider.trim().toLowerCase());
}
