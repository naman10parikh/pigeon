---
title: "KNOWN-PITFALLS — version-specific gotchas with detection + avoidance"
type: synthesis
created: 2026-06-16
updated: 2026-06-16
tags: [pitfalls, gotchas, version-specific, deliverability, react-email, resend, ses, pigeon]
sources:
  - "research/raw/field-00-internal-corpus.md"
  - "research/raw/field-01-github-react-email-rendering-gotchas.md"
  - "research/raw/field-02-resend-node-sdk-gotchas.md"
  - "research/raw/field-03-hn-deliverability-folklore-disputes.md"
  - "research/raw/field-04-ses-sandbox-stream-separation-2026-rules.md"
  - "research/raw/field-05-migration-war-stories-and-reddit-spam-postmortems.md"
  - "research/raw/field-06-list-unsubscribe-rfc8058-and-cloudflare-inbound-resolved.md"
summary: "The gotcha list — each pitfall has a version/condition, a detection signal, and an avoidance. Version-specific where the source is."
related:
  - "[[BATTLE-TESTED-SCENARIOS]]"
  - "[[OPINIONS]]"
  - "[[EXPERTISE-MAP]]"
---

# KNOWN-PITFALLS

> Format: **PIT-NN — name** · `condition/version` · **Detect:** how you'd notice · **Avoid:** the fix.
> Sorted by blast radius (catastrophic → cosmetic). Version pins are stated where the source pinned
> them; "currency 2024-2026" everywhere unless flagged older.

---

## CATASTROPHIC (silent until a user can't log in, or whole-account death)

### PIT-01 — Mixing transactional + marketing on one IP/subdomain
- **Condition:** any sender using `noreply@app.com` on one key/pool for both streams.
- **Detect:** password-reset deliverability drops shortly after a marketing campaign; both streams share
  one DKIM selector / IP in DNS.
- **Avoid:** separate subdomains (`notifications.app.com` transactional vs `news.app.com` marketing),
  ideally separate providers/pools. Stream-tag every message. The victim of contamination is always
  the critical mail. Source: `field-04` §B.

### PIT-02 — Routing cold/marketing through a transactional-only provider
- **Condition:** sending cold outreach or bulk-to-unverified through Postmark or Mailgun.
- **Detect:** AUP language prohibiting "unsolicited"/"cold"; provider warning emails; sudden account
  review.
- **Avoid:** HARD-REFUSE this routing at the pigeon layer. Postmark/Mailgun suspend the WHOLE account
  (transactional included) "within days of detection." Migrate cold to a permissive provider on a
  separate domain BEFORE suspension. Source: `field-05` §D.

### PIT-03 — resend-node v6.9.0+ `mailparser` breaks edge/serverless runtimes
- **Condition:** `resend@>=6.9.0` on Cloudflare Workers / Convex / Nuxt-Nitro.
- **Detect:** build/deploy fails `Uncaught TypeError: Zv.hasOwnProperty is not a function` (#826), or
  Convex deploy break (#824), or generic 500 on send (#837).
- **Avoid:** enable `nodejs_compat` on CF Workers (#817) as the immediate fix; PIN the SDK version;
  isolate it behind pigeon's thin interface so the next regression is a one-file pin. Source: `field-02`
  §A.

### PIT-04 — Trusting `domains.get` "verified" (stale cache)
- **Condition:** Resend SDK `client.domains.get`.
- **Detect:** the dashboard/API says "verified" but mail still fails auth; status doesn't reflect a
  recent DNS change (#775).
- **Avoid:** DIG the DNS records yourself (out-of-band) to confirm SPF/DKIM/DMARC; never gate a
  go-live on the provider's cached verified flag. Source: `field-02` §C #775.

### PIT-05 — No bounce/complaint suppression → cross the AUP threshold → suspended
- **Condition:** any sender without a bounce/complaint webhook consumer + suppression list.
- **Detect:** bounce rate climbing toward 5% or complaint toward 0.1-0.3%; provider "sending paused" /
  "under review."
- **Avoid:** consume the bounce+complaint webhook → suppress hard bounces → never re-send → auto-pause
  on spike. 3 complaints per 1,000 (0.3%) is the Gmail/Yahoo blocklist line. Source: `field-04` §C1,
  `field-05` §D, `field-06` §C.

### PIT-06 — One-click unsubscribe endpoint honors GET (scanner auto-unsubscribe)
- **Condition:** marketing mail with a List-Unsubscribe URL that responds to GET (the Rails/Express
  default for a link).
- **Detect:** mysterious mass-unsubscribes; users insist they never clicked; spikes correlate with
  scanner/prefetch activity.
- **Avoid:** make the endpoint POST-ONLY (GET → info page at most). RFC 8058 exists exactly to stop
  preview/antivirus/prefetch URLs from silently unsubscribing. Source: `field-06` §A1.

### PIT-07 — SPF 10-DNS-lookup limit exceeded → SPF permerror for ALL mail
- **Condition:** SPF record with enough `include:`s (ESP + marketing + billing) to exceed 10 lookups.
- **Detect:** SPF starts failing for everything right after adding a sender; checker reports `permerror`.
  Note: many online checkers misreport because they don't evaluate SPF MACROS.
- **Avoid:** budget the 10 lookups like a hard resource; flatten nested includes to resolved IPs where
  safe; remove unused senders; use a macro-aware checker. Source: `field-03` THREAD-3 (KomoD).

### PIT-08 — DMARC alignment failure despite SPF+DKIM pass
- **Condition:** third-party sender (helpdesk, billing, marketing ESP) authenticating under its own
  domain while your `From:` is your domain.
- **Detect:** SPF=pass, DKIM=pass, DMARC=fail; mail quarantined; aggregate reports show an unaligned
  source.
- **Avoid:** align the third party (CNAME their DKIM under your subdomain + `From:` on your domain) or
  relax alignment if a subdomain match suffices; enumerate ALL senders before `p=reject`. Source:
  `field-03` THREAD-2 (brewmarche).

## SEVERE (deliverability cliff, hard to debug)

### PIT-09 — Reputation does NOT transfer on provider migration; blasting on arrival
- **Condition:** migrating to a new provider/subdomain and sending production volume immediately.
- **Detect:** fresh domain hits blocklist within a day; 421/450 deferrals from Gmail/Outlook spike.
- **Avoid:** warm from ZERO via the control loop; Resend has NO warmup tooling and NO auto-pause, so
  pigeon must supply it. Source: `field-05` §C.

### PIT-10 — Losing the sending audit trail on migration (tiny retention windows)
- **Condition:** switching OFF Resend (Free=1 day, Pro=3, Scale=7) or Postmark (45 days); no native
  migration tool.
- **Detect:** post-migration, you can't reconstruct who-got-what before the cutover.
- **Avoid:** EXPORT logs BEFORE flipping DNS, within the retention window. Source: `field-05` §C.

### PIT-11 — IPv6 to Gmail gets rejected
- **Condition:** sending to Gmail over IPv6 without perfect PTR + auth.
- **Detect:** "Sending to Gmail works via IPv4 but they reject anything I send via IPv6."
- **Avoid:** prefer IPv4 for Gmail, or ensure rDNS/PTR + SPF/DKIM/DMARC are flawless on the IPv6 path.
  Gmail treats IPv6 senders far more harshly. Source: `field-03` THREAD-2 (doctor_lollipop).

### PIT-12 — Corporate middleware rewrites the body, THEN checks DKIM → signature breaks
- **Condition:** mail traversing an Enterprise Outlook / corporate filtering chain.
- **Detect:** DKIM fails on the recipient side even though you signed correctly; only happens for
  certain corporate recipients.
- **Avoid:** largely outside your control — but know it's not always your fault. Don't burn hours
  "fixing" a DKIM config that's correct; the rewrite is upstream. Source: `field-03` THREAD-1
  (jeroenhd).

### PIT-13 — SES denial because the production-access NARRATIVE is vague
- **Condition:** requesting SES production access with word-salad answers (esp. on bounce handling), no
  privacy policy / landing page, or DNS auth not yet in place.
- **Detect:** "your use of Amazon SES could have a negative impact on our service" / "security reasons,"
  repeated denials.
- **Avoid:** auth FIRST (2024 prerequisite), professional site + privacy policy, and crisp specific
  answers to the four T&S questions — pigeon authors the bounce-handling narrative from what it
  implements. Source: `field-04` §A1-A3.

### PIT-14 — `@react-email/render` "optional" peer not installed → runtime render failure
- **Condition:** React-email sends with Turbopack/Webpack/Vite resolving the optional import.
- **Detect:** "Failed to render React component. Make sure to install `@react-email/render`" (#629);
  `this.renderAsync is not a function` (#616); "Module not found" under Turbopack (#625).
- **Avoid:** install `@react-email/render` EXPLICITLY and pin it; verify on the app's exact bundler.
  Source: `field-02` §B.

### PIT-15 — No idempotency key → double-send on retry inflates volume + complaints
- **Condition:** any send path that retries on network blip without an idempotency key.
- **Detect:** duplicate emails to the same recipient after a transient failure; volume higher than send
  count.
- **Avoid:** default idempotency keys on EVERY send (Resend is adding them to inbound forwarding too,
  #967). Source: `field-02` §D #967, `field-06` §C.4.

## RENDERING (trains the spam filter against you — see [[OPINIONS]] O-03)

### PIT-16 — Gmail strips `<style>` media queries / Tailwind breakpoints silently no-op
- **Condition:** responsive email relying on Tailwind breakpoints or `<style>` media queries in Gmail.
- **Detect:** layout correct in preview, broken/unstyled in Gmail web + Gmail iOS (#2712, #3480).
- **Avoid:** INLINE every style; don't trust media queries to survive Gmail's sanitizer. Source:
  `field-01` §A.

### PIT-17 — `<Preview>` blanks the entire email in Gmail
- **Condition:** certain values passed to react-email `<Preview>` (#1785); preheader length mismatch
  (#2268, pads to 150 while Gmail shows ~200).
- **Detect:** completely empty email body in Gmail; preheader truncated oddly.
- **Avoid:** sanitize/limit the `<Preview>` value; tune length to the client; pin a react-email version
  without the preheader bug. Source: `field-01` §A.

### PIT-18 — Outlook (Word engine) breaks buttons, ignores web fonts + backgrounds
- **Condition:** Outlook-on-Windows; `@react-email/components` > v0.29 (button regression #1813);
  padding regression (#1512).
- **Detect:** button + everything below it missing in Outlook (#2373); font is Times New Roman (#1269);
  `<body>` background ignored (#662).
- **Avoid:** VML bulletproof buttons + MSO conditionals; table-cell `bgcolor`; web-safe font stack; PIN
  `@react-email/components` and re-test Outlook on every bump. Source: `field-01` §B.

### PIT-19 — Tailwind `safelist` leaks raw `@tailwind` directives into HTML
- **Condition:** `@react-email/tailwind` with a `safelist` defined (#1907).
- **Detect:** raw `@tailwind` directives appear in the generated HTML; Gmail styling breaks.
- **Avoid:** remove the safelist or verify the inlined output; treat Tailwind-for-email as a leaky
  build-time convenience. Source: `field-01` §A.

### PIT-20 — Gmail iOS dark mode force-inverts backgrounds
- **Condition:** Gmail iOS client, dark mode (#1863).
- **Detect:** branded background color inverted/forced on a large share of opens.
- **Avoid:** design for forced inversion; don't rely on a background color carrying meaning; it's
  largely uncontrollable. Source: `field-01` §A.

## OPERATIONAL / API CONTRACT

### PIT-21 — Resend `/verify` is not idempotent (resets status + spams webhooks)
- **Condition:** calling `domains.verify` repeatedly (e.g. in a poll loop).
- **Detect:** domain status resets; duplicate/unnecessary webhooks fire (#823).
- **Avoid:** don't call verify in a loop; dig DNS to check status instead. Source: `field-02` §C #823.

### PIT-22 — API key silently stops working
- **Condition:** long-lived Resend API key (#662).
- **Detect:** sends start failing auth with no config change; regenerating the key fixes it.
- **Avoid:** build auth-failure alerting + a key-rotation path; don't assume keys are forever. Source:
  `field-02` §C #662.

### PIT-23 — SDK type/wire mismatch returns silent `undefined`
- **Condition:** `topics.list()` returns snake_case but the `Topic` type expects camelCase (#842);
  similar contacts.* docs-vs-impl drift (#812/#790/#854).
- **Detect:** every field on the object is `undefined` despite a 200 response.
- **Avoid:** validate the wire shape (Zod) at the SDK boundary; when the SDK lies, fall back to raw REST
  (#644 — SDK `missing_api_key` while cURL works). Source: `field-02` §C.

### PIT-24 — Bot opens/clicks pollute engagement signals
- **Condition:** using raw open/click for reputation/warmup/suppression decisions.
- **Detect:** high opens that don't correlate with conversions; Apple MPP / corporate link-rewriter
  traffic.
- **Avoid:** strip scanner/bot traffic before using engagement (Resend adding bot-click filtering, #901).
  Source: `field-02` §D #901.

### PIT-25 — Shared API key across tenants leaks replies + conflates reputation (internal scar)
- **Condition:** one platform key for all users (the AgentMail bug); also the "3-inbox limit" scaling
  wall.
- **Detect:** one tenant's inbound replies processed under the platform identity; one bad tenant tanks
  everyone's reputation.
- **Avoid:** per-tenant sending identity from day one. Source: `field-00` §1.

### PIT-26 — react-email preview "Send" button hits 429 / build timeout on many templates
- **Condition:** dev preview server, repeated Send clicks (#2922) or large template counts (#2402).
- **Detect:** HTTP 429 in dev; preview/build times out.
- **Avoid:** even in dev, design for 429 backoff; don't loop-send; expect build cost to scale with
  template count. Source: `field-01` §C.

---

## Quick triage index (symptom → pitfall)

| Symptom you observe | Likely pitfall |
|---|---|
| Reset emails to spam after a campaign | PIT-01 |
| Whole account suspended after a blast | PIT-02 |
| CF Workers/Convex build broke after SDK bump | PIT-03 |
| "Verified" but auth still fails | PIT-04, PIT-08 |
| Provider "sending paused" | PIT-05 |
| Mass unsubscribes nobody clicked | PIT-06 |
| SPF fails after adding an ESP | PIT-07 |
| SPF+DKIM pass, DMARC fails | PIT-08 |
| Fresh domain blocklisted in a day | PIT-09 |
| Lost logs after switching providers | PIT-10 |
| Gmail rejects but Yahoo accepts | PIT-11 |
| DKIM fails only for some corporate recipients | PIT-12 |
| SES exit denied "security reasons" | PIT-13 |
| "install @react-email/render" at runtime | PIT-14 |
| Duplicate emails after a retry | PIT-15 |
| Email blank/broken only in Gmail | PIT-16, PIT-17, PIT-19 |
| Button/font broken only in Outlook | PIT-18 |
| Background inverted on iPhone | PIT-20 |
| Domain status keeps resetting | PIT-21 |
| Sends fail auth, no change made | PIT-22 |
| Every API field is undefined | PIT-23 |
| Opens high, conversions flat | PIT-24 |
| One tenant's replies under wrong identity | PIT-25 |
