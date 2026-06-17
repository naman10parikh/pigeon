---
title: "FIELD — HN deliverability folklore: TASTE, war-stories, and where credible people DISAGREE"
type: source
created: 2026-06-16
tags: [field-intelligence, hackernews, deliverability, dmarc, spf, dkim, reputation, taste, disputes]
researcher: FIELD-INTELLIGENCE (pigeon, CP123 Wave-R)
note: "Verbatim HN comments (usernames preserved). This file is the primary feed for GAPS-AND-DISPUTES — both sides captured. Threads dated 2024-2026; flagged where older."
---

# HN deliverability folklore — what engineers learned the hard way (verbatim)

## THREAD 1 — "Spammers are better at SPF, DKIM, and DMARC than everyone else"
**Source:** https://news.ycombinator.com/item?id=43468995 — **dated 2025-03-25**

**Thesis (verbatim framing):** spammers demonstrate *superior* technical competence at email auth vs
legitimate orgs — "people whose business is sending email know how to set it up correctly" while
"legitimate sysadmins struggle with getting the basics correct."

### The CENTRAL DISPUTE (capture both sides — this is GAPS material)

- **PRO "secret reputation rules exist" side:**
  - **csomar:** *"I am just having this problem... you need to have a 'reputation' before your email
    gets accepted into gmail... my head was spinning."*
  - **upofadown:** *"SPF/DKIM is really about mail server reputation... attempts by those larger
    providers will naturally hurt smaller providers."*
  - **pas:** *"MS flat out refuses to unblock our IP on their 'outlook protection' racket."*
- **CONTRA "it's FUD, no secret factors" side:**
  - **trod1234:** *"This attitude is just FUD... Google, Microsoft, and the other large ESPs don't
    refuse to relay your email based on secret internal factors."*
  - **witrak:** *"It is an oversimplified way of evaluating... it leads to wrong conclusions... Yes,
    it makes difficult life for small amateur spammers as strongly as for beginner administrators."*

→ **DISPUTE for GAPS-AND-DISPUTES:** *Do mailbox providers gate inbox placement on opaque
reputation beyond SPF/DKIM/DMARC?* Practitioners with their own servers (csomar, pas, upofadown) say
YES emphatically; protocol-purists (trod1234, witrak) call it FUD. pigeon's stance must acknowledge
both: auth is necessary-not-sufficient; reputation is real for self-hosters but Resend/Postmark/SES
abstract it via shared+managed reputation.

### Hard-won gotchas (verbatim)
- **jeroenhd:** *"some part of an Enterprise Outlook mail filtering chain was rewriting the mail I
  sent before checking the DKIM signature"* → **corporate middleware rewrites headers/body, THEN
  checks DKIM on its own modification, breaking the signature.** A real, maddening failure.
- **cuu508:** IP warming — *"in the industry this is called 'warming up IP addresses'."*
- **wruza (the outsider's taste):** *"if a system... requires much more than just putting it into a
  folder with a domain name... it's badly designed."* (The "email auth is over-complex" minority view.)

## THREAD 2 — "I figured out how DMARC works, and it almost broke me"
**Source:** https://news.ycombinator.com/item?id=39712634 — **dated 2024-03-15** (flagged: 2yr old,
but DMARC alignment mechanics are stable; still trustworthy on fundamentals)

### War stories (verbatim)
- **brewmarche (the key technical correction):** *"DMARC ensures alignment with the From header as
  well which SPF and DKIM don't do"* and can require *"strict alignment (exact domain) or allow
  subdomains as well."* → **Alignment is the thing people miss.** SPF/DKIM can PASS while DMARC FAILS
  because the authenticated domain doesn't *align* with the visible `From:` domain.
- **zippergz (what DMARC reports are actually for):** *"DMARC reports are... good for finding gaps in
  your DMARC policy. Like 'oops, I forgot to add the helpdesk ticketing system.'"*
- **sshine (the cynic):** *"I set up SPF, DKIM and DMARC on my email 3-4 years ago... I've been
  collecting reports ever since, because I'm not sure why I should care."*
- **josefresco (the consultant's reality):** *"Client has a spoofing problem, we setup DMARC, reports
  are sent, not much is found. Client is billed. Client grumbles."*
- **doctor_lollipop (the IPv6 trap):** *"Sending to Gmail works via IPv4 but they reject anything I
  send via IPv6. That was fun to figure out."* → **Gmail treats IPv6 senders far more harshly;**
  a real deliverability gotcha (IPv6 needs PTR + stricter auth).
- **RedShift1:** DKIM is *"a weak version of digitally signed email"* where *"tampering invalidates
  the signature (for example when an email gets relayed for a second time)."*

### Gotcha summary
- **Alignment (relaxed vs strict)** is the #1 thing that breaks DMARC for senders who have SPF+DKIM
  passing — third-party senders (helpdesk, billing, marketing ESP) on a different domain fail
  alignment.
- **Third-party sender enumeration** before `p=reject` is mandatory — you WILL forget one (zippergz).
- **IPv6 to Gmail** = reject-prone; prefer IPv4 or get PTR + auth perfect.

## THREAD 3 — "Upwork Inc. violates its own DMARC and SPF policy"
**Source:** https://news.ycombinator.com/item?id=47659603 — discussion ~mid-2024 (per fetched analysis)

### The failure (verbatim from thread)
> *"at least some (if not all) of the system emails that are generated and sent by the Upwork
> marketplace go through MailGun - and their IP addresses are missing from the SPF policy for
> upwork.com"* — i.e. a major company's **own transactional email failed its own SPF** because the
> ESP's IPs weren't in the record.

### Insightful comments (verbatim)
- **avian (the "big players get exceptions" theory):** *"My guess is if you're a big enough player
  Google learns to ignore your broken DMARC config or somebody knows somebody on the inside who can
  add an exception."*
- **winstonwinston (terminology correction):** *"There is no 'strict' policy. DMARC policy can be one
  of the following p= {none, quarantine, reject}."* (People conflate DMARC *policy* with SPF/DKIM
  *alignment* strictness — distinct concepts.)
- **KomoD (tooling skepticism):** *"Those tools aren't using the macro which means they are not
  following the RFC, stop using crappy online tools and wasting people's time."* → **online SPF
  checkers misreport** because they don't evaluate SPF macros (e.g. Valimail's
  `include:%{i}._ip.%{h}._ehlo.%{d}._spf.vali.email`).

### Hard rules extracted
- **SPF has a HARD 10-DNS-lookup limit (RFC 7208 §4.6.4).** Every `include:` (ESP, marketing, billing)
  counts. Adding one more ESP can silently break SPF for ALL mail. This is the #1 SPF footgun.
- **Even Upwork ships broken transactional-email auth** — being big doesn't mean it's right; it means
  providers may have learned to tolerate you (avian's theory; disputed but widely believed).

## Cross-thread DISPUTES to feed GAPS-AND-DISPUTES
1. **"Secret reputation beyond auth" — real or FUD?** (Thread 1: csomar/pas/upofadown YES vs
   trod1234/witrak FUD).
2. **"Big senders get DMARC exceptions" — real or myth?** (Thread 3: avian asserts it; no one
   confirms; KomoD-style purists would reject it).
3. **"Are DMARC reports worth processing for a small sender?"** (Thread 2: zippergz YES / sshine &
   josefresco "mostly noise, bill the client").

## TASTE statements great practitioners hold (that average ones don't)
- Authentication is **necessary but not sufficient** — passing SPF/DKIM/DMARC does NOT get you to the
  inbox; reputation + engagement do (csomar, upofadown).
- **DMARC alignment, not just SPF/DKIM pass, is what actually matters** (brewmarche).
- **The 10-lookup SPF limit is a ticking bomb** — minimize `include:`s, flatten where safe (KomoD).
- **Corporate middleware breaks DKIM by rewriting** — your signature failing isn't always your fault
  (jeroenhd).
- **IPv6 to Gmail is a trap** — prefer IPv4 (doctor_lollipop).
