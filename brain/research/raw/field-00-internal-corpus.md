---
title: "FIELD — Internal Energy corpus (AgentMail / Resend / Cloudflare-Email-Workers / Comms checklist)"
type: source
created: 2026-06-16
tags: [field-intelligence, internal, agentmail, resend, deliverability, comms]
researcher: FIELD-INTELLIGENCE (pigeon, CP123 Wave-R)
note: "READ-ONLY mining of ~/energy. These are the fleet's own war-stories — quote, do not edit source."
---

# Internal corpus — what Energy already learned about transactional email

> Scope: pigeon = the fleet's future **Transactional email + notifications** domain-expert employee.
> Before mining the public web, mine our own scar tissue. Every line below is sourced to an energy file.

## 1. AgentMail — the per-user-key webhook bug (a real production fix)

**Source:** `~/energy/memory/daily/2026-04-06.md` lines 6-10 (dated 2026-04-06)

Verbatim:
> **Email: per-user AgentMail keys (4 commits)**
> - Changed from platform key (shared 3-inbox limit) to per-user keys
> - CRITICAL BUG FIXED: webhook was using platform key for ALL users' replies

**Why this matters for pigeon (the lesson, generalized):**
- A SHARED API key across all tenants is a deliverability + privacy landmine. The "3-inbox limit"
  on the platform key was a hard scaling wall; the webhook bug meant one tenant's inbound replies
  were being processed under the *platform's* identity, not the user's — a cross-tenant leak class.
- **Transactional-email design rule extracted:** isolate sending identity per tenant from day one.
  Shared keys conflate reputation (one bad tenant tanks everyone) AND leak replies. This is the
  internal echo of the public "shared IP pool" deliverability disaster (see field-01).

## 2. Resend is the canonical default — but only "keyed in alpha" (a GAP, not done)

**Source:** `~/energy/audit/HARNESS-CHECKLIST-2026.md` line 77

Verbatim:
> - [ ] **Transactional email + notifications** — Resend / Postmark / Loops + Knock·Novu
>   (push / SMS / in-app) — _partial (Resend keyed in alpha)_

**Source (the 5-agent completeness swarm that surfaced it):** `memory/LEARNINGS.md` line 110 (2026-06-03)
> Added to `HARNESS-CHECKLIST-2026.md` as Part C2: secrets management (#1 gap) · error/crash
> monitoring (Sentry) · analytics+flags (PostHog) · **transactional email (Resend)** · jobs/queues/
> webhooks (Inngest/Trigger.dev) · object storage (R2) · rate-limit/cache (Upstash) · ...
> **Ground-truth scan of our repos: almost all are GAPs** (only `.env`+gitignore, `node-cron`,
> Resend-in-alpha exist). **Lesson: when asked "did you cover everything?", run a ground-truth
> swarm — the gaps are the boring-but-mandatory infra (secrets, errors, email, queues, rate-limit)
> that agent-builders skip because it's "not the agent."**

**Lesson for pigeon:** transactional email is exactly the "boring-but-mandatory" infra builders skip.
pigeon's whole reason to exist is that "Resend-keyed-in-alpha" is NOT done — keying an SDK ≠ a
deliverability-correct sending setup (SPF/DKIM/DMARC, warmup, stream separation, bounce handling).

## 3. AgentDial wires SendGrid + AgentMail as the email channel (two providers, already)

**Source:** `~/energy/audit/HARNESS-CHECKLIST-2026.md` line 104

Verbatim:
> **Reality (verified 2026-06-03):** the gateway is real + tested (79 tests pass) and **7/9 channel
> adapters are real code** (Telegram·Discord·Slack·**email[SendGrid+AgentMail]**·SMS·WhatsApp·
> voice[Twilio+VAPI]) — **but 0 channels are live today** (all need creds)...

**Lesson for pigeon:** the fleet already has a *multi-provider* email posture (SendGrid for one path,
AgentMail for agent-inbox replies). pigeon should own the provider-abstraction + the deliverability
correctness layer ABOVE whichever SDK is wired. "Adapter code exists but no creds = not reachable"
is the same trap as "SDK keyed but DNS not authenticated = lands in spam."

## 4. Identity-as-reachability boundary (where transactional email sits in the fleet)

**Source:** `memory/LEARNINGS.md` line 111 (2026-06-03 chairman framing) + `HARNESS-CHECKLIST-2026.md` lines 96-105

- Transactional email is a FACE of **Identity (component #1, owned by AgentDial)** on the
  *reachability* axis (phone/email/WhatsApp/iMessage/SMS/voice/web), NOT a 13th component.
- BUT the Product-Surface checklist *also* lists "Transactional email + notifications" as C2
  operational infra (line 77). So pigeon spans BOTH: the *channel* (Identity reachability) and the
  *infra* (C2 transactional-email correctness). pigeon = the deliverability-correct sending layer.

## 5. Cloudflare-Email-Workers / Resend POC history — what I could and could NOT find

**Searched:** `grep -ril "cloudflare.*email\|email.*worker\|resend"` across memory/ tasks/ logs/ docs/.
**Hits (Resend):** LEARNINGS.md (above), docs/architecture/SWARM-ARCHITECTURE.md,
docs/identity/ARCHITECTURE.md + RESEARCH.md, docs/architecture/AGENTDIAL-STRATEGIC-PLAN.md,
several chairman-prompts + daily logs (2026-03-30, 2026-04-06).
**Could NOT confirm:** a dedicated Cloudflare *Email Workers* POC with a written postmortem. The
"email worker" grep hits are mostly the SWARM/AgentDial architecture docs referencing Resend as the
default provider, not a Cloudflare-Email-Routing inbound experiment with documented breakage.
→ FLAG for GAPS-AND-DISPUTES: "Did Energy ever run a Cloudflare Email Routing inbound POC, and what
broke?" is unconfirmed from the daily logs I could read. The concrete documented email war-story is
the AgentMail per-user-key webhook bug (§1), not a Cloudflare one.

**[UPDATE 2026-06-16 — partially RESOLVED in field-06 §B]:** Reading `docs/identity/RESEARCH.md`
(lines 196-219) + `docs/identity/ARCHITECTURE.md` (lines 178-188) confirms the DESIGN intent:
Energy's planned split is **Resend = outbound (transactional send)** and **Cloudflare Email Routing =
inbound (free forwarding → webhook → AgentDial gateway)** ("**Inbound:** Cloudflare Email Routing →
webhook → gateway", verbatim). So Cloudflare Email Routing IS the planned inbound path — but there is
still NO executed POC with a written postmortem of it breaking. Gap downgraded from "unconfirmed
whether planned" to "confirmed planned, never proven; inbound war-story corpus is thin." See field-06 §B.

## 6. Generalized rules pigeon inherits from the fleet's email scar tissue

1. **Per-tenant sending identity from day one** (AgentMail bug §1) — never a shared key/IP that
   conflates reputation or leaks replies across tenants.
2. **"Keyed" ≠ "done"** (Resend-in-alpha §2) — wiring an SDK is the easy 20%; deliverability
   correctness (auth + warmup + streams + bounces) is the 80% pigeon owns.
3. **Multi-provider abstraction** (SendGrid+AgentMail §3) — own a provider-agnostic layer so a
   provider migration (A→B) is a config change, not a rewrite. (Public migration war-stories: field-03.)
4. **It's the boring infra builders skip** (§2 swarm lesson) — which is exactly why a domain-expert
   employee (pigeon) is justified.
