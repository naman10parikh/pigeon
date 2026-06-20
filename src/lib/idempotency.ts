/**
 * Idempotency — every send carries a key by default (O-13 / PIT-15). A retry after a network blip
 * must NOT double-send (inflating volume + complaints). The key is derived deterministically from
 * the send's content so two identical sends collide, and an in-process dedup cache returns the
 * FIRST result for a repeated key (exactly-once for two identical-key calls — the B10 verify line).
 *
 * The cache here is process-local (sufficient to PROVE the property in tests + a single run). A
 * production deployment would back this with Redis/Postmark/Resend's own Idempotency-Key header;
 * that wiring is documented, not the merge bar (PLAN §13 risk 5 style honesty).
 */
import { createHash } from "node:crypto";

export interface SendKeyInput {
  provider: string;
  to: string;
  template: string;
  /** the rendered subject + a hash of the body, so content changes change the key. */
  subject: string;
  bodyHash: string;
}

/** Derive a stable idempotency key from the send's content (same content → same key). */
export function deriveIdempotencyKey(input: SendKeyInput): string {
  const material = [
    input.provider,
    input.to.trim().toLowerCase(),
    input.template,
    input.subject,
    input.bodyHash,
  ].join("|");
  return "pgn_" + createHash("sha256").update(material).digest("hex").slice(0, 32);
}

/** Hash an arbitrary body string (used to fold the rendered HTML into the key). */
export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

/**
 * A tiny in-process idempotency cache. `runOnce(key, fn)` runs fn at most once per key for the
 * life of the cache instance; a second call with the same key returns the FIRST result without
 * invoking fn again. This is what proves O-13/PIT-15 in the chaos test.
 */
export class IdempotencyCache<T> {
  private readonly store = new Map<string, T>();

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  async runOnce(key: string, fn: () => Promise<T>): Promise<{ result: T; deduped: boolean }> {
    const existing = this.store.get(key);
    if (existing !== undefined) {
      return { result: existing, deduped: true };
    }
    const result = await fn();
    this.store.set(key, result);
    return { result, deduped: false };
  }

  clear(): void {
    this.store.clear();
  }
}
