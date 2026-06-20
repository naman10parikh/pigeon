/**
 * DMARC alignment + readiness judgment — the single thing pigeon exists to catch (O-10 / SCN-02 /
 * PIT-08): SPF and DKIM can BOTH pass while DMARC still fails, because DMARC requires the
 * authenticated domain to *align* with the visible From:. Presence-only would be the exact bug.
 *
 * Also enforces the SPF 10-lookup ceiling (SCN-03 / PIT-07) and surfaces the p=none "not done"
 * posture (O-20: ship for the future p=reject).
 */
import type { DnsBundle, DnsFixture } from "./dns.js";
import { spfLookupCount } from "./dns.js";

export interface Finding {
  /** machine code, e.g. "spf-missing", "dmarc-unaligned", "spf-lookup-ceiling". */
  code: string;
  severity: "error" | "warn" | "info";
  message: string;
  /** the OPINIONS/PITFALLS/SCN node this traces to, for the brain citation. */
  ref: string;
}

export interface Readiness {
  domain: string;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  /** the load-bearing field — SPF/DKIM/DMARC present AND aligned with From: (not just present). */
  aligned: boolean;
  /** ready = all three present AND aligned AND under the SPF lookup ceiling. */
  ready: boolean;
  findings: Finding[];
}

/** Parse a DMARC record's policy (p=) — "none" | "quarantine" | "reject" | null. */
function dmarcPolicy(dmarc: string | null): string | null {
  if (!dmarc) return null;
  const m = dmarc.match(/\bp\s*=\s*(none|quarantine|reject)\b/i);
  return m && m[1] ? m[1].toLowerCase() : null;
}

/** Parse DMARC alignment mode for a tag (adkim / aspf): "s" (strict) | "r" (relaxed, default). */
function dmarcAlignMode(dmarc: string | null, tag: "adkim" | "aspf"): "s" | "r" {
  if (!dmarc) return "r";
  const m = dmarc.match(new RegExp(`\\b${tag}\\s*=\\s*([sr])\\b`, "i"));
  return m && m[1] && m[1].toLowerCase() === "s" ? "s" : "r";
}

/**
 * Decide whether the authenticated domains align with the organizational From: domain.
 *
 * Alignment is satisfied if EITHER:
 *  - DKIM aligns: a present DKIM selector's signing domain matches (strict) or is a sub/parent
 *    (relaxed) of the From: domain, OR
 *  - SPF aligns: the envelope (MAIL FROM / Return-Path) domain matches (strict) or shares the
 *    organizational domain (relaxed) of the From:.
 *
 * When the bundle carries no signingDomain/envelopeFrom hints (the common live case where we only
 * have public DNS), we treat a DKIM record published *under the From: domain itself* as aligned —
 * because a selector at `<sel>._domainkey.<from>` signs as `<from>` by construction. The classic
 * SCN-02 failure (a third-party signing under ITS OWN domain) is encoded by a fixture whose
 * signingDomain differs from the From: domain.
 */
function judgeAlignment(
  fromDomain: string,
  bundle: DnsBundle,
  hints: { signingDomain?: string; envelopeFrom?: string },
): { aligned: boolean; how: string } {
  const orgOf = (d: string): string => {
    // crude org-domain extraction: last two labels (good enough for *.example.com vs example.com).
    const parts = d.toLowerCase().split(".").filter(Boolean);
    return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".");
  };
  const from = fromDomain.toLowerCase();
  const orgFrom = orgOf(from);

  const adkim = dmarcAlignMode(bundle.dmarc, "adkim");
  const aspf = dmarcAlignMode(bundle.dmarc, "aspf");

  // DKIM alignment.
  const hasDkim = Object.keys(bundle.dkim).length > 0;
  if (hasDkim) {
    // With an explicit signingDomain hint (fixture), check it directly.
    if (hints.signingDomain) {
      const sd = hints.signingDomain.toLowerCase();
      const dkimAligned = adkim === "s" ? sd === from : orgOf(sd) === orgFrom;
      if (dkimAligned) return { aligned: true, how: `dkim(${adkim})` };
    } else {
      // No hint: a DKIM record published under the From: domain signs as the From: domain.
      return { aligned: true, how: `dkim(${adkim})@from` };
    }
  }

  // SPF alignment (only counts toward DMARC if the envelope domain aligns with From:).
  if (bundle.spf && hints.envelopeFrom) {
    const ef = hints.envelopeFrom.toLowerCase();
    const spfAligned = aspf === "s" ? ef === from : orgOf(ef) === orgFrom;
    if (spfAligned) return { aligned: true, how: `spf(${aspf})` };
  }

  return { aligned: false, how: "none" };
}

/**
 * The readiness judgment over a DnsBundle. `fromDomain` defaults to the bundle's own domain
 * (the common "I send as me" case); fixtures can carry signingDomain/envelopeFrom hints to model
 * the SCN-02 third-party-misalignment failure.
 */
export function judgeReadiness(
  bundle: DnsBundle,
  opts: { fromDomain?: string; signingDomain?: string; envelopeFrom?: string } = {},
): Readiness {
  const fromDomain = opts.fromDomain ?? bundle.domain;
  const findings: Finding[] = [];

  const spf = bundle.spf !== null;
  const dkim = Object.keys(bundle.dkim).length > 0;
  const dmarc = bundle.dmarc !== null;

  if (!spf)
    findings.push({
      code: "spf-missing",
      severity: "error",
      message: "No SPF (v=spf1) TXT record found — mail fails SPF.",
      ref: "OPINIONS O-09 (auth is the entry fee)",
    });
  if (!dkim)
    findings.push({
      code: "dkim-missing",
      severity: "error",
      message: "No DKIM selector record found — mail cannot DKIM-sign aligned.",
      ref: "EXPERTISE-MAP JTBD-1",
    });
  if (!dmarc)
    findings.push({
      code: "dmarc-missing",
      severity: "error",
      message: "No DMARC (_dmarc) record found — no alignment policy published.",
      ref: "OPINIONS O-10 (alignment is what matters)",
    });

  // The signature catch: present-but-unaligned.
  const { aligned, how } = judgeAlignment(fromDomain, bundle, {
    signingDomain: opts.signingDomain,
    envelopeFrom: opts.envelopeFrom,
  });
  if (spf && dkim && dmarc && !aligned) {
    findings.push({
      code: "dmarc-unaligned",
      severity: "error",
      message:
        "SPF and DKIM pass but DMARC FAILS on alignment: the authenticated domain does not align " +
        `with the From: domain (${fromDomain}). This is the #1 'I set up auth but DMARC still fails'. ` +
        "Bring the third-party sender under an aligned subdomain (CNAME its DKIM to *." +
        `${fromDomain}) and enumerate ALL senders via aggregate reports before p=reject.`,
      ref: "SCN-02 / OPINIONS O-10 / PIT-08",
    });
  }

  // SPF 10-lookup ceiling (SCN-03 / PIT-07).
  const lookups = spfLookupCount(bundle.spf);
  if (lookups > 10) {
    findings.push({
      code: "spf-lookup-ceiling",
      severity: "error",
      message: `SPF costs ${lookups} DNS lookups (>10) → permerror for ALL mail. Flatten nested includes.`,
      ref: "SCN-03 / PIT-07 (RFC 7208 §4.6.4)",
    });
  } else if (lookups >= 8) {
    findings.push({
      code: "spf-lookup-near-ceiling",
      severity: "warn",
      message: `SPF costs ${lookups} DNS lookups — close to the hard 10-lookup ceiling. Budget it before adding senders.`,
      ref: "SCN-03 / PIT-07",
    });
  }

  // p=none posture (O-20: ship for the future p=reject, never treat p=none as done).
  const policy = dmarcPolicy(bundle.dmarc);
  if (policy === "none") {
    findings.push({
      code: "dmarc-p-none",
      severity: "warn",
      message:
        "DMARC p=none — this is the 2024 floor, not 'done'. Gmail moved to hard rejection of " +
        "non-compliant traffic (Nov-2025); build toward p=quarantine/reject.",
      ref: "OPINIONS O-20",
    });
  }

  // ready iff all three present AND aligned AND no lookup ceiling breach.
  const ready = spf && dkim && dmarc && aligned && lookups <= 10;
  if (ready)
    findings.push({
      code: "ready",
      severity: "info",
      message: `Auth present and ALIGNED (${how}). Necessary, not sufficient — reputation + engagement still decide inbox placement (O-09).`,
      ref: "OPINIONS O-09",
    });

  return { domain: bundle.domain, spf, dkim, dmarc, aligned, ready, findings };
}

/** Pull alignment hints off a fixture (fixtures can model the SCN-02 misalignment). */
export function hintsFromFixture(fx: DnsFixture): {
  signingDomain?: string;
  envelopeFrom?: string;
} {
  const out: { signingDomain?: string; envelopeFrom?: string } = {};
  if (fx.signingDomain !== undefined) out.signingDomain = fx.signingDomain;
  if (fx.envelopeFrom !== undefined) out.envelopeFrom = fx.envelopeFrom;
  return out;
}
