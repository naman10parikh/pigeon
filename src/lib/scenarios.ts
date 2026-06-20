/**
 * The 19 battle-tested scenarios as a matchable index (powers `pigeon ask`). Each entry is the
 * brain's SCN distilled to: keywords → diagnosis → resolution → prevention → brain citation, with
 * the uncertainty note where the source is disputed (e.g. SCN-05 must NOT overstate severity, G-05).
 *
 * Source of truth: brain/BATTLE-TESTED-SCENARIOS.md (do not invent diagnoses — these trace 1:1).
 * `ask` greps a symptom against `keywords` and returns the best match; the cockpit shows the same.
 */

export interface Scenario {
  id: string;
  title: string;
  /** lowercase keywords/phrases that signal this scenario (for symptom matching). */
  keywords: string[];
  diagnosis: string;
  resolution: string;
  prevention: string;
  /** the brain node(s) this traces to. */
  ref: string;
  /** carried uncertainty where the source is disputed (empty if the source is firm). */
  uncertainty?: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "SCN-01",
    title: "Transactional email started going to Gmail spam (stable-for-years cliff)",
    keywords: ["spam", "gmail", "suddenly", "started", "years", "nothing changed", "receipts", "password reset spam"],
    diagnosis:
      "Reputation, almost always: either a neighbor on a SHARED IP pool went bad, or you crossed Gmail's tightened 2024/2025 thresholds (post-Nov-2025 hard rejection of non-compliant traffic).",
    resolution:
      "Check Google Postmaster Tools (the only authoritative reputation view) + MXToolbox for blocklists. If the shared pool is the cause, get a new IP or move transactional to a curated provider (Postmark) on a dedicated transactional subdomain. Confirm SPF+DKIM+DMARC with alignment.",
    prevention: "Separate streams; monitor complaint rate via FBLs BEFORE the cliff; don't share an IP pool with marketing.",
    ref: "SCN-01 / field-05 §F / field-04 §C2",
  },
  {
    id: "SCN-02",
    title: "SPF and DKIM pass but DMARC still fails",
    keywords: ["dmarc fails", "spf pass", "dkim pass", "dmarc still fails", "quarantined", "alignment", "set up auth"],
    diagnosis:
      "ALIGNMENT. DMARC requires the authenticated domain to ALIGN with the visible From:. A third-party sender authenticating under ITS OWN domain passes SPF/DKIM but fails DMARC alignment against your From:.",
    resolution:
      "Bring the third party under an aligned subdomain (CNAME its DKIM to a *.yourdomain.com selector + From: on your domain), or set relaxed alignment if a subdomain match is acceptable. Enumerate EVERY third-party sender first via DMARC aggregate reports.",
    prevention: "Before p=reject, run p=none and read aggregate reports to enumerate ALL senders — 'I forgot the helpdesk ticketing system' is the canonical miss.",
    ref: "SCN-02 / OPINIONS O-10 / PIT-08 / field-03 THREAD-2",
  },
  {
    id: "SCN-03",
    title: "Adding one more ESP silently broke SPF for ALL mail",
    keywords: ["spf broke", "added esp", "spf fails", "permerror", "10 lookup", "too many lookups", "include"],
    diagnosis:
      "SPF has a HARD 10-DNS-lookup limit (RFC 7208 §4.6.4). Each include: consumes lookups; the new ESP pushed it over 10 and SPF returns permerror for everything.",
    resolution:
      "Flatten the SPF record (replace nested includes with resolved IP ranges where safe) or remove unused senders. Re-test with a checker that evaluates SPF MACROS (most online tools don't and misreport).",
    prevention: "Treat the 10-lookup limit as a hard budget; audit it before adding any sender; consolidate ESPs.",
    ref: "SCN-03 / PIT-07 / field-03 THREAD-3",
  },
  {
    id: "SCN-04",
    title: "Password-reset emails went to spam after a marketing campaign (stream contamination)",
    keywords: ["after a campaign", "newsletter", "password reset", "contamination", "marketing", "reset to spam"],
    diagnosis:
      "Marketing and transactional share the same IP/subdomain. Spam complaints on the newsletter dropped the sending IP's reputation, so the password resets sharing that IP started landing in spam. Asymmetric: the disposable stream poisoned the critical one.",
    resolution:
      "Split immediately — move transactional to its own subdomain (notifications.app.com) and ideally a separate provider/pool (Postmark). Let the marketing reputation recover in isolation.",
    prevention: "Never co-mingle streams. Stream-tag every message and route by stream from day one (O-01).",
    ref: "SCN-04 / OPINIONS O-01 / PIT-01 / field-04 §B",
  },
  {
    id: "SCN-05",
    title: "Whole account suspended after one cold/B2B broadcast (cold-on-transactional ban)",
    keywords: ["suspended", "account suspended", "cold", "b2b broadcast", "postmark", "mailgun", "blast", "whole account"],
    diagnosis:
      "Transactional-only providers explicitly prohibit cold/unsolicited/bulk-to-unverified mail and suspend the WHOLE account on detection. Stream separation isn't politeness — violating it is account-death.",
    resolution:
      "Move cold/marketing to a provider that permits it (with verified opt-in) on a SEPARATE domain; restore transactional on the compliant provider. If already routing cold through Postmark/Mailgun, migrate BEFORE suspension.",
    prevention: "pigeon HARD-REFUSES routing a cold/marketing-tagged message through a transactional-only provider. A guardrail, not a knob (O-02).",
    ref: "SCN-05 / OPINIONS O-02 / PIT-02 / field-05 §D",
    uncertainty:
      "The 'transactional was ALSO blocked' severity comes from a one-sided review claim (G-05); the BAN POLICY itself is independently confirmed, but don't overstate that transactional was definitely blocked.",
  },
  {
    id: "SCN-06",
    title: "resend@6.9.x broke our Cloudflare Workers / Convex build (minor-bump edge break)",
    keywords: ["resend", "cloudflare workers", "convex", "build broke", "hasownproperty", "mailparser", "edge", "nodejs_compat", "sdk bump", "6.9"],
    diagnosis:
      "resend-node v6.9.0 added the mailparser dependency (for inbound), which pulls Node built-ins that don't exist on edge runtimes.",
    resolution:
      "Immediate: enable nodejs_compat on the Cloudflare Worker (#817). Strategic: PIN the SDK version and isolate it behind pigeon's thin provider interface so a regression is a one-file pin. For pure-send paths, consider the raw-REST escape hatch.",
    prevention: "Pin the email-SDK version; treat any minor bump as a deploy-risk event, especially on serverless/edge; test on the target runtime before merging (O-12).",
    ref: "SCN-06 / OPINIONS O-12 / PIT-03 / field-02 §A",
  },
  {
    id: "SCN-07",
    title: "'@react-email/render could not be found' / 'renderAsync is not a function'",
    keywords: ["react-email/render", "could not be found", "renderasync", "module not found", "failed to render react", "turbopack", "optional peer"],
    diagnosis:
      "@react-email/render is documented as an 'optional' peer, but Turbopack/Webpack/Vite each resolve the optional import differently — some fail with 'Module not found'.",
    resolution: "Install @react-email/render EXPLICITLY as a direct dependency and PIN it. Don't rely on transitive resolution.",
    prevention: "Treat it as a required dependency for any React-email send path; verify across the exact bundler the app uses (PIT-14).",
    ref: "SCN-07 / PIT-14 / field-02 §B",
  },
  {
    id: "SCN-08",
    title: "Migrating SendGrid → SES (or → Resend); what breaks? (the migration runbook)",
    keywords: ["migrate", "migration", "sendgrid to ses", "switch provider", "switching providers", "does deliverability carry over"],
    diagnosis:
      "Reputation does NOT transfer between providers; there's no native migration tool; log retention windows are tiny; the new pool/IP starts cold.",
    resolution:
      "1) EXPORT logs BEFORE flipping DNS (Resend retains 1/3/7 days; Postmark 45). 2) Re-verify the domain on the NEW provider's subdomain. 3) Update DNS (new DKIM CNAME/TXT). 4) Rewrite integration behind the abstraction (one file if abstracted). 5) Re-test EVERY template (rendering differs). 6) Warm the new IP/subdomain from ZERO via the control loop.",
    prevention: "Keep all sends behind pigeon's provider abstraction so the only migration change is the adapter; budget 10-20 hours; never blast on arrival (O-19).",
    ref: "SCN-08 / OPINIONS O-19 / PIT-09/PIT-10 / field-05 §A-C",
  },
  {
    id: "SCN-09",
    title: "Button renders fine except in Outlook, where everything below it disappears",
    keywords: ["outlook", "button", "disappears", "everything below", "times new roman", "padding gone", "word engine"],
    diagnosis:
      "Outlook-on-Windows uses the Microsoft Word HTML engine, not a browser. It's intolerant of malformed table nesting, ignores web fonts, and drops CSS padding on <a>/buttons.",
    resolution:
      "Use a bulletproof button — VML <v:roundrect> with MSO conditional comments for Outlook, falling back to a styled <a> elsewhere. Use table-cell bgcolor for backgrounds and a web-safe font stack.",
    prevention: "Test Outlook on EVERY @react-email/components bump (v0.29+ regressed buttons, #1813; padding #1512). Pin the component lib (PIT-18).",
    ref: "SCN-09 / PIT-18 / field-01 §B",
  },
  {
    id: "SCN-10",
    title: "The entire email body is blank in Gmail (preheader / Tailwind total-failure)",
    keywords: ["blank in gmail", "empty email", "preview", "preheader", "tailwind", "safelist", "media query", "no content"],
    diagnosis:
      "Two known root causes: (a) a <Preview> bug that blanks the whole email on certain values (#1785), or (b) Tailwind breakpoints/<style> media queries stripped by Gmail's sanitizer, or a safelist leaking raw @tailwind directives (#1907).",
    resolution:
      "Sanitize/limit the <Preview> value; INLINE all styles (don't depend on <style> blocks or Tailwind breakpoints surviving Gmail); remove a leaking safelist; pin a react-email version without the canary preheader bug.",
    prevention: "Treat Tailwind-for-email as a leaky build-time convenience; verify the rendered HTML; test actual Gmail web + iOS (PIT-16/17/19).",
    ref: "SCN-10 / PIT-16/PIT-17/PIT-19 / field-01 §A",
  },
  {
    id: "SCN-11",
    title: "Warm a brand-new sending domain — what schedule? (warmup as control loop)",
    keywords: ["warm", "warmup", "new domain", "schedule", "ramp", "brand new", "deferral", "421", "450"],
    diagnosis:
      "A fixed doubling schedule is the wrong mental model. The failure mode is doubling on-schedule WHILE a provider is already deferring you.",
    resolution:
      "Run warmup as a CONTROL LOOP: start small, increase gradually, and WATCH the 421/450 deferral rate PER-PROVIDER. If Gmail/Outlook deferral spikes, HOLD volume (do not double) until it clears. 'Slow is fast.' Prioritize engaged recipients early.",
    prevention: "Never blast a cold domain (50k day-one = instant blocklist). If your provider has no auto-pause-on-bounce, pigeon supplies it (O-08).",
    ref: "SCN-11 / OPINIONS O-08 / PIT-09 / field-04 §C3",
  },
  {
    id: "SCN-12",
    title: "We got compromised / reputation crashed — how do we recover? (30-day runbook)",
    keywords: ["compromised", "reputation crashed", "recover", "blocklist", "delist", "blasted spam", "under review recover"],
    diagnosis: "External reputation recovery with recipient servers is a ~30-day grind; blocklist delisting is 30-90 days and ISPs remember.",
    resolution:
      "1) STOP sending for a few days. 2) Restart with a MANUAL slow warmup. 3) Ensure DMARC on all sending domains. 4) Adhere to Gmail/Microsoft/Yahoo guidelines. 5) Remove unengaged recipients; improve content. 6) Monitor engagement recency. 7) Subscribe to FBLs (Postmaster Tools, SNDS, CFL). 8) Contact provider support if blocklisted.",
    prevention: "Automate steps 1-2-3-7 (auto-pause on spike, slow re-warm, verify DMARC, wire FBLs) so recovery isn't a manual scramble.",
    ref: "SCN-12 / field-05 §E (SendGrid official runbook)",
  },
  {
    id: "SCN-13",
    title: "Mysterious mass-unsubscribes — users say they never clicked (GET unsubscribe footgun)",
    keywords: ["mass unsubscribe", "never clicked", "unsubscribe", "scanner", "safe links", "prefetch", "one-click"],
    diagnosis:
      "The one-click unsubscribe endpoint honors GET. Security scanners, Outlook Safe Links rewriters, and Gmail image-prefetchers PRELOAD the URL, silently triggering unsubscribes — the exact problem RFC 8058 prevents.",
    resolution:
      "Make the unsubscribe endpoint POST-ONLY. GET shows at most an info page and never unsubscribes. Ensure DKIM h= covers List-Unsubscribe + List-Unsubscribe-Post. Use opaque (Sqids/signed) IDs so enumeration can't unsubscribe arbitrary users.",
    prevention: "Default the one-click flow to POST-only with opaque IDs and DKIM-covered headers, and ONLY on the marketing stream (O-05/O-06).",
    ref: "SCN-13 / OPINIONS O-05/O-06 / PIT-06 / field-06 §A",
  },
  {
    id: "SCN-14",
    title: "We failed our own SPF policy on our own transactional email (the Upwork class)",
    keywords: ["own spf", "failed our own", "esp missing from spf", "mailgun", "upwork", "system emails fail spf"],
    diagnosis:
      "When you route transactional mail through an ESP, the ESP's sending IPs must be in your SPF record (via the ESP's include:). Add the ESP but forget the SPF entry and your own mail fails your own policy.",
    resolution: "Add the ESP's include: to SPF (mind the 10-lookup limit, SCN-03) AND align DKIM/DMARC. Verify with a MACRO-aware checker, not a crappy online tool.",
    prevention: "Enumerate and authenticate EVERY sender path; being a big company doesn't make it right — Upwork shipped this broken (O-26).",
    ref: "SCN-14 / OPINIONS O-26 / field-03 THREAD-3",
  },
  {
    id: "SCN-15",
    title: "SES sandbox-exit request keeps getting denied with no reason",
    keywords: ["ses", "sandbox", "production access", "denied", "security reasons", "negative impact", "sandbox exit"],
    diagnosis:
      "Almost always a quality-of-NARRATIVE failure. The reviewer needs crisp, specific answers to four questions; vague word-salad (especially on bounce handling) gets auto-denied. Also: missing landing page/privacy policy (they inspect your site), and DNS auth not yet in place.",
    resolution:
      "Before re-requesting: (1) put SPF+DKIM+DMARC in place (2024 prerequisite); (2) ensure a professional site + privacy policy; (3) answer all four questions with specifics — business nature + SES use, how addresses are collected, exact subscribe/unsubscribe flow, and a CONCRETE bounce/complaint handling description (consume webhook → suppress → never re-send).",
    prevention: "Don't request sandbox exit until auth + site + a real bounce handler exist. Never submit a vague free-text answer (O-17/O-25).",
    ref: "SCN-15 / OPINIONS O-17/O-25 / PIT-13 / field-04 §A",
  },
  {
    id: "SCN-16",
    title: "Open/click rates look great but engagement-based decisions misfire (bot pollution)",
    keywords: ["open rate", "click rate", "engagement", "bot", "apple mpp", "link rewriter", "opens high conversions flat"],
    diagnosis:
      "Apple Mail Privacy Protection, corporate link-rewriters, and security scanners pre-fetch images/links, inflating opens/clicks. Resend is adding bot-click filtering (#901) because raw engagement is polluted.",
    resolution: "Strip known scanner/bot traffic before using engagement signals; prefer POST-confirmed actions + downstream conversions over raw opens; don't make reputation/warmup decisions on unfiltered open/click.",
    prevention: "Treat raw open/click as untrusted for any reputation-affecting decision; filter first (O-21).",
    ref: "SCN-16 / OPINIONS O-21 / PIT-24 / field-02 §D",
  },
  {
    id: "SCN-17",
    title: "DKIM fails on the recipient side, but only for some corporate recipients (not-your-fault)",
    keywords: ["dkim fails", "corporate", "only some recipients", "enterprise outlook", "rewrite", "disclaimer footer", "intermittent dkim"],
    diagnosis:
      "A corporate Outlook / mail-filtering chain is REWRITING the message (disclaimer footer, Safe Links rewrite, header normalization) and THEN checking DKIM on its own modified copy. Any tampering invalidates the signature. The failure is upstream, not in your signer.",
    resolution:
      "Confirm your own signature is valid at the sending edge (sign LAST, after all your own mutations; stable h= + canonicalization). Then recognize the remaining failures as recipient-side rewrites you do NOT control — don't keep 'fixing' a correct config. Relaxed canonicalization (c=relaxed/relaxed) tolerates some reformatting.",
    prevention: "Use relaxed canonicalization; sign as the last step; know this failure mode so you don't burn hours chasing your own (correct) config (PIT-12).",
    ref: "SCN-17 / PIT-12 / field-03 THREAD-1",
  },
  {
    id: "SCN-18",
    title: "Domain status keeps flipping to unverified + duplicate webhooks (the verify poll-loop)",
    keywords: ["status flips", "unverified", "duplicate webhooks", "verify loop", "poll verify", "domains.verify", "status resets"],
    diagnosis:
      "Resend's /verify is NOT idempotent (#823) — calling it resets DNS/domain status and triggers webhooks unnecessarily. Treating verify as a read-only status poll is the mistake; it's a MUTATING operation.",
    resolution:
      "Stop calling verify in a loop. To CHECK status, dig the DNS records yourself out-of-band (they're public) — don't gate go-live on the provider's mutable flag (which can also return a stale cache, #775). Call verify exactly once, on initial DNS setup.",
    prevention: "Never poll a mutating provider endpoint to read status. pigeon checks SPF/DKIM/DMARC via dig (O-11).",
    ref: "SCN-18 / OPINIONS O-11 / PIT-21/PIT-04 / field-02 §C",
  },
  {
    id: "SCN-19",
    title: "AWS paused SES sending 'under review' after a bad batch (shared-pool suspension)",
    keywords: ["ses", "under review", "sending paused", "bad batch", "shared pool", "bounce ceiling", "aws paused"],
    diagnosis:
      "SES gives a SHARED-IP pool by default and makes reputation YOUR job, but still enforces a >5% bounce / >0.1% complaint ceiling and pauses you on a shared pool to protect other customers. Worst-of-both-worlds for a naive sender.",
    resolution:
      "Immediately STOP the offending stream; pull bounce/complaint data from the SES reputation dashboard / SNS events; suppress the hard bounces; respond to AWS with a concrete remediation (what segment caused it, the suppression applied, the auto-pause added). Then follow the 30-day recovery grind (SCN-12). For deliverability-critical mail, consider moving transactional to a curated provider.",
    prevention: "Auto-pause on bounce >5% / complaint >0.1% BEFORE AWS does (O-24); wire the SES reputation dashboard + SNS; never run marketing volume on the SES transactional account.",
    ref: "SCN-19 / OPINIONS O-24 / PIT-05 / field-04 §A4",
  },
];

export interface ScenarioMatch {
  scenario: Scenario;
  score: number;
}

/**
 * Match a free-text symptom against the scenario index. Scores by keyword hits (substring) +
 * a small bonus for title-word overlap. Returns the best match (or null if nothing scores).
 */
export function matchScenario(symptom: string): ScenarioMatch | null {
  const s = symptom.toLowerCase();
  let best: ScenarioMatch | null = null;
  for (const scenario of SCENARIOS) {
    let score = 0;
    for (const kw of scenario.keywords) {
      if (s.includes(kw)) score += kw.includes(" ") ? 3 : 2; // phrase hits weigh more
    }
    // title-word overlap (cheap tiebreaker).
    for (const w of scenario.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4)) {
      if (s.includes(w)) score += 1;
    }
    if (score > 0 && (best === null || score > best.score)) {
      best = { scenario, score };
    }
  }
  return best;
}
