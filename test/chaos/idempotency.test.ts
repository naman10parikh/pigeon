/**
 * Chaos / idempotency proof (O-13 / PIT-15). This is the property B10 OWNS: a retry (a second send
 * with the SAME idempotency key) must NOT create a second send — exactly-once for two identical-key
 * calls. We inject a counting mock provider + a shared cache and assert the underlying provider was
 * called exactly once, returning the FIRST send's id both times.
 *
 * (Mirrors the kill-mid-run scenario from PLAN §9 chaos: after an accept-but-before-log crash, a
 * restart re-issues the same key → the cache returns the first result, no double-send.)
 */
import { describe, it, expect } from "vitest";
import { runSendTest } from "../../src/commands/send-test.js";
import { IdempotencyCache } from "../../src/lib/idempotency.js";
import type { OutboundMessage, ProviderAdapter, SendResult } from "../../src/lib/send.js";

class CountingProvider implements ProviderAdapter {
  readonly name = "counting-mock";
  public calls = 0;
  async sendTest(_msg: OutboundMessage, idempotencyKey: string): Promise<SendResult> {
    this.calls += 1;
    return {
      id: `mock_${this.calls}`, // id encodes the call count so a second send would change it
      accepted: true,
      provider: this.name,
      idempotencyKey,
      testMode: true,
    };
  }
}

describe("idempotency — exactly-once on a repeated key (O-13/PIT-15)", () => {
  it("a second identical send returns the FIRST id and does NOT call the provider again", async () => {
    const provider = new CountingProvider();
    const cache = new IdempotencyCache<SendResult>();
    const opts = {
      provider: "counting-mock",
      template: "welcome",
      to: "delivered@resend.dev",
      stream: "transactional",
      testMode: true,
    };

    const first = await runSendTest(opts, { provider, cache });
    const second = await runSendTest(opts, { provider, cache });

    // Exactly ONE underlying provider send for two identical-key calls.
    expect(provider.calls).toBe(1);

    // Both calls succeeded.
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    // The second returns the FIRST send's id (mock_1, not mock_2) — proof of dedup.
    expect(first.data.id).toBe("mock_1");
    expect(second.data.id).toBe("mock_1");

    // The second call is flagged deduped.
    expect(second.data.deduped).toBe(true);
    expect(first.data.deduped).toBe(false);

    // Same idempotency key derived for identical content.
    expect(first.data.idempotencyKey).toBe(second.data.idempotencyKey);
  });

  it("different content derives a different key → a genuine second send", async () => {
    const provider = new CountingProvider();
    const cache = new IdempotencyCache<SendResult>();
    await runSendTest(
      { provider: "counting-mock", to: "a@resend.dev", stream: "transactional" },
      { provider, cache },
    );
    await runSendTest(
      { provider: "counting-mock", to: "b@resend.dev", stream: "transactional" },
      { provider, cache },
    );
    // Two different recipients → two different keys → two real sends.
    expect(provider.calls).toBe(2);
  });
});
