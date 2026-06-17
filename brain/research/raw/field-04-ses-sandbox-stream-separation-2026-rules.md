---
title: "FIELD — SES sandbox traps, transactional/marketing stream separation (Postmark taste), and the 2024→2026 bulk-sender rule shift"
type: source
created: 2026-06-16
tags: [field-intelligence, aws-ses, sandbox, postmark, stream-separation, gmail, yahoo, outlook, dmarc, 2026-rules, warmup]
researcher: FIELD-INTELLIGENCE (pigeon, CP123 Wave-R)
note: "Verbatim quotes from AWS re:Post, Postmark blog, Mailgun/Resend/SecurityBoulevard. Currency: 2024-2026 where possible; the one older anchor (Postmark 2017/2022) is flagged but its principle is stable + corroborated by 2026 sources."
---

# SES sandbox, stream separation, and what 2026 changed

> Scope: the deliverability-correctness layer pigeon owns. Three clusters: (A) AWS SES sandbox /
> production-access / reputation traps; (B) the transactional-vs-marketing STREAM SEPARATION taste
> (Postmark's signature opinion + corroboration); (C) the 2024→2026 Gmail/Yahoo/Outlook bulk-sender
> rule shift that invalidates pre-2024 "just set SPF and you're fine" wisdom.

---

## A. AWS SES sandbox + production-access + reputation traps

### A1. The recurring "denied with no reason" wall (verbatim war-story)
**Source:** https://repost.aws/questions/QU8BHXu6-TTceeXHF7eKuNsg/refused-to-exit-ses-sandbox-very-urgent
(thread is older — "asked 4 years ago" — BUT the pattern is live: re:Post sidebar links the SAME
problem "asked 2 months ago" and "asked 10 months ago" → 2025-2026 recurrence confirmed)

The original poster (AWS-User-2432889), verbatim:
> "I already requested the exit of the sandbox ... and I also made 2 more requests to change the SES
> limit and all were denied. I put in the requests all the information requested by AWS and even then
> I can't get into production. The system is going into production and I need the email tool working
> URGENT"

A second user (cesar), verbatim, ~1 year later on the same thread:
> "how you was able to pass the SES sandbox rejection? I am facing the same issue, amazon rejected me
> with no explanation, for 'security reasons', it is very frustrating."

**The AWS Trust & Safety follow-up questions (verbatim, from AbdallahAWS's answer)** — these are the
4 questions that gate sandbox exit, and the OP's vague answers are WHY he was denied:
> - "What is the nature of your business, and how do you plan to use Amazon SES to meet the needs of
>   your business?"
> - "How do you collect the email addresses that are on your mailing list?"
> - "How do your subscribe and unsubscribe processes work?"
> - "How do you handle bounces and complaints?"

Look at the OP's actual (denied) answer to "how do you handle returns/bounces" — it's word-salad:
> "System of problems with the constant sending of a part of shipments and the delivery or constant
> return of the shipments of a base of emails do not cause that problems..."

**Lesson for pigeon:** the SES sandbox-exit denial is almost always a QUALITY-OF-NARRATIVE failure,
not a technical one. The reviewer is a human (or human-gated model) on the Trust & Safety team who
needs a crisp, specific, bounce-handling + opt-in + unsubscribe story. pigeon should generate the
production-access narrative for the user (it knows the bounce/complaint handling it implements) — a
vague free-text answer is the #1 cause of the "denied, no reason given" loop.

### A2. The official denial message (verbatim) + the real causes
**Source:** https://www.usewaypoint.com/blog/aws-denied-your-production-access-to-amazon-ses
(dated **2024-08-20**)

The exact message AWS sends on denial:
> "We reviewed your request and determined that your use of Amazon SES could have a negative impact
> on our service."

Waypoint's two diagnosed root causes (paraphrase of their analysis, currency 2024):
1. **Lacking professional appearance** — "Missing landing pages, absent privacy policies, or
   insufficient company information in your application." (AWS literally looks at your website.)
2. **Insufficient detail** — they want you to "Explain who will be receiving emails, how often, and
   the type of emails that will be sent," plus your monitoring (SNS event data, reputation dashboard,
   CloudWatch alarms) and your incident process.

### A3. The 2024 process change: auth BEFORE you ask
**Source:** corroborated across the AWS SES docs + DEV Community (dev.to/shoplytics, 2024) summarized
in WebSearch 2026-06-16.
> "As of early 2024, AWS has changed the process to get production access ... now requiring users to
> have a domain with DNS records for SPF, DMARC, and DKIM in place before requesting to move out of
> the SES Sandbox."

**Lesson:** the ordering inverted. Pre-2024 folklore = "get out of sandbox, then set up DNS." 2024+
reality = DNS auth (SPF+DKIM+DMARC) is a PREREQUISITE to the request. pigeon must verify the domain
is authenticated (dig the records itself — see field-02 §775 stale-cache lesson) before it even tells
the user to file the request.

### A4. SES reputation = your problem on shared, but the suspension is real
The AWS Trust & Safety team's stated criterion (verbatim from AWS knowledge-center, via WebSearch):
> "We are denying this request to prevent other Amazon SES customers from experiencing interruptions
> in service."

**Generalized trap:** SES gives you a shared-IP pool by default. Your bounce rate (>5%) and complaint
rate (>0.1%) are watched; cross that and SES pauses your sending ("sending paused" / account "under
review"). Unlike Postmark/Resend which curate the pool aggressively, SES makes the reputation YOUR
job but punishes you on a shared pool — the worst of both worlds for a naive sender. This is the
deliverability echo of the internal AgentMail shared-key bug (field-00 §1): shared identity = one
bad actor (even you, on a bad day) tanks the pool.

---

## B. Transactional vs. marketing STREAM SEPARATION — the signature taste

### B1. Postmark's opinionated stance (verbatim)
**Source:** https://postmarkapp.com/blog/transactional-vs-marketing-email
(published **2017-09-28**, updated **2022-06-21** — FLAGGED as older, but every claim below is
independently corroborated by 2025-2026 sources in §B2, and the mechanic is stable)

The core taste, verbatim:
> "If you use the same servers and email address to send both broadcast and transactional email,
> filtering systems like Gmail's may classify it **all** as bulk email."

> "By separating transactional and marketing emails, you remove the guessing game and make it easier
> for inbox providers to sort your emails."

> "A sudden drop in your domain reputation from promotional emails won't jeopardize the deliverability
> of critical transactional messages."

**The contrarian opinion great practitioners hold (verbatim) — dedicated IP is NOT a silver bullet:**
> "Dedicated IPs aren't a silver bullet for delivery, even though some providers will try to convince
> you otherwise."

> "reputation focuses more on domains than IP addresses. This is because it's much easier for spammers
> to burn through new IP addresses than to set up new domains."

→ This directly contradicts the common vendor up-sell ("buy a dedicated IP and you're golden").
Postmark — who SELLS sending — says domain reputation dominates IP reputation. That's the rare
against-interest TASTE statement worth quoting.

### B2. Independent 2025-2026 corroboration of stream separation
**Source:** https://www.buildmvpfast.com/blog/resend-vs-ses-vs-postmark-transactional-email-deliverability-saas-2026
(2026) + Postmark's own infra description, via WebSearch 2026-06-16:
> "Postmark uses parallel, separate sending infrastructures to help get promotional emails delivered
> while protecting the fast and reliable delivery of transactional email."

> "When bulk and transactional messages are sent from the same IPs, receiving mail clients may
> classify more time-sensitive emails as bulk marketing which can lead to significant delays and
> deliverability issues."

The reputation-contamination mechanism stated plainly (WebSearch synthesis, 2026):
> "when a marketing campaign goes out and some recipients mark it as spam, the sending IP's reputation
> drops, and password reset emails sharing that same IP start landing in spam folders."

**The benchmark practitioners cite (independent testing, currency 2025-2026):**
> "Independent testing shows Postmark achieved 98.7% inbox placement versus SendGrid's 95.3% on
> transactional emails." (buildmvpfast / mailertogo 2025 guide). FLAG: vendor-adjacent benchmark,
> treat directionally not as gospel — but the >3pt gap is consistent across multiple 2025 comparisons.

### B3. The extracted TASTE rules (what avg engineers get wrong)
1. **Separate the streams — ideally separate subdomains AND separate providers/IPs.** Avg engineer
   sends password-resets and the monthly newsletter from `noreply@app.com` on one SendGrid key. Great
   engineer: `notifications.app.com` (transactional, Postmark/Resend) vs `mail.app.com` or
   `news.app.com` (marketing, a different provider/pool). pigeon's job is to enforce this by default.
2. **Domain reputation > IP reputation.** Don't fetishize the dedicated IP; protect the sending
   subdomain's reputation. (Postmark, against their own up-sell interest.)
3. **The contamination is asymmetric and brutal:** marketing's spam complaints poison the SHARED
   reputation, and the victim is the PASSWORD RESET — the most business-critical mail. The whole
   reason transactional email is "boring-but-mandatory infra" (field-00 §2) is that its failure mode
   is silent until a user can't log in.

---

## C. What 2026 changed — invalidating pre-2024 wisdom

### C1. The Feb-2024 Gmail/Yahoo bulk-sender baseline (the floor)
**Source:** https://www.mailgun.com/state-of-email-deliverability/chapter/yahoogle-bulk-senders/
(Mailgun State of Email Deliverability; thresholds verbatim below)
+ https://resend.com/blog/gmail-and-yahoo-bulk-sending-requirements-for-2024 (Resend, 2024)

Bulk-sender definition, verbatim (Marcel Becker, Yahoo, quoted by Mailgun):
> "If you send 4,999 messages, you still have to follow the requirements." (i.e. ~5,000/day to
> personal Gmail/Yahoo accounts = "bulk," but the threshold is contextual — don't game it at 4,999.)

The spam-complaint thresholds, verbatim (Mailgun):
> "If the complaint rate reaches 0.3%, you're in real trouble. That's when you're at risk of being
> blocklisted."
> "Once your spam complaint rate exceeds 0.1%, you're entering a 'danger zone.'"
Formula: complaints ÷ emails × 100. **3 complaints per 1,000 = 0.3% = the blocklist line.** That is
shockingly few complaints — a single bad campaign segment can cross it.

The auth mandate, verbatim (Mailgun):
> "Bulk senders must use both SPF and DKIM. Plus, they need to implement DMARC with a minimum policy
> of p=none."

One-click unsubscribe (RFC 8058), verbatim (Mailgun):
> "Gmail and Yahoo now require one-click unsubscribe functionality, and senders must follow through
> with those unsubscribe requests within two days." (List-Unsubscribe + List-Unsubscribe-Post headers.)
> **CRITICAL nuance (from WebSearch synthesis):** "One-click unsubscribe is required only for
> marketing and promotional messages. Transactional messages are not required to have them." → pigeon
> must KNOW which stream a message is on to apply the right header policy. Adding List-Unsubscribe to
> a password-reset is wrong; omitting it from a newsletter is a 2024-violation.

### C2. The 2025-2026 escalation — p=none is no longer enough headroom
**Source:** https://securityboulevard.com/2025/11/google-and-yahoo-updated-email-authentication-requirements-for-2025/
(dated **2025-11**) + Higher Logic / Mailmodo 2026 guides + Gmail Help FAQ, via WebSearch 2026-06-16.

What changed (the invalidation of 2024 "p=none and chill"):
- **Gmail ramped from "best-effort" to active rejection.** Verbatim (WebSearch synthesis of
  SecurityBoulevard + Mailmodo):
  > "Starting November 2025, Gmail is ramping up its enforcement on non-compliant traffic. Messages
  > that fail to meet the email sender requirements will experience disruptions, including temporary
  > and permanent rejections."
  → 2024 = "you might get filtered." 2026 = "you get a hard 5xx rejection." The grace period ended.
- **Microsoft/Outlook joined the club with its own deadline.** Verbatim (WebSearch synthesis):
  > "Outlook mandates SPF, DKIM, DMARC p=none alignment for 5,000+ daily senders; enforcement begins
  > May 5, 2025."
  → Pre-2025, Outlook had no Yahoogle-equivalent public mandate. Now it does, with ALIGNMENT (not
  just pass) required. Senders who only tuned for Gmail/Yahoo in 2024 got caught by Outlook in 2025.

**The 2026 net-new mental model for pigeon:**
1. p=none was the 2024 *floor*; the direction of travel is toward quarantine/reject. Ship with the
   alignment and complaint hygiene that survives a future p=reject, not the bare 2024 minimum.
2. Enforcement is now THREE providers (Gmail, Yahoo, Outlook/Microsoft), each with its own dates and
   its own quirks (Outlook demands *alignment*, not just SPF/DKIM pass — same trap HN's brewmarche
   flagged in field-03 §Thread-2).
3. "Temporary AND permanent rejections" means a non-compliant sender now sees hard bounces, not just
   spam-foldering — which itself spikes your bounce rate and compounds the reputation hit.

### C3. IP warmup — "slow is fast," and the throttle signal to watch
**Source:** WebSearch synthesis 2026-06-16 of bulkemailsetup.com, suped.com, warmy.io, inboxstack.com
(2026 guides) + emailindustries.com (**2026-04-11**).

Verbatim taste:
> "Sending 50,000 emails from a cold IP on day one is the fastest way to get blacklisted, throttled,
> and permanently flagged as a spammer."
> "Doubling volume every day often outpaces the speed at which mailbox providers update their
> reputation models, so slow is fast here." (the counterintuitive "slow is fast" principle)
> "Sending 50,000 emails on day one from a new IP is a red flag for every major mailbox provider ...
> [it] look[s] nothing like the behavior of a legitimate, established sender." (emailindustries 2026)

The throttle SIGNAL to monitor (verbatim, suped/warmy synthesis):
> "A spike in soft bounces/deferrals (code 421 or 450) from a specific provider means they're
> throttling you — the hallmark sign of a reputation concern during warmup."
> "If Gmail or Outlook is deferring large percentages of your messages rather than delivering or
> rejecting them outright, it is a sign that filters are uncertain about your reputation and are
> buying time to evaluate more data." (emailindustries 2026)

Blocklist recovery cost (verbatim, warmy/bobcares synthesis):
> "A blacklisted IP can take 30-90 days to delist, and even after delisting, ISPs remember the bad
> behavior." Most-impactful lists named: "Spamhaus SBL/XBL, Barracuda BRBL, and Proofpoint (Cloudmark)."

**Lesson for pigeon:** warmup is a CONTROL LOOP, not a fixed schedule. Watch 421/450 deferral rate
per-provider; if it spikes, HOLD volume (don't double) until it clears. The mistake isn't "warming
too slow" — it's "doubling on schedule while the provider is already deferring you." This is why a
domain-expert employee beats a static warmup template.

---

## D. Disputes / unconfirmed (feeds GAPS-AND-DISPUTES)
1. **SES denial opacity — quality-narrative vs. truly arbitrary?** AWS staff (AbdallahAWS) frame it as
   answerable-if-you-engage; multiple users (cesar, the OP) experienced "denied, no reason, security
   reasons" loops even after answering the 4 questions. Unresolved whether better narrative reliably
   fixes it or whether some accounts are silently flagged (IP range, country, card BIN).
2. **The Postmark 98.7% vs SendGrid 95.3% benchmark** is vendor-adjacent (buildmvpfast/mailertogo are
   comparison-affiliate sites). Directionally consistent across 2025 comparisons but I could NOT find
   a neutral, reproducible methodology. Flag as "believed true, not independently verified."
3. **Does a small sender (<5,000/day) need to care about the 2024/2026 bulk rules?** The rules
   formally target 5,000+/day, but Gmail's spam-rate filtering applies to everyone. Sources disagree
   on whether a tiny transactional sender can ignore one-click-unsubscribe (formally yes, since it's
   transactional) — but the safest posture (build it into the marketing stream regardless of volume)
   vs. the minimalist posture (skip it under threshold) is a genuine practitioner split.
