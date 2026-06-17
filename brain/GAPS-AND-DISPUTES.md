---
title: "GAPS-AND-DISPUTES — where sources disagree, where evidence is missing, what's unconfirmed"
type: synthesis
created: 2026-06-16
updated: 2026-06-16
tags: [gaps, disputes, unconfirmed, deliverability, experiments-needed, pigeon]
sources:
  - "research/raw/field-00-internal-corpus.md"
  - "research/raw/field-01-github-react-email-rendering-gotchas.md"
  - "research/raw/field-02-resend-node-sdk-gotchas.md"
  - "research/raw/field-03-hn-deliverability-folklore-disputes.md"
  - "research/raw/field-04-ses-sandbox-stream-separation-2026-rules.md"
  - "research/raw/field-05-migration-war-stories-and-reddit-spam-postmortems.md"
  - "research/raw/field-06-list-unsubscribe-rfc8058-and-cloudflare-inbound-resolved.md"
summary: "The honest ledger: genuine practitioner disputes (both sides quoted), claims believed-but-unverified, and corpus gaps pigeon must close by its own experiments."
related:
  - "[[OPINIONS]]"
  - "[[BATTLE-TESTED-SCENARIOS]]"
  - "[[EXPERTISE-MAP]]"
---

# GAPS-AND-DISPUTES

> Three kinds of entry: **DISPUTE** (credible people disagree — both sides captured), **UNVERIFIED**
> (a claim that's believed but not independently measured), and **CORPUS-GAP** (no good source exists;
> pigeon must form its own view via experiment). Each says what pigeon should DO about it. The
> intellectually honest move is to hold these loosely and resolve them empirically.

---

## DISPUTES — credible practitioners disagree (both sides)

### G-01 — Do mailbox providers gate the inbox on OPAQUE reputation beyond SPF/DKIM/DMARC?
- **YES (self-hosters, emphatic):** csomar — "you need to have a 'reputation' before your email gets
  accepted into gmail... my head was spinning." upofadown — "SPF/DKIM is really about mail server
  reputation." pas — "MS flat out refuses to unblock our IP on their 'outlook protection' racket."
- **NO / FUD (protocol purists):** trod1234 — "This attitude is just FUD... the large ESPs don't refuse
  to relay your email based on secret internal factors." witrak — "oversimplified... leads to wrong
  conclusions."
- **pigeon's resolution:** auth is necessary-not-sufficient (O-09); reputation is REAL for self-hosters
  but Resend/Postmark/SES ABSTRACT it via managed/shared reputation. The dispute is about *how opaque*
  it is for a managed sender, not whether reputation exists. Don't promise inbox placement from auth
  alone; don't claim secret conspiracies either.
- **Source:** `field-03` THREAD-1. **Status:** genuine, unresolved on the "how opaque" axis.

### G-02 — Do big senders get DMARC/SPF exceptions ("Google learns to ignore your broken config")?
- **ASSERTED:** avian — "if you're a big enough player Google learns to ignore your broken DMARC config
  or somebody knows somebody on the inside who can add an exception." Upwork demonstrably ships email
  failing its own SPF and survives.
- **REJECTED (implied):** RFC-purists (KomoD-style) would call this unverifiable folklore.
- **pigeon's resolution:** treat as PLAUSIBLE-BUT-UNCONFIRMED. Never cargo-cult a big company's broken
  config (meta-stance in [[OPINIONS]]). Being tolerated ≠ being correct.
- **Source:** `field-03` THREAD-3 (avian, Upwork). **Status:** widely believed, no confirmation.

### G-03 — Are DMARC reports worth processing for a SMALL sender?
- **YES:** zippergz — reports are "good for finding gaps in your DMARC policy... 'oops, I forgot the
  helpdesk ticketing system.'"
- **MOSTLY NOISE:** sshine — "collecting reports ever since, because I'm not sure why I should care."
  josefresco — "reports are sent, not much is found. Client is billed. Client grumbles."
- **pigeon's resolution:** reports are HIGH-value during the `p=none → p=reject` transition (to enumerate
  senders, SCN-02) and LOW-value as steady-state noise afterward. Process them for the transition, then
  sample.
- **Source:** `field-03` THREAD-2. **Status:** context-dependent; resolved by phase.

### G-04 — Is Postmark's 98.7% vs SendGrid's 95.3% inbox-placement gap real?
- **CLAIMED:** "Independent testing shows Postmark achieved 98.7% inbox placement versus SendGrid's
  95.3% on transactional emails." The >3pt gap is consistent across multiple 2025 comparisons.
- **CAVEAT:** the sources (buildmvpfast, mailertogo) are comparison/affiliate sites — vendor-adjacent.
  No neutral, reproducible methodology was found.
- **pigeon's resolution:** treat DIRECTIONALLY (Postmark leads on transactional deliverability) but NOT
  as a hard number. O-18 is "match provider to job," not "Postmark wins by 3.4 points."
- **Source:** `field-04` §B2, §D.2. **Status:** believed true, not independently verified.

### G-05 — Will a transactional provider really block your TRANSACTIONAL mail too, for one marketing blast?
- **CLAIMED (one-sided review):** "Postmark shut down an entire account after a single B2B broadcast...
  transactional emails were blocked as well."
- **CONFIRMED part:** the BAN POLICY (Postmark/Mailgun prohibit cold/bulk and suspend accounts) is
  independently documented.
- **UNCONFIRMED part:** the severity that transactional was ALSO blocked is a single review claim.
- **pigeon's resolution:** the guardrail (O-02, HARD-REFUSE cold-on-transactional) stands regardless —
  even "account suspended, transactional paused pending review" is catastrophic. Don't overstate the
  specific story; do enforce the guardrail.
- **Source:** `field-05` §D, §G.2. **Status:** policy confirmed, worst-case severity unverified.

### G-06 — Can a self-hoster reliably hit the Gmail inbox?
- **NO (need a relay):** implements — "Gmail etc are going to treat as spam most emails from a
  residential or VPS-linked IP... you need a middleman."
- **YES, IF perfectly configured + low volume:** dw64 — "I can only think of this as a myth... You need
  TLS, SPF, DKIM, DNS and reverse DNS that align, ideally DMARC and that's pretty much it." SahAssar —
  "not that hard if you configure stuff correctly."
- **BOTH AGREE:** one misconfig = instant blocklist (dw64 got on "all spam lists" from a day as an open
  relay).
- **pigeon's resolution:** technically possible, operationally fragile → managed provider is the default
  (O-16), self-host is an expert escape hatch. The dispute is about the failure *rate*, not the
  mechanism.
- **Source:** `field-05` §G.1. **Status:** genuine; resolved as "possible but fragile."

### G-07 — Does DKIM truly need to cover the List-Unsubscribe headers, or do providers tolerate it unsigned?
- **MUST (RFC + 2025 guides):** "The message MUST have a valid DKIM signature that covers at least the
  List-Unsubscribe and List-Unsubscribe-Post headers."
- **OMITTED in practice:** Paul's practitioner post (2024) focuses on POST-only + opaque IDs and doesn't
  mention DKIM coverage at all — suggesting it may be tolerated unsigned in some cases, or Paul
  under-specified.
- **pigeon's resolution:** follow the MUST (cover the headers in DKIM `h=`) — it's free insurance. Flag
  for empirical check: does Gmail honor the one-click button if the headers aren't DKIM-covered?
- **Source:** `field-06` §A2, §D.1. **Status:** spec says MUST; real-world strictness unverified → DEFAULT
  to MUST, verify empirically.

---

## UNVERIFIED — believed but not measured

### G-08 — Is SendGrid's shared pool meaningfully dirtier than Resend's / SES's?
- **BELIEVED:** multiple Reddit snippets (r/SendGrid: "request a new IP," domains blocklisted by
  Suomispam) + the vibecoder comparison say SendGrid shared IPs get contaminated.
- **GAP:** no NEUTRAL measurement of relative shared-pool hygiene across SendGrid vs SES vs Resend.
- **pigeon's DO:** don't assert a ranking; the abstraction (O-18) makes pool quality a swappable
  variable. If a tenant reports contamination, move streams, don't theorize.
- **Source:** `field-05` §F, §G.3. **Status:** anecdotal, unmeasured.

### G-09 — Did Energy ever run a Cloudflare Email Routing INBOUND POC, and what broke?
- **CONFIRMED:** CF Email Routing is the energy-DESIGNED inbound path (free forwarding → webhook →
  AgentDial gateway). The split is Resend=outbound, CF=inbound.
- **UNCONFIRMED:** any EXECUTED POC with a written postmortem of it breaking for transactional-reply
  routing. The only documented inbound BREAKAGE is the AgentMail per-user-key webhook bug — NOT a
  Cloudflare one.
- **pigeon's DO:** this is the #1 CORPUS-GAP to close by ACTION — wire CF Email Routing inbound, route a
  reply through the gateway, and write the first real inbound postmortem. Until then, treat inbound-via-CF
  as designed-but-unproven internally.
- **Source:** `field-00` §5, `field-06` §B, §D.2. **Status:** design confirmed, execution unproven.

### G-10 — SES denial: quality-of-narrative fixable, or are some accounts silently flagged (IP range / country / card BIN)?
- **STAFF FRAME (answerable):** AbdallahAWS frames the four questions as answerable-if-you-engage.
- **USER REALITY (opaque):** the OP and cesar hit "denied, no reason, security reasons" loops EVEN AFTER
  answering. Suggests some accounts are flagged on signals you can't see.
- **pigeon's DO:** maximize the controllable (auth + site + crisp narrative, O-17) AND have a fallback
  plan (use Resend/Postmark instead of fighting SES) for accounts that hit the silent-flag wall.
- **Source:** `field-04` §A1, §D.1. **Status:** partially controllable; silent-flag hypothesis unconfirmed.

### G-11 — Must a SMALL sender (<5,000/day) actually care about the 2024/2026 bulk rules?
- **FORMALLY:** the rules target 5,000+/day senders; one-click unsubscribe is formally required only for
  marketing, and transactional is exempt.
- **PRACTICALLY:** Gmail's spam-rate filtering applies to EVERYONE regardless of volume; the Nov-2025
  hard-rejection ramp doesn't carve out tiny senders on the hygiene axis.
- **SPLIT:** safest posture (build one-click into marketing regardless of volume) vs minimalist (skip
  under threshold). A genuine practitioner split.
- **pigeon's DO:** default to the SAFE posture (build it; it's cheap) but expose that it's formally
  optional under threshold so a user can make an informed call.
- **Source:** `field-04` §C1, §D.3. **Status:** genuine posture split; pigeon defaults safe.

---

## CORPUS-GAPS — no good source; pigeon must generate the evidence

### G-12 — resend-node BOUNCE / WEBHOOK-handling bug corpus is UN-mined.
- **WHY:** `gh search issues --repo resend/resend-node` for bounce/webhook returned non-JSON twice
  (CLI/auth flakiness). The bounce REQUIREMENT is well-established (SES gate, Mailgun AUP, SendGrid
  runbook) but the resend-node-SPECIFIC bounce/webhook failure stories aren't captured.
- **pigeon's DO:** RE-MINE with a working `gh` invocation; until then, build bounce handling from the
  provider-agnostic requirement (`field-06` §C) not from Resend-specific war-stories.
- **Source:** `field-01` §D, `field-06` §D.3.

### G-13 — `resend/react-email` has ZERO deliverability/DKIM/DMARC/SPF issues — by design, leaving a one-repo blind spot.
- **CONFIRMED EMPTY:** `gh search issues --repo resend/react-email "deliverability OR DKIM OR DMARC OR
  SPF"` → `[]`. Expected: react-email is the RENDERING lib; deliverability lives in the (closed) Resend
  platform + DNS.
- **IMPLICATION:** the OSS repo only yields rendering/build war-stories. Deliverability evidence must
  come from forums/blogs/postmortems (field-02 through field-06), never the rendering repo.
- **pigeon's DO:** don't look for deliverability bugs in react-email; mine the platform/DNS/forum layer.
- **Source:** `field-01` §D.

### G-14 — Reddit "suddenly went to spam" postmortems are SNIPPET-ONLY (full threads unreachable).
- **WHY:** Reddit was hard-blocked by every fetch tool (firecrawl unsupported-site, curl 403, WebFetch
  blocked, bb no API key). Findings are quoted from WebSearch/firecrawl RESULT SNIPPETS of the exact
  threads, flagged inline.
- **pigeon's DO:** RE-MINE with a Reddit-capable tool when available; the snippets corroborate the
  shared-pool-contamination thesis but the full diagnostic detail (what the OP actually changed) is
  missing.
- **Source:** `field-05` note + §F.

### G-15 — No reproducible, neutral inbox-placement benchmark methodology exists in the corpus.
- **WHY:** every placement number found (Postmark 98.7% etc.) is vendor-adjacent.
- **pigeon's DO:** if placement claims matter for a decision, run a controlled seed-list test (e.g.
  GlockApps-style) rather than citing a comparison site. This is a measurement pigeon can OWN.
- **Source:** `field-04` §D.2, `field-05` §G.3.

---

## How pigeon should treat this file

1. **Resolve by experiment, not by argument.** G-07, G-09, G-12, G-14, G-15 are closable by ACTION —
   prioritize wiring/testing over re-reading.
2. **Default safe on the posture splits** (G-11: build one-click; G-07: cover DKIM) — cheap insurance.
3. **Never overstate.** When citing a disputed/unverified claim downstream, carry the flag (e.g. "the
   98.7% figure is vendor-adjacent"). Honesty about uncertainty is itself a taste signal.
4. **The biggest single gap is INBOUND (G-09):** the fleet has a thin inbound corpus. The first real
   Cloudflare Email Routing inbound postmortem pigeon writes is net-new fleet knowledge.
