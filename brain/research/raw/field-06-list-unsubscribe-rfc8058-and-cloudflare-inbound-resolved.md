---
title: "FIELD — RFC 8058 one-click List-Unsubscribe gotchas + resolved Cloudflare-Email-Routing-inbound clarification + bounce/FBL handling"
type: source
created: 2026-06-16
tags: [field-intelligence, rfc8058, list-unsubscribe, one-click, dkim, cloudflare-email-routing, inbound, bounce, feedback-loop, gotcha]
researcher: FIELD-INTELLIGENCE (pigeon, CP123 Wave-R)
note: "Closes two gaps from field-00 and field-03: (1) the List-Unsubscribe-Post version-specific gotcha cluster the 2024/2026 bulk rules force; (2) what Energy ACTUALLY planned for Cloudflare Email Routing (inbound), resolving the field-00 §5 'could not confirm' flag. Currency 2024-2026."
---

# RFC 8058 one-click unsubscribe gotchas + Cloudflare-inbound resolved

## A. List-Unsubscribe-Post (RFC 8058) — the version-specific gotcha cluster

The 2024 Gmail/Yahoo rules (field-04 §C1) and the 2025-2026 escalation (field-04 §C2) make one-click
unsubscribe MANDATORY for marketing mail. It is THE most-gotten-wrong header because it's not just
"add a header" — there's an HTTP-method contract, a DKIM-coverage requirement, and an enumeration
attack surface. These are real engineer footguns, not docs-paraphrase.

### A1. POST-not-GET — the auto-unsubscribe-by-scanner trap
**Source:** https://paul.af/list-unsubscribe-post (Paul's Weblog, **2024-11-07**), via WebFetch.

Verbatim (the strongest opinion):
> "Make *sure* that your HTTPS URL *only* supports HTTP POST (you don't want rogue crawlers
> accidentally triggering an unsubscribe)."

The mechanism (verbatim, WebSearch synthesis of mailpro/captaindns/emaillabs 2025):
> "RFC 8058 adds a clear signal: GET must not trigger a silent unsubscribe (at most, an info page),
> while POST triggers the actual unsubscribe. The original problem RFC 8058 was designed to address is
> that some systems (antispam, antivirus, previews) can preload URLs and trigger unsubscribes by
> accident."

→ **The footgun:** if your unsubscribe endpoint honors GET (the natural Rails/Express default for a
link), every security scanner, link-rewriter (Outlook Safe Links), and Gmail image-prefetcher that
touches the URL silently unsubscribes the user. You then see mysterious mass-unsubscribes. The fix is
counterintuitive: the one-click link must be **POST-only**.

### A2. DKIM MUST cover the List-Unsubscribe headers
**Source:** WebSearch synthesis of RFC 8058 + captaindns/mailpro (2025), fetched 2026-06-16.
> "The message MUST have a valid DKIM signature that covers at least the List-Unsubscribe and
> List-Unsubscribe-Post headers."

→ **Gotcha:** if you add List-Unsubscribe AFTER signing, or your DKIM `h=` tag doesn't include these
header names, Gmail/Yahoo ignore the one-click button (the signal isn't trusted) and you're
non-compliant despite having the header. The header and the DKIM signing config are coupled.

### A3. Exact format + no confirmation page
Verbatim format (Paul + RFC):
> `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
> `List-Unsubscribe: <https://your-url>, <mailto:fallback>`
(HTTPS URI, inside angle brackets; the List-Unsubscribe-Post value is the literal string
`List-Unsubscribe=One-Click`.)

The "you lose one-click if you bounce them to a page" trap (verbatim, WebSearch synthesis):
> "When the user clicks 'Unsubscribe' in Gmail/Yahoo, your server receives a POST request with the
> header List-Unsubscribe=One-Click, and if your endpoint shows a confirmation page or requires
> another click, you lose the 'one-click' experience expected by providers."
> "A shaky implementation (non-HTTPS URL, redirects, confirmation page, endpoint that ignores the
> POST) leads to spam complaints and hurts deliverability."

### A4. Opaque unsubscribe IDs — the enumeration attack nobody thinks about
**Source:** https://paul.af/list-unsubscribe-post (2024-11-07), verbatim:
> [use] "opaque" or "hard to guess" identifiers ... [Paul] used "Sqids to encode the numeric database
> ID" — preventing attackers from guessing unsubscribe URLs for other users.

→ **Gotcha:** `?unsubscribe=user_id=42` lets anyone unsubscribe anyone by incrementing the ID. Encode
it (Sqids / signed token). A POST-only + opaque-ID endpoint is the correct shape.

### A5. The stream coupling (ties back to field-04 §C1)
One-click unsubscribe is for MARKETING mail only — transactional (password reset, receipt) must NOT
carry it. So the unsubscribe-header policy is a function of which STREAM the message is on. pigeon
can't apply this header correctly unless it knows the message's stream — reinforcing stream-tagging
as a core primitive (field-04 §B, field-05 §D).

**pigeon's List-Unsubscribe checklist (extracted):**
1. Marketing stream only (skip for transactional).
2. HTTPS URI, angle brackets, with a `mailto:` fallback.
3. Endpoint is **POST-only** (GET shows an info page at most, never unsubscribes).
4. DKIM `h=` MUST include `List-Unsubscribe` and `List-Unsubscribe-Post`.
5. Unsubscribe ID is opaque (Sqids/signed), not a raw DB id.
6. Honor the unsubscribe within 2 days (the 2024 rule, field-04 §C1).
7. No confirmation page / no redirect chain on the POST.

## B. RESOLVED: what Energy actually planned for Cloudflare Email Routing (field-00 §5 gap closed)

field-00 §5 flagged "Did Energy ever run a Cloudflare Email Routing inbound POC, and what broke?" as
unconfirmed. Reading the actual energy identity docs resolves the DESIGN intent (though still no
broken-POC postmortem exists):

**Source:** ~/energy/docs/identity/RESEARCH.md lines 196-219 + ARCHITECTURE.md lines 87,
178-188 (READ-ONLY, quoted).

What energy designed (verbatim from RESEARCH.md):
> "### Resend (Recommended) ... Modern email API (by the creator of React Email)"
> "### Cloudflare Email Routing (Inbound) ... Free email forwarding for custom domains"
> "**Outbound:** Resend (modern API, React templates)"
> "**Inbound:** Cloudflare Email Routing → webhook → gateway"
> "**Cost:** ~$0.50/agent/month amortized"

And ARCHITECTURE.md (verbatim):
> "**Inbound:** Resend webhooks or Cloudflare Email Routing (free)"
> "2. Complete email inbound (`/api/gateway/email/route.ts`)"

**Resolution:** Energy's intended split is **Resend = outbound (transactional send), Cloudflare Email
Routing = inbound (free forwarding → webhook → AgentDial gateway).** This is the architecture, not a
shipped+broken experiment. So the field-00 §5 flag is downgraded:
- CONFIRMED: Cloudflare Email Routing is the *planned inbound* path (free forwarding to webhook).
- STILL UNCONFIRMED: any *executed* Cloudflare Email Routing POC with a written postmortem of what
  broke. The only documented email BREAKAGE remains the AgentMail per-user-key webhook bug
  (field-00 §1). pigeon's inbound story should expect Cloudflare Email Routing, but the war-story
  corpus on inbound is thin — flag as an area to generate fresh evidence by actually wiring it.

**Public gotcha pigeon should know about Cloudflare Email Routing (from the HN thread, field-05 §A):**
the Cloudflare Email *Service* (outbound send) was still in private beta as of 2025-09 (HN item
45373081), and a top request was *"please do set up SPF, DKIM and DMARC for me ... support SPF record
flattening natively"* (toomuchtodo). So Cloudflare's outbound-send is newer/less proven than Resend;
inbound Email Routing (forwarding) is mature and free.

## C. Bounce / complaint / feedback-loop handling (the resend-node gap + the SES gate)

field-01 §D flagged that resend-node bounce/webhook stories weren't mined; `gh search` returned
non-JSON again this pass (CLI/auth flakiness — re-mine needed). But the bounce-handling REQUIREMENT
is well-established from the primary sources already gathered:

1. **SES sandbox exit DEMANDS a bounce/complaint story** (field-04 §A1): the Trust & Safety question
   *"How do you handle bounces and complaints?"* is a gate. A real handler = consume the bounce/
   complaint webhook (SNS for SES, webhook for Resend), suppress hard-bounced addresses, and never
   re-send to them. Vague answers = denial (the OP's word-salad answer, field-04 §A1).
2. **Mailgun's enforced thresholds** (field-05 §D): *"roughly 0.1% complaints, 5% bounces"* — cross
   them and the AUP suspends you. So bounce-suppression isn't hygiene, it's survival.
3. **SendGrid's recovery runbook** (field-05 §E) step 7: subscribe to **Google Postmaster Tools,
   Microsoft SNDS, Yahoo CFL** feedback loops. These are the ONLY way to see complaint rate before it
   tanks you. pigeon should wire all three FBLs by default.
4. **Resend idempotency trend** (field-02 §D, #967): default idempotency keys so a retry after a
   network blip doesn't double-send and inflate volume/complaints.

**pigeon's bounce/FBL minimum:** consume bounce+complaint webhooks → auto-suppress hard bounces →
auto-pause on complaint-rate spike (>0.1%) or bounce spike (>5%) → subscribe Postmaster/SNDS/CFL →
idempotency keys on every send. This is the operational core of "deliverability-correct," and it's
exactly what SES's sandbox gate, Mailgun's AUP, and SendGrid's recovery runbook all independently
demand.

## D. Disputes / unconfirmed (feeds GAPS-AND-DISPUTES)
1. **Does DKIM really need to cover List-Unsubscribe headers, or is it best-practice?** The RFC and
   2025 guides say MUST; Paul's practitioner post (2024) omits it entirely and focuses on POST-only +
   opaque IDs. Likely both true (Paul under-specified), but the "MUST" strength vs "providers
   tolerate it unsigned in practice" is worth verifying empirically.
2. **Cloudflare Email Routing inbound at scale** — energy planned it but I found no executed POC and
   no public postmortem of it breaking for transactional-reply routing. Genuinely thin corpus; pigeon
   should treat inbound-via-CF-Routing as designed-but-unproven internally.
3. **resend-node bounce/webhook issue corpus** — `gh search` failed to return JSON twice this session
   (CLI flakiness). The bounce REQUIREMENT is confirmed from SES/Mailgun/SendGrid sources, but the
   resend-node-SPECIFIC bounce-handling bug stories are UN-mined. Flag for re-mine with a working
   `gh` invocation.
