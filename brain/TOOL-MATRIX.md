---
title: "TOOL-MATRIX — canonical tools, defaults vs alts, access surface, required secrets"
type: synthesis
created: 2026-06-16
updated: 2026-06-16
tags: [tools, providers, secrets, env-vars, access-surface, deliverability, pigeon]
sources:
  - "research/raw/field-00-internal-corpus.md"
  - "research/raw/field-01-github-react-email-rendering-gotchas.md"
  - "research/raw/field-02-resend-node-sdk-gotchas.md"
  - "research/raw/field-03-hn-deliverability-folklore-disputes.md"
  - "research/raw/field-04-ses-sandbox-stream-separation-2026-rules.md"
  - "research/raw/field-05-migration-war-stories-and-reddit-spam-postmortems.md"
  - "research/raw/field-06-list-unsubscribe-rfc8058-and-cloudflare-inbound-resolved.md"
summary: "The canonical tool set for a deliverability-correct sending layer: provider defaults vs alternatives, when to use which, agent-access surface (CLI/API/MCP), and the secret each needs — feeds the Wave-P Required-Secrets manifest."
related:
  - "[[EXPERTISE-MAP]]"
  - "[[OPINIONS]]"
  - "[[KNOWN-PITFALLS]]"
---

# TOOL-MATRIX

> The job is provider-AGNOSTIC by design (O-18, O-12): pigeon owns a thin abstraction so swapping
> providers is one adapter file. This matrix names the canonical default per job, the alternatives,
> when to pick which, the access surface a Claude agent has, and the **exact secret name** (energy
> convention — see `.env.example`) each needs. The "Required Secrets" roll-up at the bottom is the
> input to the Wave-P manifest.

---

## 1. SENDING PROVIDERS (outbound transactional)

| Provider | Role | Default? | When to use | Access surface | Key secret(s) |
|---|---|---|---|---|---|
| **Resend** | Outbound transactional API | **DEFAULT** (energy canonical) | Modern stack, best DX, React-email native; the fleet already keys it (in alpha) | `resend` npm SDK (PIN it, O-12) + raw REST escape hatch (O-14); no first-party MCP | `RESEND_API_KEY` |
| **Postmark** | Outbound transactional, deliverability-focused | Alt | When "must hit inbox in seconds" (auth/payments/alerts) justifies higher per-email cost; enforces stream separation natively | REST API / SDK | `POSTMARK_SERVER_TOKEN` |
| **AWS SES** | Outbound, lowest cost | Alt | Low volume where price dominates (free vs ~$20 SendGrid); willing to own reputation + sandbox exit | `aws-sdk`/`@aws-sdk/client-sesv2`, AWS CLI, SNS for events | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` |
| **SendGrid** | Outbound (legacy in fleet) | Alt / legacy | Already wired in AgentDial; common migration SOURCE (→SES for cost) | SDK / REST | `SENDGRID_API_KEY` |
| **AgentMail** | Per-agent inbox + outbound replies | Alt (agent-inbox path) | Agent reply/inbox use; wired in AgentDial. NOTE the per-user-key lesson (PIT-25) | SDK / REST, per-USER keys (never shared) | `AGENTMAIL_API_KEY` (per-tenant) |
| **Cloudflare outbound send** | Outbound | **AVOID for now** (O-23) | Not yet — private beta as of 2025-09, no native SPF-flattening | API | (n/a until GA) |

**Decision rule (O-18):** Postmark = deliverability-critical · Resend = DX/default · SES = cheapest at
low volume. Pick behind the abstraction so it's a config change. Source: `field-05` §A-B, `field-04` §B,
`field-00` §3.

**Hard guardrail (O-02 / PIT-02):** NEVER route a message tagged `cold`/`marketing` through Postmark or
Resend-transactional — whole-account suspension risk. Source: `field-05` §D.

## 2. INBOUND (replies, parsing)

| Tool | Role | Default? | When to use | Access surface | Key secret(s) |
|---|---|---|---|---|---|
| **Cloudflare Email Routing** | Inbound forwarding → webhook → gateway | **DEFAULT** (energy-designed) | Free inbound forwarding for custom domains → AgentDial gateway | Cloudflare API + Workers; webhook receiver | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| **Resend inbound (`emails.receiving`)** | Inbound via Resend | Alt | If consolidating inbound+outbound on Resend; idempotency being added (#967) | `resend` SDK (`mailparser` dep — PIT-03 on edge) | `RESEND_API_KEY` |

**Caveat (G-09):** inbound corpus is THIN — design confirmed, no executed CF Routing POC postmortem.
Per-tenant identity for inbound (PIT-25). Source: `field-06` §B, `field-00` §1.

## 3. RENDERING

| Tool | Role | Default? | When to use | Access surface | Notes |
|---|---|---|---|---|---|
| **react-email (`@react-email/components`)** | Email template authoring | **DEFAULT** | React/TS stacks | npm; PIN the version (O-12) | Re-test Outlook on every bump (PIT-18) |
| **`@react-email/render`** | Render React → HTML | **DEFAULT (install explicitly)** | Any react-email send path | npm — NOT actually optional (PIT-14) | Pin + install directly |
| **`@react-email/tailwind`** | Tailwind→inline at build | Optional | Convenience only | npm | Leaky abstraction — verify output (PIT-19); inline-everything still rules (O-04) |
| **MJML / hand-rolled tables + VML** | Bulletproof cross-client HTML | Alt | When you need guaranteed Outlook buttons/backgrounds | build-time | VML roundrect for Outlook buttons (SCN-09) |

Source: `field-01` §A-C, `field-02` §B.

## 4. AUTHENTICATION / DNS VERIFICATION (the entry fee, JTBD-1)

| Tool | Role | Access surface | Notes |
|---|---|---|---|
| **`dig` / DNS resolver** | Verify SPF/DKIM/DMARC out-of-band | Bash (`dig TXT`, `dig CNAME`) | DEFAULT verification — never trust provider's cached "verified" (O-11, PIT-04) |
| **DMARC aggregate report parsing** | Enumerate senders before `p=reject` | ingest RUA XML | High-value during `p=none→reject` transition (G-03, SCN-02) |
| **MACRO-aware SPF checker** | Validate SPF incl. 10-lookup + macros | API/lib | Most online tools misreport (don't eval macros) — PIT-07 |
| **DNS registrar API (Cloudflare/Route53/etc.)** | Write SPF/DKIM/DMARC + DKIM CNAME | provider API | `CLOUDFLARE_API_TOKEN` (if CF DNS) |

Source: `field-02` §C #775, `field-03` THREAD-2/THREAD-3.

## 5. FEEDBACK LOOPS / REPUTATION MONITORING (the control-loop inputs, JTBD-4/5)

| Tool | Role | Default? | Access surface | Key secret(s) |
|---|---|---|---|---|
| **Google Postmaster Tools** | Gmail reputation + complaint rate | **DEFAULT (wire all 3)** | API / dashboard | Google service-account creds |
| **Microsoft SNDS** | Outlook/Hotmail sender data | **DEFAULT** | dashboard / data feed | SNDS access key |
| **Yahoo CFL (Complaint Feedback Loop)** | Yahoo complaints | **DEFAULT** | feedback-loop registration | DKIM-d= registration |
| **Bounce/complaint webhook receiver** | Suppress hard bounces, auto-pause | **DEFAULT (mandatory, O-24)** | webhook endpoint (own) | webhook signing secret per provider |
| **421/450 deferral-rate monitor** | Warmup throttle signal | **DEFAULT** | parse SMTP responses / provider events | (n/a — derived) |

Source: `field-05` §E.7, `field-06` §C, `field-04` §C3.

## 6. PROVIDER-AGNOSTIC ABSTRACTION (pigeon's own layer)

| Concern | What pigeon owns | Why |
|---|---|---|
| Send interface | One thin `send(message, stream, idempotencyKey)` over the chosen adapter | Migration = one adapter file (O-12, SCN-08) |
| Stream tagging | Every message carries `transactional` / `marketing` / `cold` | Routing, unsubscribe headers, warmup all depend on it (O-01, O-06) |
| Idempotency | Default key on every send | Avoid double-send on retry (O-13, PIT-15) |
| Suppression list | Cross-provider hard-bounce/complaint suppression | Survives provider migration (PIT-05) |
| Warmup controller | Per-provider deferral-watching ramp | Resend has none (PIT-09, O-08) |
| Raw-REST fallback | Direct HTTP when SDK misbehaves | #644 SDK lies (O-14) |
| Per-tenant identity | Isolated keys/subdomains per tenant | AgentMail scar (PIT-25, O-15) |

## 7. UNSUBSCRIBE INFRA (RFC 8058, JTBD-6)

| Tool | Role | Access surface | Notes |
|---|---|---|---|
| **POST-only unsubscribe endpoint** | Honor one-click | own HTTP route | GET = info page only (O-05, PIT-06) |
| **Sqids / signed-token encoder** | Opaque unsubscribe IDs | lib | Prevent enumeration (PIT-06) |
| **DKIM `h=` config** | Cover List-Unsubscribe headers | signer config | MUST per RFC (G-07) |

Source: `field-06` §A.

---

## REQUIRED SECRETS — roll-up for the Wave-P manifest

> Convention follows energy `.env.example` (UPPER_SNAKE, gitignored, never committed). Mark each
> per-tenant where isolation is required (O-15). Only the DEFAULT-path secrets are "required to ship";
> the rest are "required if that provider is selected."

### Required (default path: Resend outbound + Cloudflare inbound)
| Secret | For | Notes |
|---|---|---|
| `RESEND_API_KEY` | Resend outbound (+ inbound if used) | per-tenant; rotate (PIT-22); pin SDK |
| `CLOUDFLARE_API_TOKEN` | CF Email Routing inbound + DNS | scoped token, not global key |
| `CLOUDFLARE_ACCOUNT_ID` | CF account scoping | |
| `<PROVIDER>_WEBHOOK_SIGNING_SECRET` | Verify bounce/complaint webhooks | per provider; validate signatures |
| `UNSUBSCRIBE_TOKEN_SECRET` | Sign/encode opaque unsubscribe IDs | (Sqids salt or HMAC key) |

### Required-if-selected (alternative providers)
| Secret | For |
|---|---|
| `POSTMARK_SERVER_TOKEN` | Postmark (deliverability-critical path) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | SES outbound + SNS events |
| `SENDGRID_API_KEY` | SendGrid (legacy / migration source) |
| `AGENTMAIL_API_KEY` | AgentMail agent-inbox path (per-tenant) |

### Required for reputation monitoring (wire all three FBLs, O-24)
| Secret / credential | For |
|---|---|
| Google service-account JSON (`GOOGLE_POSTMASTER_CREDENTIALS`) | Google Postmaster Tools API |
| `MICROSOFT_SNDS_KEY` | Microsoft SNDS data feed |
| Yahoo CFL DKIM-`d=` registration | Yahoo Complaint Feedback Loop (registration, not a key) |

### Config (non-secret) the manifest should also capture
| Var | For |
|---|---|
| `EMAIL_PROVIDER` | which adapter is active (resend\|postmark\|ses\|sendgrid) |
| `TRANSACTIONAL_SENDING_DOMAIN` | e.g. `notifications.app.com` (separate from marketing, O-01) |
| `MARKETING_SENDING_DOMAIN` | e.g. `news.app.com` |
| `EMAIL_DKIM_SELECTOR` | DKIM selector for the sending subdomain |

---

## Agent-access summary (how a Claude agent actually operates these)

- **Bash:** `dig` for DNS auth verification (O-11); `aws ses`/`aws sesv2` CLI for SES; `curl` as the
  raw-REST escape hatch for any provider (O-14).
- **npm SDKs:** `resend` (pinned), `@react-email/components` + `@react-email/render` (pinned, explicit).
- **HTTP/webhooks:** own endpoints for bounce/complaint ingestion + POST-only unsubscribe.
- **No first-party email MCP exists** in the corpus — providers are API/SDK/CLI. The fleet's Identity
  channel (AgentDial gateway) is the abstraction point for reachability (`field-00` §3-4).
- **Always pin, always isolate per-tenant, always keep a REST fallback.** Source: `field-02` §A/§C/§E,
  `field-00` §1.
