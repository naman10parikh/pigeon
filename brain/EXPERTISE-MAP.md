---
title: "EXPERTISE-MAP — what the transactional-email employee must master"
type: synthesis
created: 2026-06-16
updated: 2026-06-16
tags: [expertise-map, deliverability, transactional-email, taste-node, pigeon]
sources:
  - "research/raw/field-00-internal-corpus.md"
  - "research/raw/field-01-github-react-email-rendering-gotchas.md"
  - "research/raw/field-02-resend-node-sdk-gotchas.md"
  - "research/raw/field-03-hn-deliverability-folklore-disputes.md"
  - "research/raw/field-04-ses-sandbox-stream-separation-2026-rules.md"
  - "research/raw/field-05-migration-war-stories-and-reddit-spam-postmortems.md"
  - "research/raw/field-06-list-unsubscribe-rfc8058-and-cloudflare-inbound-resolved.md"
summary: "The job-to-be-done map of the deliverability-correct sending layer pigeon owns, organized by mission not by vendor; every node cites its raw source."
related:
  - "[[OPINIONS]]"
  - "[[KNOWN-PITFALLS]]"
  - "[[BATTLE-TESTED-SCENARIOS]]"
  - "[[TOOL-MATRIX]]"
  - "[[GAPS-AND-DISPUTES]]"
---

# EXPERTISE-MAP — pigeon, the Transactional-email + notifications employee

> **What pigeon IS (the one-paragraph thesis):** pigeon is the *deliverability-correct sending layer*
> that sits ABOVE whichever provider SDK is wired. The fleet already has SDKs keyed (Resend in alpha,
> SendGrid+AgentMail in AgentDial) — but "keyed an SDK" ≠ "production-safe." pigeon owns the boring,
> business-critical 80%: domain authentication, stream separation, rendering correctness, bounce/
> complaint handling, warmup-as-control-loop, RFC-8058 unsubscribe, sandbox-exit narratives, and
> safe provider migration. Its failure mode is *silent until a user can't log in* — which is exactly
> why a domain-expert employee is justified. Source: `field-00` §2, §6.

> **How to read this map:** nodes are organized by **job-to-be-done**, never by tool. Each node names
> the mastery, the depth cue, and the raw source. A fresh Claude session that internalizes JTBD-1
> through JTBD-10 plus [[OPINIONS]] and [[KNOWN-PITFALLS]] becomes dangerous in this vertical.

---

## The mental model that ties it all together (read first)

Three load-bearing truths the rest of the map hangs on:

1. **Authentication is necessary but NOT sufficient.** Passing SPF/DKIM/DMARC does not get you to the
   inbox — reputation + engagement do. Average engineers stop at "auth passes." Great ones treat auth
   as the entry fee and reputation as the actual game. Source: `field-03` THREAD-1 (csomar, upofadown),
   TASTE section.
2. **Reputation contamination is asymmetric and brutal.** Marketing's spam complaints poison a SHARED
   reputation, and the victim is the *password reset* — the most business-critical mail. Stream
   separation is not politeness; it is protecting the critical path from the disposable path.
   Source: `field-04` §B3.
3. **Every control here is a loop, not a config.** Warmup, reputation recovery, and bounce-handling are
   feedback control problems (watch a signal, hold/back-off when it spikes), not static schedules.
   This is the single biggest reason a *domain-expert employee* beats a static template. Source:
   `field-04` §C3, `field-05` §E.

---

## JTBD-1 — Authenticate a sending domain (SPF + DKIM + DMARC, and the thing everyone misses: ALIGNMENT)

The entry fee. As of 2024 this is a *prerequisite*, not an afterthought (the ordering inverted — see
JTBD-7). The 2026 enforcement reality makes it mandatory across three providers.

- **1.1 SPF — and its hard 10-DNS-lookup ceiling.** SPF has a HARD 10-lookup limit (RFC 7208 §4.6.4).
  Every `include:` (ESP, marketing, billing) counts; adding one more ESP can silently break SPF for
  ALL mail. This is the #1 SPF footgun. Flatten where safe; minimize includes. Source: `field-03`
  THREAD-3 hard-rules (KomoD), TASTE.
- **1.2 DKIM — a signature that breaks when anything rewrites the body.** DKIM is a weak digital
  signature; *any* tampering invalidates it — including a legitimate relay re-signing, or corporate
  middleware rewriting headers/body BEFORE checking the signature on its own modification. Your
  signature failing isn't always your fault. Source: `field-03` THREAD-1 (jeroenhd), THREAD-2
  (RedShift1).
- **1.3 DMARC — and ALIGNMENT, the thing SPF/DKIM don't give you.** SPF/DKIM can PASS while DMARC
  FAILS because the authenticated domain doesn't *align* with the visible `From:` domain. Alignment
  can be relaxed (subdomain OK) or strict (exact domain). Third-party senders (helpdesk, billing,
  marketing ESP) on a different domain fail alignment — this is the #1 reason "I set up SPF and DKIM
  but DMARC still fails." Source: `field-03` THREAD-2 (brewmarche), gotcha-summary.
- **1.4 DMARC policy vocabulary (don't conflate with alignment).** Policy is `p={none, quarantine,
  reject}` — there is no "strict policy." People conflate DMARC *policy* with SPF/DKIM *alignment*
  strictness; they are distinct concepts. Source: `field-03` THREAD-3 (winstonwinston).
- **1.5 Third-party sender enumeration before `p=reject`.** You WILL forget one (the helpdesk, the
  billing system, the marketing ESP). Enumerate every system that sends as your domain BEFORE
  tightening policy. DMARC aggregate reports are the tool that finds the gap. Source: `field-03`
  THREAD-2 (zippergz), TASTE.
- **1.6 Don't trust the provider's "verified" flag — dig it yourself.** Resend's `domains.get` can
  return a stale/cached DNS status (#775). Verify authentication out-of-band with an actual DNS query;
  never poll the provider's cached "verified" boolean and trust it. Source: `field-02` §C #775, §E.2.

## JTBD-2 — Separate the streams (transactional vs marketing vs cold-outreach) — the signature taste

The single highest-leverage architectural decision. Average engineer sends password-resets and the
monthly newsletter from `noreply@app.com` on one SendGrid key. That conflates reputation and lets a
bad campaign sink critical mail.

- **2.1 Why filtering punishes mixed streams.** "If you use the same servers and email address to send
  both broadcast and transactional email, filtering systems like Gmail's may classify it ALL as bulk
  email." Source: `field-04` §B1 (Postmark, verbatim).
- **2.2 The correct shape — separate subdomains, ideally separate providers/pools.**
  `notifications.app.com` (transactional, Postmark/Resend) vs `news.app.com` / `mail.app.com`
  (marketing, a different provider/pool). pigeon enforces this by default. Source: `field-04` §B3.1.
- **2.3 The contamination mechanism (memorize this sentence).** "When a marketing campaign goes out
  and some recipients mark it as spam, the sending IP's reputation drops, and password reset emails
  sharing that same IP start landing in spam folders." Source: `field-04` §B2.
- **2.4 Stream-tagging is a CORE PRIMITIVE, not metadata.** Many downstream decisions (unsubscribe
  headers JTBD-6, provider routing JTBD-8, warmup JTBD-5) are *functions of the message's stream*.
  pigeon cannot be correct unless every outbound message carries its stream tag. Source: `field-06`
  §A5, `field-05` §D, `field-04` §B.
- **2.5 The dark side: routing cold/marketing through a transactional provider is account-DEATH.**
  Postmark/Mailgun *suspend the whole account* — transactional included — for a single cold/bulk blast.
  This is a HARD-REFUSE guardrail, not a tuning knob. See JTBD-8.3. Source: `field-05` §D.

## JTBD-3 — Render correctly (because broken rendering trains the spam filter against you)

Rendering correctness IS a deliverability input. A broken-rendering email (empty body in Gmail,
blown-out Outlook button, stripped Tailwind) gets deleted/marked-spam by humans, which trains the
mailbox provider's reputation model AGAINST you. Source: `field-01` header rationale.

- **3.1 Gmail strips `<style>` media queries — inline everything.** Responsive Tailwind breakpoints
  silently no-op in Gmail (#2712). Tailwind print styles collide with Gmail's sanitizer (#3480).
  Inline every style; never trust `<style>` blocks, media queries, or Tailwind breakpoints to survive
  Gmail. Source: `field-01` §A, extracted taste rule.
- **3.2 The preheader (`<Preview>`) can blank the entire email.** A `<Preview>` bug rendered the ENTIRE
  email blank in Gmail (#1785) — a total-delivery-failure-class rendering bug. Preheader length must be
  tuned to the client's truncation (Gmail ~200 chars, the component pads to 150) (#2268). Source:
  `field-01` §A rows 1785, 2268.
- **3.3 Gmail iOS dark mode force-inverts your background.** Gmail iOS auto-inverts/forces background
  colors (#1863) — your branded email looks wrong on a huge share of opens, and it's largely
  uncontrollable. Design for it; don't rely on a background color carrying meaning. Source: `field-01`
  §A row 1863.
- **3.4 Outlook-on-Windows is the Microsoft Word HTML engine, not a browser.** Buttons need VML
  "bulletproof button" markup (#2373, #1512); web fonts don't work — falls back to Times New Roman
  (#1269, #1131); backgrounds need table-cell `bgcolor`, not `<body>`/`<div>` bg (#662). Source:
  `field-01` §B, extracted taste rule.
- **3.5 A component-lib version bump can silently regress Outlook.** Bumping `@react-email/components`
  past v0.29 broke buttons in Outlook 2016/2019 (#1813); padding regressed in Outlook desktop (#1512).
  Pin the component lib; re-test Outlook on every bump. Source: `field-01` §B rows 1813, 1512.
- **3.6 Tailwind-for-email is a leaky abstraction.** `@react-email/tailwind` inlines at build time but
  breakpoints/print/safelist edge-cases leak (defining a `safelist` leaked raw `@tailwind` directives
  into HTML, #1907). Treat it as convenience, verify the output. Source: `field-01` §A row 1907.

## JTBD-4 — Handle bounces, complaints, and feedback loops (the operational survival core)

This is "deliverability-correct" made operational. It is what SES's sandbox gate, Mailgun's AUP, and
SendGrid's recovery runbook ALL independently demand. Source: `field-06` §C.

- **4.1 Consume the bounce/complaint webhook and SUPPRESS.** Hard-bounced addresses must be suppressed
  and never re-sent to. SNS for SES, webhook for Resend. A real handler = consume → suppress → never
  re-send. Vague "we handle bounces" answers fail the SES gate (see JTBD-7). Source: `field-06` §C.1.
- **4.2 The thresholds are survival lines, not hygiene.** Mailgun's AUP enforces ~0.1% complaints and
  5% bounces. Gmail/Yahoo: 0.1% complaint = "danger zone," 0.3% = blocklist risk (3 complaints per
  1,000). A single bad segment can cross it. Source: `field-04` §C1, `field-05` §D.
- **4.3 Auto-pause on spike.** On complaint-rate >0.1% or bounce >5%, HOLD sending — don't push through.
  Source: `field-06` §C bounce/FBL minimum.
- **4.4 Wire all three feedback loops by default.** Google Postmaster Tools, Microsoft SNDS, Yahoo CFL
  are the ONLY way to see complaint rate *before* it tanks you. Source: `field-05` §E.7, `field-06` §C.3.
- **4.5 Bot opens/clicks pollute engagement — strip before using as signal.** Apple MPP, corporate
  link-rewriters, and security scanners inflate opens/clicks. Resend is adding bot-click filtering
  (#901). Don't trust raw open/click for reputation/warmup decisions. Source: `field-02` §D #901, §E.4.

## JTBD-5 — Warm up and manage reputation (a control loop, not a schedule)

- **5.1 Slow is fast.** "Sending 50,000 emails from a cold IP on day one is the fastest way to get
  blacklisted." Doubling volume daily often outpaces the speed mailbox providers update reputation
  models — so slow is fast. Source: `field-04` §C3.
- **5.2 The throttle SIGNAL to watch: 421/450 deferrals.** "A spike in soft bounces/deferrals (code
  421 or 450) from a specific provider means they're throttling you — the hallmark sign of a
  reputation concern during warmup." Watch deferral rate PER-PROVIDER. Source: `field-04` §C3.
- **5.3 The actual mistake is doubling-on-schedule while being deferred.** It's not "warming too slow."
  If a provider is deferring you, HOLD volume until it clears — don't follow the doubling schedule
  blindly. This is the loop. Source: `field-04` §C3 lesson.
- **5.4 Reputation does NOT transfer between providers.** Migrating to a new provider/subdomain means
  warming from zero — the old reputation is gone. Source: `field-05` §B.5, §C.
- **5.5 Domain reputation > IP reputation.** Spammers burn IPs faster than domains, so providers weight
  domain reputation more. Don't fetishize a dedicated IP; protect the sending subdomain. (Postmark says
  this *against* their own dedicated-IP up-sell.) Source: `field-04` §B1, §B3.2.
- **5.6 Recovery is a ~30-day grind.** Internal reputation restores quickly; external recovery with
  recipient servers takes ~one month of consistent good sending. Blocklist delisting: 30-90 days, and
  ISPs remember. Named lists: Spamhaus SBL/XBL, Barracuda BRBL, Proofpoint/Cloudmark, Suomispam.
  Source: `field-05` §E, `field-04` §C3, `field-05` §F.

## JTBD-6 — One-click unsubscribe done correctly (RFC 8058) — the most-gotten-wrong header

Mandatory for MARKETING mail under the 2024 Gmail/Yahoo rules. It is not "add a header" — there's an
HTTP-method contract, a DKIM-coverage requirement, and an enumeration attack surface.

- **6.1 POST-only, never GET.** "Make sure that your HTTPS URL only supports HTTP POST — you don't want
  rogue crawlers accidentally triggering an unsubscribe." Scanners/link-rewriters/image-prefetchers
  that touch a GET URL will silently mass-unsubscribe your users. Source: `field-06` §A1.
- **6.2 DKIM `h=` MUST cover `List-Unsubscribe` and `List-Unsubscribe-Post`.** Add the headers AFTER
  signing, or omit them from the `h=` tag, and Gmail/Yahoo ignore the one-click button — non-compliant
  despite having the header. Source: `field-06` §A2.
- **6.3 Exact format, no confirmation page, no redirect.** `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click` and `List-Unsubscribe: <https://url>, <mailto:fallback>`. A confirmation
  page / extra click / redirect chain loses the "one-click" experience and hurts deliverability.
  Source: `field-06` §A3.
- **6.4 Opaque unsubscribe IDs.** `?unsubscribe=user_id=42` lets anyone unsubscribe anyone by
  incrementing. Encode it (Sqids / signed token). Source: `field-06` §A4.
- **6.5 Stream coupling.** One-click is for MARKETING only — transactional (password reset, receipt)
  must NOT carry it. Adding List-Unsubscribe to a password-reset is wrong; omitting it from a
  newsletter is a 2024 violation. Honor within 2 days. Source: `field-06` §A5, §A checklist.

## JTBD-7 — Get out of the SES sandbox / win production access (a narrative-quality problem)

- **7.1 The denial is almost always a quality-of-narrative failure, not technical.** The reviewer is a
  human (or human-gated model) on Trust & Safety needing a crisp bounce-handling + opt-in + unsubscribe
  story. A vague free-text answer is the #1 cause of the "denied, no reason, security reasons" loop.
  Source: `field-04` §A1.
- **7.2 The four gating questions (answer each with specifics).** (1) Nature of your business + how
  you'll use SES; (2) how you collect addresses; (3) how subscribe/unsubscribe works; (4) **how you
  handle bounces and complaints.** Source: `field-04` §A1 (AWS Trust & Safety, verbatim).
- **7.3 The ordering inverted in 2024 — auth BEFORE you ask.** Pre-2024 folklore = "get out of sandbox,
  then set DNS." 2024+ reality = SPF+DKIM+DMARC must be in place as a PREREQUISITE to the request.
  Source: `field-04` §A3.
- **7.4 They look at your website.** "Lacking professional appearance — missing landing pages, absent
  privacy policies." AWS literally inspects your site. Source: `field-04` §A2 (Waypoint).
- **7.5 SES is the worst-of-both-worlds for a naive sender.** Shared-IP pool by default + reputation is
  YOUR job + suspension on >5% bounce / >0.1% complaint. Unlike Postmark/Resend, SES doesn't curate
  the pool for you but still punishes you on it. Source: `field-04` §A4.
- **7.6 pigeon generates the narrative.** Because pigeon implements the bounce/opt-in/unsubscribe
  handling, it can author the production-access narrative for the user. Source: `field-04` §A1 lesson.

## JTBD-8 — Migrate providers safely (the provider-abstraction layer earns its keep here)

- **8.1 Migrations are COST- or DX-driven, not deliverability-driven.** SendGrid→SES is the canonical
  cost migration (SES free vs ~$20 SendGrid at low volume); →Resend is the DX migration. The migrant
  wrongly assumes deliverability "just carries over." Source: `field-05` §A.
- **8.2 The real switching cost is 10-20 hours minimum.** Re-verify domains, update DNS, rewrite
  integration code, re-test EVERY template, warm up new IPs. Behind a proper abstraction the code
  rewrite is one file; without it, app-wide. Source: `field-05` §B.
- **8.3 HARD-REFUSE marketing/cold through a transactional-only provider.** Routing cold through
  Postmark/Mailgun isn't a deliverability risk — it's an account-death risk (whole-account suspension,
  transactional included). pigeon tags the stream and refuses. Source: `field-05` §D.
- **8.4 Export logs BEFORE flipping DNS — retention windows are tiny.** Resend Free=1 day, Pro=3,
  Scale=7; Postmark=45 days. No native migration tool; history doesn't transfer. Source: `field-05` §C.
- **8.5 Resend has no warmup tooling / no auto-pause-on-bounce.** Migrating TO Resend means you own
  warmup manually — you can blocklist a fresh domain in a day by blasting on arrival. pigeon supplies
  the warmup control loop the provider lacks. Source: `field-05` §C.
- **8.6 The full migration checklist** lives in [[BATTLE-TESTED-SCENARIOS]] SCN-08. Source: `field-05` §B.

## JTBD-9 — Inbound email (replies, parsing) — Cloudflare Email Routing → webhook → gateway

- **9.1 The designed split.** Energy's intended architecture: **Resend = outbound** (transactional
  send), **Cloudflare Email Routing = inbound** (free forwarding → webhook → AgentDial gateway).
  ~$0.50/agent/month amortized. Source: `field-06` §B, `field-00` §5 UPDATE.
- **9.2 Inbound forwarding (CF Email Routing) is mature + free; CF outbound *send* is newer/less
  proven** (was private beta as of 2025-09; lacks native SPF-flattening). Prefer Resend for outbound.
  Source: `field-06` §B.
- **9.3 Idempotency is coming to inbound forwarding too** (#967) — dedupe inbound events. Source:
  `field-02` §D #967.
- **9.4 The internal echo: per-tenant identity for inbound.** The AgentMail per-user-key webhook bug —
  a shared platform key processed ALL tenants' inbound replies under the platform identity, a
  cross-tenant leak. Isolate sending+inbound identity per tenant from day one. Source: `field-00` §1.
- **CAVEAT:** the inbound war-story corpus is THIN — design intent is confirmed, but no executed CF
  Email Routing POC with a written postmortem exists internally. pigeon should generate fresh evidence
  by wiring it. Source: `field-06` §B resolution, [[GAPS-AND-DISPUTES]] G-09.

## JTBD-10 — SDK safety + idempotency (provider-abstraction discipline)

- **10.1 Pin the SDK; treat a minor bump as a deploy-risk event — especially on edge/serverless.**
  resend-node v6.9.0 added `mailparser`, which broke Cloudflare Workers, Convex, and Nuxt-Nitro on a
  minor bump (#837/#826/#824/#817). The fix on CF Workers is `nodejs_compat`. Source: `field-02` §A.
- **10.2 `@react-email/render` is NOT actually optional — install it explicitly.** Turbopack/Webpack/
  Vite each resolve the "optional" peer differently → "Module not found" (#905/#629/#625). Source:
  `field-02` §B.
- **10.3 Default to idempotency keys on EVERY send.** Survive retries without double-sending (which
  inflates volume + complaints). Source: `field-02` §D #967, §E.3, `field-06` §C.4.
- **10.4 Keep a raw-REST escape hatch.** When the SDK misbehaves (e.g. `contacts.remove()`
  `missing_api_key` despite a valid key while cURL works, #644), fall back to direct HTTP. Source:
  `field-02` §C #644, §E.5.
- **10.5 Don't assume API keys are forever.** Keys can silently stop working (#662) — build
  auth-failure alerting + rotation. Source: `field-02` §C #662.
- **10.6 Verifying DNS is not idempotent on Resend.** Calling `/verify` reset domain status and spammed
  webhooks (#823). Don't call verify in a loop. Source: `field-02` §C #823.

---

## What pigeon inherits from the fleet's own scar tissue (the internal corpus)

- **Per-tenant sending identity from day one** — the AgentMail bug proved a shared key conflates
  reputation AND leaks replies across tenants. The shared *platform* key also hit a hard **3-inbox
  limit** — a literal scaling wall — which is the operational tell that a shared-key architecture
  doesn't scale, independent of the security leak. Source: `field-00` §1, §6.1.
- **"Keyed" ≠ "done"** — Resend-keyed-in-alpha is the easy 20%; deliverability correctness is the 80%
  pigeon owns. Source: `field-00` §2, §6.2.
- **Multi-provider abstraction already exists** (SendGrid + AgentMail in AgentDial) — own a
  provider-agnostic layer so A→B is a config change. Source: `field-00` §3, §6.3.
- **This is the boring infra builders skip** — which is the entire justification for a domain-expert
  employee. Source: `field-00` §2 swarm lesson, §6.4.
- **Where pigeon sits in the fleet:** transactional email is a FACE of Identity (#1, owned by AgentDial)
  on the reachability axis AND a C2 operational-infra item — pigeon spans both: the *channel* and the
  *deliverability-correctness infra*. Source: `field-00` §4.

---

## Mastery self-test (a fresh session should be able to answer all of these from brain/ alone)

1. Why can SPF+DKIM both PASS while the mail still fails DMARC? → alignment, JTBD-1.3.
2. What's the one signal that tells you a provider is throttling your warmup? → 421/450 deferrals, JTBD-5.2.
3. Why must the one-click unsubscribe endpoint be POST-only? → scanner auto-unsubscribe, JTBD-6.1.
4. Why is routing one cold-email blast through Postmark catastrophic? → whole-account suspension, JTBD-8.3 / JTBD-2.5.
5. What do you do BEFORE flipping DNS to a new provider? → export logs (1-7 day retention), JTBD-8.4.
6. Why doesn't a dedicated IP "fix" deliverability? → domain reputation dominates, JTBD-5.5.
7. What's the #1 reason SES sandbox-exit requests get denied? → vague bounce-handling narrative, JTBD-7.1.
8. Why is a Tailwind breakpoint unsafe in an email? → Gmail strips `<style>` media queries, JTBD-3.1.
9. Why pin the email SDK? → minor bump (v6.9.0/mailparser) broke edge runtimes, JTBD-10.1.
10. Why can't you trust `domains.get` saying "verified"? → stale cache (#775); dig DNS yourself, JTBD-1.6.
