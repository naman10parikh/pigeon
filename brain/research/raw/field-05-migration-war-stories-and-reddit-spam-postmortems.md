---
title: "FIELD — provider migration war-stories (A→B, what broke) + Reddit 'suddenly went to spam' postmortems + the cold-email account-ban trap"
type: source
created: 2026-06-16
tags: [field-intelligence, migration, sendgrid, postmark, resend, mailgun, ses, reddit, account-ban, cold-email, switching-cost]
researcher: FIELD-INTELLIGENCE (pigeon, CP123 Wave-R)
note: "Currency 2024-2026. HN comments verbatim (usernames preserved). Reddit threads exist but were UNREACHABLE by every fetch tool (firecrawl unsupported-site, curl 403, WebFetch blocked, bb no API key) — Reddit findings are quoted from the WebSearch/firecrawl RESULT SNIPPETS of those exact threads, flagged inline as [snippet, not full-thread]. Flag for re-mine when a Reddit-capable tool is available."
---

# Migration war-stories + spam postmortems + the cold-email ban trap

> Scope: what actually breaks when you switch transactional-email providers (A→B), the recurring
> "it worked for years then suddenly hit spam" postmortems, and the under-appreciated trap that
> transactional ESPs will BAN your whole account (transactional included) for one marketing blast.
> This is the "provider-abstraction layer earns its keep" evidence for pigeon.

---

## A. The #1 real migration driver: COST, not deliverability (HN verbatim)

**Source:** HN "Ask HN: What email service(s) do you use for your side projects?" item 41594209
(thread **2024-09-19**), fetched via HN Algolia API 2026-06-16.

- **senko (the canonical A→B migration):** *"Transactional send: Recently switched to Amazon SES from
  Sendgrid (for my volume, SES is free while Sendgrid was ~$20). Receive: gmail (custom domain)"*
  → The most common real migration is **SendGrid → SES, driven purely by price** at low volume.
- **PaulHoule:** *"SES from AZMN. Also mailgun. Even out of the free tier I see these as a good value
  for low volumes of mail (less than 10k per month) ... You have to properly set up your DNS records
  so that all your sending servers authenticate properly."*
- **reducesuffering:** *"For transactional email, I'm using Resend, a newcomer with a very quick and
  polished React/Next.js integration."* → Resend wins on **DX**, SES wins on **price**, and that's
  the actual decision axis for builders (not deliverability benchmarks).
- **birdman3131 (the marketing-vs-transactional ban, foreshadowed):** *"+1 for mxroute. Works great
  for anything but spam or marketing email. Those get a quick ban and a downgrade from valued customer
  to scum of the earth."* → even cheap providers hard-ban marketing on transactional infra (see §D).
- **snozolli (the "don't self-host" capitulation):** *"I was plodding through the steps to set up a
  mail server on my Hetzner instance when I realized I was about to sink a ton of time into a subject
  I know nothing about that would earn me no money. So I did the reasonable thing and signed up for
  Zoho ... I don't have to worry about having a zombie spam server because I misconfigured something."*

**Lesson for pigeon:** migrations are usually COST-driven (SendGrid→SES) or DX-driven (→Resend), and
the migrant assumes deliverability "just carries over." It does NOT (see §B, §C). pigeon's
provider-abstraction layer is what makes the cost-migration safe instead of a deliverability cliff.

## B. What actually BREAKS in a migration (verbatim, 2026)

**Source:** https://blog.vibecoder.me/email-sending-resend-sendgrid-postmark-compared (**2026-04-06**)

The switching-cost reality, verbatim:
> "Migrating email providers means re-verifying domains, updating DNS records, rewriting integration
> code, re-testing every email template, and warming up new sending IPs. The cost of switching is
> 10-20 hours of work minimum."

The shared-pool risk you INHERIT on migration, verbatim:
> "Resend and SendGrid mix transactional and marketing traffic, which can affect your delivery rates
> if other senders on shared IPs behave poorly."

The pick-correctly-upfront taste, verbatim:
> "If your app depends on emails arriving in the inbox within seconds (authentication, payments,
> alerts), Postmark's deliverability focus justifies the higher per-email cost."
> "If you are building a new app with a modern stack and want the best DX: Start with Resend."

**The migration checklist pigeon must own (extracted from the verbatim above):**
1. Re-verify domain (SPF/DKIM/DMARC) on the NEW provider's sending subdomain.
2. Update DNS (new CNAME/TXT for the new provider's DKIM selector).
3. Rewrite integration code behind the abstraction (one file if abstracted; app-wide if not).
4. Re-test EVERY template on the new provider (rendering differs — see field-01).
5. **Warm up the NEW IP/subdomain from zero** — reputation does NOT transfer between providers.

## C. The migration killer nobody plans for: reputation does NOT transfer

**Source:** https://xmit.sh/versus/resend-vs-postmark (**2026**), via WebFetch 2026-06-16.

The no-native-migration-tool reality, verbatim:
> "Both platforms store message history separately ... there is no native migration tool."
> "You must manually export logs within Resend's retention window before switching."

The retention trap that bites compliance/audit on migration, verbatim:
> "Postmark caps data retention at 45 days, charges $1.50/1K at scale."
> "Resend retention varies by plan: Free retains 1 day, Pro retains 3 days, and Scale retains 7 days."
→ **If you switch off Resend, you have as little as 1-7 days of log history to export.** Plan the
export BEFORE you flip DNS, or you lose your sending audit trail.

The stream-isolation difference that changes deliverability on arrival, verbatim:
> "Resend defaults to a shared pool unless you configure dedicated IPs. Postmark enforces message
> stream separation ... isolates transactional and broadcast traffic into separate IP pools."

The warmup-tooling gap, verbatim:
> "Resend has no warmup tooling." (vs. competitors offering "automated warmup with auto-pause on high
> bounce rates")
→ **Migrating TO Resend means you own warmup manually.** No auto-pause on bounce spike = you can
blocklist a fresh domain in a day if you blast on arrival (field-04 §C3 warmup control loop).

## D. The cold-email / marketing-on-transactional-infra BAN trap (the dark side of stream separation)

**Source:** WebSearch + https://puzzleinbox.com/blog/postmark-vs-mailgun-cold-email-2026 (2026),
fetched 2026-06-16.

Postmark's stance, verbatim (puzzleinbox 2026):
> "Cold outreach, bulk marketing to unverified lists, and any unsolicited messaging are explicitly
> prohibited." Postmark "suspend[s] cold-email accounts within days of detection."

The catastrophic war-story [snippet, from a Postmark review surfaced via WebSearch — flagged as
one-sided review claim, not independently confirmed]:
> "Postmark shut down an entire account after a single B2B broadcast, despite clear explanation at
> signup, and transactional emails were blocked as well."
→ **The nightmare scenario:** you send ONE marketing blast from your transactional provider, they
suspend the WHOLE account, and now your password-reset and receipt emails are dead too. The stream
separation taste (field-04 §B) is not optional politeness — violating it can take down your
transactional pipeline entirely.

Mailgun's thresholds, verbatim (puzzleinbox 2026):
> Mailgun's AUP "bans unsolicited mail and requires verifiable opt-in for all recipients," enforced
> via "complaint and bounce thresholds (roughly 0.1% complaints, 5% bounces)."

The structural reason (verbatim), which is the WHOLE justification for provider/stream separation:
> "When one tenant generates spam complaints, Gmail and Microsoft downgrade the reputation of the
> entire pool, which means every other customer on those IPs sees worse inbox placement."

The operator directive, verbatim:
> "If you are currently routing cold through Postmark or Mailgun, migrate before the suspension."

**Lesson for pigeon:** pigeon MUST tag every outbound message with its stream (transactional vs
marketing vs cold-outreach) and HARD-REFUSE to route marketing/cold through a transactional-only
provider (Postmark/Resend-transactional). Routing cold email through Postmark is not a deliverability
risk — it's an account-death risk. This is a guardrail, not a tuning knob.

## E. The official "we got compromised, how do we recover" runbook (postmortem-as-doc)

**Source:** https://support.sendgrid.com/hc/en-us/articles/38348078855067-Restore-SendGrid-Reputation-After-a-Compromise-IPs-Domains
(SendGrid official support, current 2026), via WebFetch 2026-06-16.

SendGrid's own numbered recovery runbook, verbatim:
1. *"Stop sending emails for a few days. This pause will help prevent further damage to your sending
   reputation."*
2. *"After the pause, start a manual warmup process. Gradually increase your sending volume to rebuild
   your reputation."* (dedicated-IP plans)
3. *"Ensure you have a DMARC record set up for all your sending domains."*
4. *"Adhere to the deliverability guidelines for major email providers like Google, Microsoft, and
   Yahoo."*
5. Remove unengaged recipients; improve content.
6. Monitor *"Engagement Recency and Unique Open rates."*
7. *"Subscribe to Feedback Loops"* — Google Postmaster Tools, Microsoft SNDS, Yahoo CFL.
8. Contact Google/Microsoft/Yahoo support directly.

The recovery-timeline truth, verbatim (paraphrased from the doc):
> "Internal reputation restoration happens relatively quickly; external reputation recovery with
> recipient servers takes approximately one month of consistent good sending practices."

**Lesson for pigeon:** a reputation crash is a ~30-day recovery (matches the 30-90 day blocklist
delisting in field-04 §C3). The runbook = pause → warm slow → fix auth → subscribe FBLs → grind.
pigeon should automate steps 1-2-3-7 (auto-pause on bounce/complaint spike, slow re-warm, verify
DMARC, wire Postmaster/SNDS/CFL) so recovery isn't a manual scramble.

## F. Reddit "suddenly went to spam" postmortems [snippets — full threads unreachable, see note]

Reddit was hard-blocked by every fetch tool I had. These are quoted from the WebSearch/firecrawl
RESULT SNIPPETS of the exact threads (URLs given); each is flagged [snippet]:

- **r/email "My transactional emails started going to spam three days ago"** (item 1bk0fvo,
  https://www.reddit.com/r/email/comments/1bk0fvo/) — [snippet]:
  *"I had no issues with my emails using Sendgrid for a few years, and suddenly, my emails started
  going to Gmail spam a few days ago."* → The classic "stable for years, then a cliff" — usually a
  shared-IP-pool neighbor going bad, or crossing Gmail's tightened 2024/2025 thresholds (field-04 §C).
- **r/SendGrid "Email deliverability - Landing in spam"** (item 1jghwht,
  https://www.reddit.com/r/SendGrid/comments/1jghwht/) — [snippet]:
  *"I noticed that my emails were landing in the spam folder, and both of my domains were blocklisted
  by Suomispam Reputation. Additionally, both domains share the ..."* → **Suomispam** named as the
  blocklist; sharing infrastructure across two domains spread the contamination.
- **r/SendGrid "Email Open Rates Tanked After Switching to SendGrid"** (item 1ew7w2l) — [snippet]:
  *"The IP address (from SendGrid) your email sources from may have become associated with Spam
  traffic. Request a new IP address."* → migration-INTO-SendGrid landed the user on a dirty shared IP.
- **r/rails "What are you using for transactional emails in production?"** (item 1kw3cv5,
  2025) — [snippet]: *"Gmail account for transactional emails is a guaranteed way to land in spam, as
  those servers aren't trusted for high-volume application emails."* → the "don't send app email
  through a Gmail SMTP relay" taste, stated bluntly.
- **r/Emailmarketing "My email goes to spam"** (item 1jexpe8) — [snippet]:
  *"If your emails are landing in spam despite setting up SPF, DKIM, and DMARC, start by checking your
  sender reputation using Google Postmaster Tools or MXToolbox."* → reinforces field-03's TASTE: auth
  is necessary-not-sufficient; reputation (via Postmaster Tools) is the next layer.

## G. Disputes / unconfirmed (feeds GAPS-AND-DISPUTES)
1. **Self-hosting deliverability — myth or reality?** (HN Cloudflare-Email thread, item 45373081,
   **2025-09-25**, fetched via Algolia):
   - **PRO "residential/VPS IP = spam by default":** *implements:* *"Gmail etc are going to treat as
     spam most emails that turn up from a residential or VPS linked IP address ... you need a
     middleman one for important recipients if you want to be sure it gets into an inbox."*
   - **CONTRA "it's a myth, just configure it right":** *dw64:* *"Having hosted a small mail server
     for friends for over a decade now, I can only think of this as a myth. Gmail has specific bulk
     (!) sender requirements, which to my knowledge don't include a blanket downranking of residential
     and 'VPS' IPs ... You need TLS, SPF, DKIM, DNS and reverse DNS entries that align, ideally DMARC
     and that's pretty much it."* — AND dw64's real war-story: *"At one point I misconfigured a relay
     as unauthenticated and we got abused by spammers for a day. We got put on all s[pam lists]..."*
   - **CONTRA (corroborating dw64):** *SahAssar:* *"In my experience deliverability to gmail is not
     that hard if you configure stuff correctly. You need a clean IP and domain, rDNS and the usual
     email stuff like DKIM, DMARC, SPF, but not much else."*
   → **DISPUTE:** can a self-hoster reliably hit the Gmail inbox? implements says no (need a relay);
   dw64/SahAssar say yes IF perfectly configured AND low-volume. Both agree one misconfig = instant
   blocklist. pigeon's stance: technically possible, operationally fragile — a managed provider is the
   default, self-host is an expert escape hatch.
2. **The Postmark "banned my whole account for one broadcast" story** is a single review claim
   surfaced via WebSearch (§D). The POLICY (Postmark bans cold/bulk) is well-documented and
   independently confirmed; the specific "transactional was ALSO blocked" severity is one-sided and
   unverified — flag as plausible-but-uncorroborated.
3. **Is SendGrid's shared pool meaningfully dirtier than Resend's/SES's?** Multiple Reddit snippets
   (§F) and the vibecoder piece (§B) say SendGrid shared IPs get contaminated; but these are
   anecdotes + a comparison-site. No neutral measurement of relative shared-pool hygiene across
   SendGrid vs SES vs Resend was found. Flag as "widely believed, not measured."
