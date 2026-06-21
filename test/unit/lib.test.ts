/**
 * E20 unit matrix — the deterministic pure-logic cores (no network, no secrets beyond a local one).
 * Covers the three highest-stakes modules: the stream HARD-REFUSE truth table (the differentiator),
 * the opaque/signed unsubscribe token (enumeration defense), and the email render-hazard linter.
 * The golden eval (eval/eval.mjs) covers these end-to-end via the CLI; these assert them at unit level.
 */
import { describe, it, expect } from "vitest";
import { checkStream, parseStream, isTransactionalOnly, isPermissive, STREAMS } from "../../src/lib/stream-policy.js";
import { encodeSubscriberId, decodeSubscriberId, signUnsubToken, verifyUnsubToken } from "../../src/lib/opaque-id.js";
import { lintHtml, hasBlockingHazard } from "../../src/lib/render-hazards.js";

describe("stream-policy — the HARD-REFUSE truth table (O-02/SCN-05/PIT-02)", () => {
  it("REFUSES cold → a transactional-only provider (account-death guardrail)", () => {
    const d = checkStream("cold", "resend");
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/HARD-REFUSE/);
    expect(d.ref).toMatch(/O-02/);
  });

  it("REFUSES marketing → postmark/ses-transactional", () => {
    for (const p of ["postmark", "ses-transactional", "resend-transactional"]) {
      expect(checkStream("marketing", p).allowed).toBe(false);
    }
  });

  it("ALLOWS transactional → a transactional-only provider", () => {
    expect(checkStream("transactional", "resend").allowed).toBe(true);
  });

  it("ALLOWS cold/marketing → a permissive provider", () => {
    expect(checkStream("cold", "sendgrid").allowed).toBe(true);
    expect(checkStream("marketing", "mailgun-bulk").allowed).toBe(true);
  });

  it("is case/whitespace-insensitive on provider + stream", () => {
    expect(checkStream("  COLD ", "  ReSeNd ").allowed).toBe(false);
  });

  it("parseStream throws on an unknown stream (corrupt input)", () => {
    expect(() => parseStream("bulk")).toThrow(/unknown stream/);
    for (const s of STREAMS) expect(parseStream(s)).toBe(s);
  });

  it("provider classification helpers agree with the sets", () => {
    expect(isTransactionalOnly("Resend")).toBe(true);
    expect(isTransactionalOnly("sendgrid")).toBe(false);
    expect(isPermissive("sendgrid")).toBe(true);
    expect(isPermissive("postmark")).toBe(false);
  });
});

describe("opaque-id — signed unsubscribe token (O-05/SCN-13/PIT-06)", () => {
  const SECRET = "a".repeat(64); // stand-in for UNSUBSCRIBE_TOKEN_SECRET (openssl rand -hex 32)

  it("encode→decode round-trips the subscriber id", () => {
    for (const id of [1, 42, 99999, 2_000_000]) {
      expect(decodeSubscriberId(encodeSubscriberId(id))).toBe(id);
    }
  });

  it("decode returns null on a malformed public id", () => {
    expect(decodeSubscriberId("!!!not-a-sqid!!!")).toBeNull();
  });

  it("sign→verify round-trips and returns the subscriber id", () => {
    const tok = signUnsubToken(7, "newsletter", SECRET);
    expect(verifyUnsubToken(tok, "newsletter", SECRET)).toBe(7);
  });

  it("rejects a forged signature (enumeration defense)", () => {
    const tok = signUnsubToken(7, "newsletter", SECRET);
    const [pub] = tok.split(".");
    const forged = `${pub}.${"0".repeat(32)}`;
    expect(verifyUnsubToken(forged, "newsletter", SECRET)).toBeNull();
  });

  it("rejects a token signed for a different list (audience binding)", () => {
    const tok = signUnsubToken(7, "newsletter", SECRET);
    expect(verifyUnsubToken(tok, "promotions", SECRET)).toBeNull();
  });

  it("rejects a token under the wrong secret, and a structurally bad token", () => {
    const tok = signUnsubToken(7, "newsletter", SECRET);
    expect(verifyUnsubToken(tok, "newsletter", "b".repeat(64))).toBeNull();
    expect(verifyUnsubToken("garbage-no-dot", "newsletter", SECRET)).toBeNull();
  });

  it("signUnsubToken throws when no secret is available", () => {
    expect(() => signUnsubToken(7, "newsletter", "")).toThrow(/UNSUBSCRIBE_TOKEN_SECRET/);
  });
});

describe("render-hazards — the detectable subset (PIT-16..20/SCN-09/SCN-10)", () => {
  it("flags an empty <Preview> as a Gmail-blank error", () => {
    const hz = lintHtml("<Preview></Preview><Body>hi</Body>");
    expect(hz.some((h) => h.rule === "preview-blank-risk" && h.severity === "error")).toBe(true);
    expect(hasBlockingHazard(hz)).toBe(true);
  });

  it("flags <style> media queries (Gmail strips them)", () => {
    const hz = lintHtml("<style>@media (max-width:600px){.x{display:none}}</style>");
    expect(hz.some((h) => h.rule === "style-media-query")).toBe(true);
  });

  it("flags a CTA button with no MSO/VML conditional (Outlook drops it)", () => {
    const hz = lintHtml('<a class="btn">Get started</a>');
    expect(hz.some((h) => h.rule === "outlook-button-not-bulletproof")).toBe(true);
  });

  it("does NOT flag a bulletproof MSO button", () => {
    const hz = lintHtml('<!--[if mso]><v:roundrect>Get started</v:roundrect><![endif]--><a class="btn">Get started</a>');
    expect(hz.some((h) => h.rule === "outlook-button-not-bulletproof")).toBe(false);
  });

  it("clean inlined HTML has no blocking hazards", () => {
    const hz = lintHtml('<table><tr><td style="color:#111">hello</td></tr></table>');
    expect(hasBlockingHazard(hz)).toBe(false);
  });
});
