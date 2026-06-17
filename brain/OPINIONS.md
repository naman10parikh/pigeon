---
title: "OPINIONS — pigeon's taste stances (the anti-slop layer)"
type: synthesis
created: 2026-06-16
updated: 2026-06-16
tags: [opinions, taste, anti-slop, deliverability, stances, pigeon]
sources:
  - "research/raw/field-00-internal-corpus.md"
  - "research/raw/field-01-github-react-email-rendering-gotchas.md"
  - "research/raw/field-02-resend-node-sdk-gotchas.md"
  - "research/raw/field-03-hn-deliverability-folklore-disputes.md"
  - "research/raw/field-04-ses-sandbox-stream-separation-2026-rules.md"
  - "research/raw/field-05-migration-war-stories-and-reddit-spam-postmortems.md"
  - "research/raw/field-06-list-unsubscribe-rfc8058-and-cloudflare-inbound-resolved.md"
summary: "Explicit always-X/never-Y stances with the reason and the source. This is what separates pigeon's taste from a Wikipedia summary."
related:
  - "[[EXPERTISE-MAP]]"
  - "[[KNOWN-PITFALLS]]"
  - "[[GAPS-AND-DISPUTES]]"
---

# OPINIONS — what pigeon believes (and refuses)

> These are STANCES, not facts — held with reasons and sources, revisable by evidence. Each is
> phrased so a fresh session can apply it as a decision rule. Where a stance is contested, it links to
> [[GAPS-AND-DISPUTES]]. The strongest opinions here are the *against-interest* ones (a vendor arguing
> against its own up-sell) and the *counterintuitive* ones (slow is fast; POST-only).

---

## O-01 — ALWAYS separate transactional and marketing streams. NEVER co-mingle them.
**Stance:** transactional and marketing get separate subdomains, and ideally separate providers/IP
pools, from day one.
**Because:** filtering systems classify mixed streams as bulk, and marketing's spam complaints poison a
shared reputation — the victim is the password reset, the most business-critical mail. The contamination
is asymmetric and brutal: the disposable stream sinks the critical one.
**Source:** `field-04` §B (Postmark, verbatim). **Strength:** near-axiom; this is the signature taste.

## O-02 — NEVER route cold/marketing through a transactional-only provider. This is a HARD-REFUSE, not a knob.
**Stance:** pigeon tags every message's stream and REFUSES to send anything tagged `cold`/`marketing`
through Postmark or Resend-transactional.
**Because:** it's not a deliverability risk — it's account-death. Postmark/Mailgun suspend the WHOLE
account (transactional included) "within days." One blast can kill your password-reset pipeline.
**Source:** `field-05` §D. **Strength:** absolute guardrail.

## O-03 — Rendering correctness IS a deliverability input. Treat a broken template as a deliverability bug, not a cosmetic one.
**Stance:** a template that renders blank in Gmail or breaks in Outlook is a P0 deliverability defect.
**Because:** humans delete/mark-spam broken emails, which trains the mailbox provider's reputation model
against you. Rendering is upstream of reputation.
**Source:** `field-01` header rationale. **Strength:** strong; reframes "it's just CSS."

## O-04 — In email HTML, ALWAYS inline every style. NEVER trust `<style>` blocks, media queries, or Tailwind breakpoints.
**Stance:** inline styles are the only safe path; Tailwind-for-email is a leaky build-time convenience to
be verified, not trusted.
**Because:** Gmail strips `<style>` media queries; Tailwind breakpoints silently no-op; a `safelist`
leaks raw `@tailwind` directives.
**Source:** `field-01` §A. **Strength:** strong, version-proven (#2712, #1907).

## O-05 — The one-click unsubscribe endpoint is ALWAYS POST-only. GET NEVER unsubscribes.
**Stance:** GET shows at most an info page; only POST mutates. IDs are opaque (Sqids/signed). DKIM `h=`
covers the List-Unsubscribe headers.
**Because:** scanners, link-rewriters, and image-prefetchers preload GET URLs and silently
mass-unsubscribe — the exact thing RFC 8058 exists to prevent.
**Source:** `field-06` §A1, §A2, §A4. **Strength:** strong, counterintuitive (people default to GET links).

## O-06 — One-click unsubscribe is for MARKETING mail ONLY. NEVER add it to transactional mail.
**Stance:** stream determines the header policy. List-Unsubscribe on a password-reset is wrong; omitting
it from a newsletter is a 2024 violation.
**Because:** the 2024 Gmail/Yahoo rule scopes one-click to marketing/promotional; transactional is
exempt. You can't apply it correctly without knowing the stream.
**Source:** `field-06` §A5, `field-04` §C1. **Strength:** strong; reinforces stream-tagging as a primitive.

## O-07 — Domain reputation > IP reputation. NEVER fetishize a dedicated IP.
**Stance:** protect the sending subdomain's reputation first; a dedicated IP is not a silver bullet.
**Because:** spammers burn IPs faster than domains, so providers weight domain reputation more — and
Postmark says this AGAINST its own dedicated-IP up-sell. The rare against-interest signal.
**Source:** `field-04` §B1, §B3.2. **Strength:** strong, against-interest.

## O-08 — Warmup is a CONTROL LOOP, not a fixed schedule. "Slow is fast."
**Stance:** watch the 421/450 deferral rate per-provider; if it spikes, HOLD volume — don't follow the
doubling schedule.
**Because:** the failure mode is doubling-on-schedule WHILE a provider is already deferring you; doubling
outpaces how fast providers update reputation models.
**Source:** `field-04` §C3. **Strength:** strong, counterintuitive; this is why a domain-expert beats a
static template.

## O-09 — Authentication is necessary but NOT sufficient. NEVER claim "deliverability solved" because auth passes.
**Stance:** SPF/DKIM/DMARC is the entry fee; reputation + engagement decide inbox placement.
**Because:** practitioners with their own servers report needing reputation beyond auth; passing auth
does not place you in the inbox.
**Source:** `field-03` THREAD-1, TASTE. **Strength:** strong (the central taste); see [[GAPS-AND-DISPUTES]]
G-01 for the FUD-vs-real dispute on *how opaque* reputation is.

## O-10 — DMARC ALIGNMENT, not just SPF/DKIM pass, is what actually matters.
**Stance:** verify alignment with the visible `From:`, not just that SPF/DKIM passed somewhere.
**Because:** third-party senders pass SPF/DKIM under their own domain yet fail DMARC alignment against
your `From:` — the #1 "I set up auth but DMARC still fails."
**Source:** `field-03` THREAD-2 (brewmarche). **Strength:** strong.

## O-11 — ALWAYS verify DNS auth yourself (dig it). NEVER trust the provider's cached "verified" flag.
**Stance:** dig SPF/DKIM/DMARC out-of-band before any go-live; the provider's status can lie.
**Because:** Resend `domains.get` returns stale/cached status (#775); `/verify` isn't idempotent (#823).
**Source:** `field-02` §C #775, #823. **Strength:** strong, version-proven.

## O-12 — PIN the email SDK. Treat every minor bump as a deploy-risk event, especially on edge/serverless.
**Stance:** the SDK lives behind one thin pigeon interface; bumps are tested on the target runtime before
merge.
**Because:** resend-node v6.9.0's `mailparser` broke Cloudflare Workers/Convex/Nuxt-Nitro on a MINOR
bump. A regression should be a one-file pin, not an app-wide outage.
**Source:** `field-02` §A, §E.1. **Strength:** strong, version-proven.

## O-13 — Default to idempotency keys on EVERY send.
**Stance:** every send carries an idempotency key by default.
**Because:** a retry after a network blip double-sends, inflating volume and complaints; the ecosystem is
moving this way (Resend adding it to inbound forwarding, #967).
**Source:** `field-02` §D #967, `field-06` §C.4. **Strength:** strong.

## O-14 — Keep a raw-REST escape hatch behind the abstraction.
**Stance:** when the SDK misbehaves, fall back to direct HTTP — and validate the wire shape with Zod at
the boundary.
**Because:** the SDK has returned `missing_api_key` while cURL with the same key works (#644), and
returned snake_case fields the type expected as camelCase → silent `undefined` (#842).
**Source:** `field-02` §C. **Strength:** moderate-strong.

## O-15 — Per-tenant sending identity from day one. NEVER a shared key/IP that conflates reputation or leaks replies.
**Stance:** isolate sending (and inbound) identity per tenant.
**Because:** the internal AgentMail bug proved a shared platform key processed all tenants' inbound
replies under the platform identity (cross-tenant leak) AND a shared pool means one bad tenant tanks
everyone.
**Source:** `field-00` §1, `field-05` §D (the structural pool reason). **Strength:** strong, internal scar.

## O-16 — A managed provider is the DEFAULT. Self-hosting your own mail server is an expert escape hatch, not a recommendation.
**Stance:** recommend a managed ESP by default; only an expert with low volume and perfect config should
self-host.
**Because:** self-host is technically possible but operationally fragile — every contributor agrees ONE
misconfig = instant blocklist (dw64 got on "all spam lists" from a day of being an open relay). The
deliverability win rarely justifies the time for someone whose business isn't email.
**Source:** `field-05` §G.1, §A (snozolli). **Strength:** strong; see [[GAPS-AND-DISPUTES]] G-08 for the
"is self-host viable" dispute (both sides).

## O-17 — For the SES sandbox exit, the NARRATIVE is the product. Author it; never submit vague free-text.
**Stance:** pigeon writes the production-access narrative — specific bounce-handling, opt-in, and
unsubscribe story — and ensures auth + site + privacy policy exist first.
**Because:** denials are overwhelmingly quality-of-narrative failures, not technical ones; AWS inspects
your website and wants concrete answers to four questions.
**Source:** `field-04` §A1-A3. **Strength:** strong.

## O-18 — Provider choice by job: Postmark for "must hit the inbox in seconds," Resend for "best DX on a modern stack," SES for "lowest cost at low volume."
**Stance:** there is no single best provider — match the provider to the job, behind the abstraction.
**Because:** the real-world decision axis is deliverability-focus (Postmark) vs DX (Resend) vs price
(SES), confirmed across HN migration threads and 2026 comparisons.
**Source:** `field-05` §A, §B. **Strength:** moderate (the 98.7% vs 95.3% benchmark is vendor-adjacent —
[[GAPS-AND-DISPUTES]] G-04 — so this stance is directional, not a hard ranking).

## O-19 — Export logs BEFORE flipping DNS on any migration.
**Stance:** the export is step zero of a migration, not an afterthought.
**Because:** retention windows are tiny (Resend 1-7 days) and there's no native migration tool — flip
first and the audit trail is gone.
**Source:** `field-05` §C. **Strength:** strong.

## O-20 — Ship for the FUTURE p=reject, not the bare 2024 minimum. NEVER treat `p=none` as "done."
**Stance:** build the alignment + complaint hygiene that survives quarantine/reject; assume enforcement
tightens.
**Because:** `p=none` was the 2024 floor; Gmail moved to hard rejection of non-compliant traffic in
Nov-2025; Outlook added an alignment mandate (May-2025). The direction of travel is one-way.
**Source:** `field-04` §C2. **Strength:** strong, currency-critical.

## O-21 — NEVER trust raw open/click as engagement for reputation decisions. Strip bots first.
**Stance:** filter scanner/MPP/link-rewriter traffic before using engagement for warmup/suppression/
reputation.
**Because:** Apple MPP and corporate rewriters inflate opens/clicks; Resend is adding bot-click filtering
(#901) because raw engagement is polluted.
**Source:** `field-02` §D #901. **Strength:** moderate-strong.

## O-22 — Prefer IPv4 to Gmail unless your IPv6 PTR + auth is flawless.
**Stance:** default Gmail sending to IPv4; only use IPv6 with perfect rDNS/PTR + auth.
**Because:** Gmail rejects IPv6 senders far more harshly ("works via IPv4 but rejects IPv6").
**Source:** `field-03` THREAD-2 (doctor_lollipop). **Strength:** moderate.

## O-23 — For inbound, default to Cloudflare Email Routing → webhook → gateway; prefer Resend for outbound over Cloudflare's outbound send.
**Stance:** outbound = Resend (mature); inbound = Cloudflare Email Routing (mature, free); do NOT use
Cloudflare's outbound *send* yet.
**Because:** CF Email Routing forwarding is mature and free; CF's outbound send was private beta as of
2025-09 and lacks native SPF-flattening. This is the energy-designed split.
**Source:** `field-06` §B, `field-00` §5. **Strength:** moderate; the inbound corpus is thin
([[GAPS-AND-DISPUTES]] G-09) — revisit once pigeon wires it.

## O-24 — Auto-pause on bounce/complaint spike is mandatory infrastructure, not a nice-to-have.
**Stance:** pigeon auto-pauses sending when bounce >5% or complaint >0.1-0.3% and wires all three FBLs
(Postmaster Tools, SNDS, CFL) by default.
**Because:** these thresholds are AUP/blocklist lines (3 complaints per 1,000 = the line), and FBLs are
the only pre-cliff visibility. Recovery is a ~30-day grind if you miss it.
**Source:** `field-04` §C1, `field-05` §D, §E, `field-06` §C. **Strength:** strong.

## O-25 — Authenticate the domain BEFORE requesting any provider's production access / sandbox exit. NEVER ask first and authenticate later.
**Stance:** SPF + DKIM + DMARC (and a professional site + privacy policy) must be in place as a
PREREQUISITE to a SES production-access request — not something you do after getting unblocked.
**Because:** the ordering inverted in 2024. Pre-2024 folklore was "get out of sandbox, then set DNS."
2024+ reality: AWS requires DNS auth in place before the request, and inspects your website. Asking
first is the fast path to the "denied, no reason" loop.
**Source:** `field-04` §A2, §A3. **Strength:** strong, currency-critical. Distinct from O-17 (which is
about the *narrative quality*); this is about the *ordering*.

---

## O-26 (Meta-stance) — Being big does NOT make a config right. Verify, never cargo-cult.
**Stance:** pigeon does not copy what large companies do; it verifies against the spec and its own
`dig`/reports.
**Because:** Upwork ships transactional email that fails its own SPF and survives; "big senders get
DMARC exceptions" is a widely *believed* but unconfirmed theory (avian). Being tolerated ≠ being correct.
**Source:** `field-03` THREAD-3 (Upwork, avian), [[GAPS-AND-DISPUTES]] G-02. **Strength:** strong; this
is the epistemic posture all other stances inherit.
