/**
 * DNS auth resolution — dig SPF/DKIM/DMARC out-of-band (O-11: never trust a provider's
 * cached "verified" flag; PIT-04/PIT-21/SCN-18). Supports a vendored fixture for the
 * reproducible $0 CI merge-gate (PLAN §5 / RQ-1).
 *
 * Pure-ish: the live path shells out to `dig` (read-only DNS query, no mutation — distinct
 * from the mutating provider /verify endpoint pigeon REFUSES to poll). The fixture path is
 * deterministic and offline.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

/** The raw DNS records pigeon needs to judge readiness, normalized across live + fixture. */
export interface DnsBundle {
  domain: string;
  /** The SPF TXT record value (e.g. "v=spf1 include:_spf.resend.com ~all"), or null if absent. */
  spf: string | null;
  /**
   * DKIM record values keyed by selector (e.g. { "resend": "v=DKIM1; k=rsa; p=..." }).
   * Empty object = no DKIM found.
   */
  dkim: Record<string, string>;
  /** The DMARC TXT record value (e.g. "v=DMARC1; p=reject; adkim=s; aspf=s"), or null. */
  dmarc: string | null;
}

/**
 * A DNS fixture file (eval/fixtures/dns/*.json) describing published records for a domain so
 * `verify --dns-fixture` is reproducible in CI without a live domain.
 */
export const DnsFixtureSchema = z.object({
  domain: z.string(),
  spf: z.string().nullable(),
  dkim: z.record(z.string(), z.string()),
  dmarc: z.string().nullable(),
  /** Optional: which selector the From: domain's mail actually signs with (for alignment). */
  signingDomain: z.string().optional(),
  /** Optional: the envelope MAIL FROM domain (Return-Path) — drives SPF alignment. */
  envelopeFrom: z.string().optional(),
});
export type DnsFixture = z.infer<typeof DnsFixtureSchema>;

/** Load + validate a vendored DNS fixture from disk. Throws on malformed input (chaos: corrupt). */
export function loadDnsFixture(path: string): DnsFixture {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`could not read DNS fixture at ${path}: ${msg}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`DNS fixture at ${path} is not valid JSON`);
  }
  const result = DnsFixtureSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `DNS fixture at ${path} is malformed: ${result.error.issues
        .map((i) => i.message)
        .join("; ")}`,
    );
  }
  return result.data;
}

/** Convert a validated fixture into the common DnsBundle shape. */
export function bundleFromFixture(fx: DnsFixture): DnsBundle {
  return { domain: fx.domain, spf: fx.spf, dkim: fx.dkim, dmarc: fx.dmarc };
}

/** Run a single `dig +short TXT <name>` lookup, returning unquoted joined TXT chunks. */
async function digTxt(name: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("dig", ["+short", "TXT", name], {
      timeout: 8000,
    });
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      // dig wraps long TXT in per-string quotes: "v=spf1 ..." "...more..." → join + unquote.
      .map((l) => l.replace(/"\s+"/g, "").replace(/^"|"$/g, ""));
  } catch {
    return []; // no record / NXDOMAIN / timeout → treated as absent, not a crash
  }
}

/**
 * Resolve SPF/DKIM/DMARC for a domain live via `dig`. Best-effort: a missing record is null,
 * not an error (the readiness judgment lives in alignment.ts). `selectors` lets the caller probe
 * known DKIM selectors (e.g. ["resend", "google", "k1", "s1"]).
 */
export async function resolveLive(
  domain: string,
  selectors: string[] = ["resend", "google", "k1", "s1", "selector1", "selector2"],
): Promise<DnsBundle> {
  const root = await digTxt(domain);
  const spf = root.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? null;

  const dmarcRecords = await digTxt(`_dmarc.${domain}`);
  const dmarc =
    dmarcRecords.find((r) => r.toLowerCase().startsWith("v=dmarc1")) ?? null;

  const dkim: Record<string, string> = {};
  for (const sel of selectors) {
    const recs = await digTxt(`${sel}._domainkey.${domain}`);
    const hit = recs.find(
      (r) => r.toLowerCase().includes("v=dkim1") || r.toLowerCase().includes("k=rsa"),
    );
    if (hit) dkim[sel] = hit;
  }

  return { domain, spf, dkim, dmarc };
}

/**
 * Count the DNS lookups an SPF record costs (SCN-03 / PIT-07: the hard 10-lookup ceiling).
 * Counts the lookup-consuming mechanisms: include, a, mx, ptr, exists, redirect. This is a
 * shallow first-level count (does not recurse into includes — flagged as the known limit).
 */
export function spfLookupCount(spf: string | null): number {
  if (!spf) return 0;
  const tokens = spf.split(/\s+/);
  let n = 0;
  for (const t of tokens) {
    const m = t.toLowerCase().replace(/^[+\-~?]/, "");
    if (
      m.startsWith("include:") ||
      m.startsWith("a:") ||
      m === "a" ||
      m.startsWith("mx:") ||
      m === "mx" ||
      m.startsWith("ptr") ||
      m.startsWith("exists:") ||
      m.startsWith("redirect=")
    ) {
      n += 1;
    }
  }
  return n;
}
