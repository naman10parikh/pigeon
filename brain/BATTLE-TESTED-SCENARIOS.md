---
title: "BATTLE-TESTED-SCENARIOS — real failure/migration/production scenarios with resolutions"
type: synthesis
created: 2026-06-16
updated: 2026-06-16
tags: [scenarios, eval-tasks, deliverability, golden-tasks, pigeon]
sources:
  - "research/raw/field-00-internal-corpus.md"
  - "research/raw/field-01-github-react-email-rendering-gotchas.md"
  - "research/raw/field-02-resend-node-sdk-gotchas.md"
  - "research/raw/field-03-hn-deliverability-folklore-disputes.md"
  - "research/raw/field-04-ses-sandbox-stream-separation-2026-rules.md"
  - "research/raw/field-05-migration-war-stories-and-reddit-spam-postmortems.md"
  - "research/raw/field-06-list-unsubscribe-rfc8058-and-cloudflare-inbound-resolved.md"
summary: "19 concrete, source-grounded transactional-email scenarios (symptom → diagnosis → resolution → prevention). These become golden eval tasks in Wave S."
related:
  - "[[EXPERTISE-MAP]]"
  - "[[KNOWN-PITFALLS]]"
  - "[[OPINIONS]]"
---

# BATTLE-TESTED-SCENARIOS

> Each scenario is a **real situation a transactional-email employee will face**, written as
> SYMPTOM → DIAGNOSIS → RESOLUTION → PREVENTION → SOURCE. They are deliberately specific (version
> numbers, error codes, thresholds) so each can become a golden eval task in Wave S: feed pigeon the
> SYMPTOM, grade it on whether it reaches the RESOLUTION and names the PREVENTION. None of these are
> hypothetical — every one traces to a documented bug, thread, or postmortem.

---

## SCN-01 — "My transactional emails started going to Gmail spam three days ago" (stable-for-years cliff)

- **SYMPTOM:** SendGrid worked fine for years; suddenly password-resets and receipts land in Gmail
  spam. Nothing in the app changed.
- **DIAGNOSIS:** Two likely causes, both reputation: (a) a neighbor on the SHARED IP pool went bad and
  contaminated the pool, or (b) the sender crossed Gmail's tightened 2024/2025 thresholds (complaint
  rate, or post-Nov-2025 hard rejection of non-compliant traffic).
- **RESOLUTION:** Check sender reputation in Google Postmaster Tools (the only authoritative view) and
  MXToolbox for blocklists. If the shared pool is the cause, request a new IP or move the transactional
  stream to a curated provider (Postmark) on a dedicated transactional subdomain. Confirm SPF+DKIM+DMARC
  with alignment.
- **PREVENTION:** Separate streams (JTBD-2); monitor complaint rate via FBLs BEFORE the cliff; don't
  share an IP pool with marketing traffic.
- **SOURCE:** `field-05` §F (r/email 1bk0fvo, r/Emailmarketing 1jexpe8), `field-04` §C2.

## SCN-02 — "I set up SPF and DKIM, they pass, but DMARC still fails"

- **SYMPTOM:** Authentication checkers show SPF=pass, DKIM=pass, yet DMARC=fail and mail is quarantined.
- **DIAGNOSIS:** ALIGNMENT. DMARC requires the authenticated domain to *align* with the visible `From:`
  domain. A third-party sender (helpdesk, billing, marketing ESP) authenticating under its own domain
  passes SPF/DKIM but fails DMARC alignment against your `From:`.
- **RESOLUTION:** Either bring the third-party sender under an aligned subdomain (CNAME their DKIM to a
  `*.yourdomain.com` selector and use a `From:` on your domain), or set DMARC alignment to relaxed if a
  subdomain match is acceptable. Enumerate every third-party sender first via DMARC aggregate reports.
- **PREVENTION:** Before `p=reject`, run `p=none` and read aggregate reports to enumerate ALL senders —
  "oops, I forgot the helpdesk ticketing system" is the canonical miss.
- **SOURCE:** `field-03` THREAD-2 (brewmarche, zippergz).

## SCN-03 — "Adding one more ESP silently broke SPF for ALL our mail"

- **SYMPTOM:** Mail that authenticated fine yesterday now fails SPF after adding a new marketing/billing
  ESP `include:` to the SPF record.
- **DIAGNOSIS:** SPF has a HARD 10-DNS-lookup limit (RFC 7208 §4.6.4). Each `include:` consumes lookups;
  the new ESP pushed the record over 10, and SPF returns `permerror` for everything.
- **RESOLUTION:** Flatten the SPF record (replace nested `include:`s with the resolved IP ranges where
  safe), or remove unused senders. Re-test with a checker that evaluates SPF MACROS (most online tools
  don't, and misreport).
- **PREVENTION:** Treat the 10-lookup limit as a hard budget; audit it before adding any sender. Minimize
  includes; consolidate ESPs.
- **SOURCE:** `field-03` THREAD-3 (KomoD, hard-rules).

## SCN-04 — "Our password-reset emails went to spam after a marketing campaign" (stream contamination)

- **SYMPTOM:** A marketing newsletter went out; shortly after, password-reset deliverability collapsed.
- **DIAGNOSIS:** Marketing and transactional share the same IP/subdomain. Some recipients marked the
  newsletter as spam → the sending IP's reputation dropped → the password resets sharing that IP started
  landing in spam. Asymmetric contamination: the disposable stream poisoned the critical one.
- **RESOLUTION:** Split immediately — move transactional to its own subdomain (`notifications.app.com`)
  and ideally a separate provider/pool (Postmark). Let the marketing reputation recover in isolation.
- **PREVENTION:** Never co-mingle streams. Stream-tag every message and route by stream from day one.
- **SOURCE:** `field-04` §B1-B3, §B2 (the verbatim contamination sentence).

## SCN-05 — "Postmark suspended our ENTIRE account after one B2B broadcast" (cold-on-transactional ban)

- **SYMPTOM:** A single cold/bulk outreach blast through Postmark (or Mailgun); within days the whole
  account is suspended — transactional password-resets and receipts now blocked too.
- **DIAGNOSIS:** Transactional-only providers explicitly prohibit cold/unsolicited/bulk-to-unverified
  mail and suspend the WHOLE account on detection. The stream-separation taste isn't politeness;
  violating it is account-death.
- **RESOLUTION:** Move cold/marketing to a provider that permits it (with verified opt-in) on a SEPARATE
  domain; restore transactional on the compliant provider. If already routing cold through Postmark/
  Mailgun, migrate BEFORE the suspension hits.
- **PREVENTION:** pigeon HARD-REFUSES routing a message tagged `cold`/`marketing` through a
  transactional-only provider. This is a guardrail, not a tuning knob.
- **SOURCE:** `field-05` §D (puzzleinbox 2026; flagged: the "transactional also blocked" severity is a
  one-sided review claim, but the BAN POLICY is independently confirmed — see [[GAPS-AND-DISPUTES]] G-05).

## SCN-06 — "resend@6.9.1 broke our Cloudflare Workers / Convex build" (minor-bump edge-runtime break)

- **SYMPTOM:** After bumping resend-node to v6.9.x, the build/deploy fails on Cloudflare Workers
  (`Uncaught TypeError: Zv.hasOwnProperty is not a function`) or Convex; or a generic 500 on send.
- **DIAGNOSIS:** v6.9.0 added the `mailparser` dependency (for inbound/receiving), which pulls Node
  built-ins that don't exist on edge runtimes.
- **RESOLUTION:** Immediate: enable `nodejs_compat` on the Cloudflare Worker (the documented fix, #817).
  Strategic: pin the SDK version and isolate it behind pigeon's thin provider interface so a regression
  is a one-file pin, not an app-wide outage. For pure-send paths that don't need inbound parsing,
  consider the raw-REST escape hatch.
- **PREVENTION:** Pin the email-SDK version; treat any minor bump as a deploy-risk event, especially on
  serverless/edge; test on the target runtime before merging the bump.
- **SOURCE:** `field-02` §A (#837, #826, #824, #817), §E.1.

## SCN-07 — "`@react-email/render` could not be found" / "this.renderAsync is not a function"

- **SYMPTOM:** React-rendered emails fail at runtime with "Failed to render React component. Make sure
  to install `@react-email/render`," or `renderAsync is not a function`, depending on the bundler.
- **DIAGNOSIS:** `@react-email/render` is documented as an "optional" peer, but Turbopack/Webpack/Vite
  each resolve the optional import differently — some fail with "Module not found," some don't.
- **RESOLUTION:** Install `@react-email/render` EXPLICITLY as a direct dependency and pin it. Don't rely
  on it being pulled transitively.
- **PREVENTION:** Treat it as a required dependency for any React-email send path; verify across the
  exact bundler the app uses.
- **SOURCE:** `field-02` §B (#905, #629, #625, #616), §E.

## SCN-08 — "We're migrating SendGrid → SES to cut cost; what breaks?" (the migration runbook)

- **SYMPTOM:** Team wants to switch providers (SendGrid→SES for cost, or →Resend for DX) and assumes
  deliverability carries over. It does not.
- **DIAGNOSIS:** Reputation does NOT transfer between providers; there's no native migration tool; log
  retention windows are tiny; the new pool/IP starts cold.
- **RESOLUTION (the checklist pigeon owns):**
  1. **Export logs BEFORE flipping DNS** — Resend retains as little as 1 day (Free) / 3 (Pro) / 7
     (Scale); Postmark 45. You lose the audit trail otherwise.
  2. Re-verify the domain (SPF/DKIM/DMARC) on the NEW provider's sending subdomain.
  3. Update DNS — new CNAME/TXT for the new provider's DKIM selector.
  4. Rewrite integration code behind the abstraction (one file if abstracted; app-wide if not).
  5. Re-test EVERY template on the new provider (rendering differs — see SCN-09/SCN-10).
  6. **Warm the new IP/subdomain from ZERO** via the control loop (SCN-11) — reputation didn't transfer.
- **PREVENTION:** Keep all sends behind pigeon's provider abstraction so the only migration code change
  is the adapter; budget 10-20 hours minimum; never blast on arrival.
- **SOURCE:** `field-05` §A, §B, §C.

## SCN-09 — "Our button renders fine everywhere except Outlook, where everything below it disappears"

- **SYMPTOM:** A CTA button looks correct in Gmail/Apple Mail but in Outlook (Windows desktop) the
  button and everything below it fails to render; or padding on the button is gone; or the font is
  Times New Roman.
- **DIAGNOSIS:** Outlook-on-Windows uses the Microsoft Word HTML engine, not a browser. It's intolerant
  of malformed table nesting, ignores web fonts (`@font-face`), and drops CSS padding on `<a>`/buttons.
- **RESOLUTION:** Use a "bulletproof button" — VML `<v:roundrect>` with MSO conditional comments for
  Outlook, falling back to a styled `<a>` elsewhere. Use table-cell `bgcolor` for backgrounds. Use
  web-safe fonts with a font stack (Outlook will ignore the web font and use the fallback).
- **PREVENTION:** Test Outlook on EVERY `@react-email/components` bump — v0.29+ silently regressed
  buttons in Outlook 2016/2019 (#1813); padding regressed in #1512. Pin the component lib.
- **SOURCE:** `field-01` §B (#2373, #1512, #1269, #1813, #1131, #662).

## SCN-10 — "The entire email body is blank in Gmail" (preheader / Tailwind rendering total-failure)

- **SYMPTOM:** In Gmail specifically, recipients see a completely empty email — no content at all.
- **DIAGNOSIS:** Two known root causes: (a) a `<Preview>` (preheader) bug that blanks the whole email
  when certain values are passed (#1785), or (b) Tailwind breakpoints/`<style>` media queries stripped
  by Gmail's sanitizer leaving unstyled/collapsed content (#2712), or a `safelist` leaking raw
  `@tailwind` directives into the HTML (#1907).
- **RESOLUTION:** Sanitize/limit the `<Preview>` value; INLINE all styles (don't depend on `<style>`
  blocks or Tailwind breakpoints surviving Gmail); remove Tailwind `safelist` if it's leaking
  directives; pin the react-email version to one without the canary preheader bug.
- **PREVENTION:** Treat Tailwind-for-email as a leaky build-time convenience; verify the rendered HTML;
  test the actual Gmail web + Gmail iOS clients, not just a local preview.
- **SOURCE:** `field-01` §A (#1785, #2712, #1907), extracted taste rule.

## SCN-11 — "We need to warm a brand-new sending domain; what schedule?" (warmup as control loop)

- **SYMPTOM:** Fresh domain/IP, want to ramp to production volume without getting blocklisted.
- **DIAGNOSIS:** A fixed doubling schedule is the wrong mental model. The failure mode is doubling
  on-schedule WHILE a provider is already deferring you.
- **RESOLUTION:** Run warmup as a control loop: start small, increase gradually, and WATCH the 421/450
  soft-bounce/deferral rate PER-PROVIDER. If Gmail/Outlook deferral spikes, HOLD volume (do not double)
  until it clears. "Slow is fast." Prioritize engaged recipients early to build positive signal.
- **PREVENTION:** Never blast a cold domain (50k day-one = instant blocklist). If your provider (e.g.
  Resend) has no auto-pause-on-bounce, pigeon supplies it.
- **SOURCE:** `field-04` §C3, `field-05` §C.

## SCN-12 — "We got compromised / our reputation crashed; how do we recover?" (the 30-day runbook)

- **SYMPTOM:** Sending reputation tanked (spam-foldering, blocklist, or a compromised key blasted spam).
- **DIAGNOSIS:** External reputation recovery with recipient servers is a ~30-day grind; blocklist
  delisting is 30-90 days and ISPs remember.
- **RESOLUTION (SendGrid's official runbook, generalized):**
  1. STOP sending for a few days (prevent further damage).
  2. Restart with a MANUAL slow warmup (SCN-11).
  3. Ensure DMARC is set on all sending domains.
  4. Adhere to Gmail/Microsoft/Yahoo guidelines.
  5. Remove unengaged recipients; improve content.
  6. Monitor engagement recency + unique open rates.
  7. Subscribe to FBLs: Google Postmaster Tools, Microsoft SNDS, Yahoo CFL.
  8. Contact provider support directly if blocklisted.
- **PREVENTION:** Automate steps 1-2-3-7 (auto-pause on spike, slow re-warm, verify DMARC, wire FBLs) so
  recovery isn't a manual scramble.
- **SOURCE:** `field-05` §E (SendGrid official support runbook).

## SCN-13 — "Mysterious mass-unsubscribes — users say they never clicked" (GET unsubscribe footgun)

- **SYMPTOM:** A wave of unsubscribes from the marketing list; affected users insist they never clicked.
- **DIAGNOSIS:** The one-click unsubscribe endpoint honors GET. Security scanners, Outlook Safe Links
  rewriters, and Gmail image-prefetchers PRELOAD the URL, silently triggering unsubscribes (the exact
  problem RFC 8058 was designed to prevent).
- **RESOLUTION:** Make the unsubscribe endpoint POST-ONLY. GET shows at most an info page and never
  unsubscribes. Ensure DKIM `h=` covers `List-Unsubscribe` + `List-Unsubscribe-Post`. Use opaque
  (Sqids/signed) IDs so enumeration can't unsubscribe arbitrary users.
- **PREVENTION:** Default the one-click flow to POST-only with opaque IDs and DKIM-covered headers, and
  ONLY on the marketing stream (never transactional).
- **SOURCE:** `field-06` §A1, §A2, §A4.

## SCN-14 — "We failed our own SPF policy on our own transactional email" (the Upwork class of bug)

- **SYMPTOM:** Your system emails (sent via a third-party ESP like Mailgun) fail SPF for your own domain
  — exactly what happened to Upwork: their MailGun IPs were missing from `upwork.com`'s SPF record.
- **DIAGNOSIS:** When you route transactional mail through an ESP, the ESP's sending IPs must be present
  in your SPF record (via the ESP's `include:`). If you add the ESP but forget the SPF entry, your own
  mail fails your own policy.
- **RESOLUTION:** Add the ESP's `include:` to SPF (mindful of the 10-lookup limit, SCN-03) AND align
  DKIM/DMARC. Verify with a MACRO-aware checker, not a crappy online tool.
- **PREVENTION:** Enumerate and authenticate EVERY sender path; being a big company doesn't make it
  right — Upwork shipped this broken (providers may just have learned to tolerate them).
- **SOURCE:** `field-03` THREAD-3 (Upwork, KomoD, avian).

## SCN-15 — "The SES sandbox-exit request keeps getting denied with no reason"

- **SYMPTOM:** Repeated SES production-access requests denied: "your use of Amazon SES could have a
  negative impact on our service" / "security reasons," even after answering the questions.
- **DIAGNOSIS:** Almost always a quality-of-NARRATIVE failure. The reviewer needs crisp, specific
  answers to four questions; vague word-salad (especially on bounce handling) gets auto-denied. Also:
  missing landing page / privacy policy (they inspect your site), and DNS auth not yet in place.
- **RESOLUTION:** Before re-requesting: (1) put SPF+DKIM+DMARC in place (2024 prerequisite); (2) ensure
  a professional site + privacy policy exist; (3) answer all four questions with specifics — business
  nature + SES use, how addresses are collected, exact subscribe/unsubscribe flow, and a CONCRETE
  bounce/complaint handling description (consume webhook → suppress → never re-send). pigeon can author
  this narrative because it implements that handling.
- **PREVENTION:** Don't request sandbox exit until auth + site + a real bounce handler exist. Never
  submit a vague free-text answer.
- **SOURCE:** `field-04` §A1, §A2, §A3.

## SCN-16 — "Our open/click rates look great but engagement-based decisions keep misfiring" (bot pollution)

- **SYMPTOM:** Open/click metrics are high, but reputation/warmup decisions based on "engagement" don't
  correlate with real user behavior; suppression of "unengaged" users behaves oddly.
- **DIAGNOSIS:** Apple Mail Privacy Protection, corporate link-rewriters, and security scanners
  pre-fetch images and links, inflating opens/clicks. Resend is adding bot-click filtering (#901)
  precisely because raw engagement is polluted.
- **RESOLUTION:** Strip known scanner/bot traffic before using engagement signals; prefer
  POST-confirmed actions and downstream conversions over raw opens; don't make reputation/warmup
  decisions on unfiltered open/click.
- **PREVENTION:** Treat raw open/click as untrusted for any reputation-affecting decision; filter first.
- **SOURCE:** `field-02` §D (#901), §E.4.

## SCN-17 — "DKIM fails on the recipient side, but only for some corporate recipients" (the not-your-fault ticket)

- **SYMPTOM:** Your mail signs correctly and passes DKIM at every test tool, yet a specific enterprise
  recipient's gateway reports DKIM=fail. It's intermittent — only certain corporate domains.
- **DIAGNOSIS:** A corporate Outlook / mail-filtering chain is REWRITING the message (adding a
  disclaimer footer, rewriting links via Safe Links, normalizing headers) and THEN checking DKIM on
  its own modified copy. Any tampering invalidates the signature — including a legitimate relay
  re-signing. The failure is upstream, not in your signer.
- **RESOLUTION:** Confirm your own signature is valid at the sending edge (sign late, after all your
  own header/body mutations; ensure the `h=` tag and canonicalization are stable). Then recognize the
  remaining failures as recipient-side rewrites you do NOT control — don't keep "fixing" a correct
  config. If a relationship matters, relaxed DKIM canonicalization (`c=relaxed/relaxed`) tolerates
  some whitespace/header reformatting better than `simple`.
- **PREVENTION:** Use relaxed canonicalization; sign as the last step; and know the signature-break-on-
  rewrite failure mode so you don't burn hours chasing your own (correct) config. This is the #1
  "DKIM mysteriously fails" red herring.
- **SOURCE:** `field-03` THREAD-1 (jeroenhd — "some part of an Enterprise Outlook mail filtering chain
  was rewriting the mail I sent before checking the DKIM signature"), THREAD-2 (RedShift1 — tampering
  invalidates the signature). See [[KNOWN-PITFALLS]] PIT-12.

## SCN-18 — "Our domain status keeps flipping back to unverified and we're getting duplicate webhooks" (the verify poll-loop)

- **SYMPTOM:** A health-check or CI step polls `domains.verify` (or the dashboard "Verify" button is
  scripted) to confirm DNS; the domain status resets, and bounce/event webhooks fire spuriously.
- **DIAGNOSIS:** Resend's `/verify` is NOT idempotent (#823) — calling it resets DNS/domain status and
  triggers webhooks unnecessarily. Treating verify as a read-only status poll is the mistake; it's a
  mutating operation.
- **RESOLUTION:** Stop calling `verify` in a loop. To CHECK status, `dig` the DNS records yourself
  out-of-band (the records are public) — don't gate go-live on the provider's mutable flag, which can
  also return a stale cache (#775). Call `verify` exactly once, on the initial DNS setup.
- **PREVENTION:** Never poll a mutating provider endpoint to read status. pigeon checks SPF/DKIM/DMARC
  via `dig` (its own DNS query), and treats `verify` as a one-shot setup action. See [[OPINIONS]] O-11.
- **SOURCE:** `field-02` §C (#823 verify not idempotent, #775 stale cache), §E.2.

## SCN-19 — "AWS paused our SES sending and put the account 'under review' after a bad batch" (shared-pool suspension, NOT a sandbox denial)

- **SYMPTOM:** Already out of the SES sandbox and sending in production, but after one bad segment AWS
  flags the account "under review" / "sending paused" — distinct from the sandbox-exit denial (SCN-15).
- **DIAGNOSIS:** SES gives a SHARED-IP pool by default and makes reputation YOUR job, but still
  enforces a >5% bounce / >0.1% complaint ceiling and pauses you on a shared pool to "prevent other
  Amazon SES customers from experiencing interruptions." It's the worst-of-both-worlds for a naive
  sender: you own the reputation risk but don't get a curated pool (unlike Postmark/Resend).
- **RESOLUTION:** Immediately STOP the offending stream; pull the bounce/complaint data from the SES
  reputation dashboard / SNS events; suppress the hard bounces; respond to AWS with a concrete
  remediation (what segment caused it, the suppression you applied, the auto-pause you added). Then
  follow the 30-day recovery grind (SCN-12). For deliverability-critical mail, consider moving the
  transactional stream to a curated provider so a shared-pool neighbor can't take you down.
- **PREVENTION:** Auto-pause on bounce >5% / complaint >0.1% BEFORE AWS does (O-24); wire the SES
  reputation dashboard + SNS event feed; never run marketing volume on the SES transactional account.
- **SOURCE:** `field-04` §A4 ("We are denying this request to prevent other Amazon SES customers from
  experiencing interruptions"), §C1 thresholds. See [[KNOWN-PITFALLS]] PIT-05.

---

## Eval-task harvest note (for Wave S)

Each scenario above is a ready golden task: present the **SYMPTOM** as the prompt, hide the rest, and
grade pigeon on (a) reaching the **RESOLUTION**, (b) naming the **PREVENTION**, and (c) NOT proposing
an anti-pattern from [[KNOWN-PITFALLS]] / violating an [[OPINIONS]] stance.

**Highest-signal discriminators (use these first — they catch the engineer who knows the happy path
but not the failure mode):**
- **SCN-05** (cold-on-transactional = whole-account death) — catches anyone who treats provider choice
  as a deliverability-only decision.
- **SCN-13** (GET unsubscribe → scanner mass-unsubscribe) — the counterintuitive POST-only rule.
- **SCN-02** (SPF+DKIM pass but DMARC fails on alignment) — the single most-misunderstood mechanic.
- **SCN-17** (corporate DKIM rewrite) — catches the engineer who'd waste hours "fixing" a correct
  signer instead of recognizing the upstream rewrite.
- **SCN-18** (`/verify` poll-loop) — catches treating a mutating endpoint as a status read.

A passing answer must also carry the right UNCERTAINTY where the source is disputed (e.g. SCN-05 should
NOT overstate "transactional was definitely blocked" — that severity is a one-sided claim, G-05).
