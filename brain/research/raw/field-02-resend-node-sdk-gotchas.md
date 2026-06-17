---
title: "FIELD — resend-node SDK version-specific gotchas (v6.x breakage, Cloudflare Workers, contacts API)"
type: source
created: 2026-06-16
tags: [field-intelligence, resend-node, sdk, cloudflare-workers, version-gotcha, 500-error]
researcher: FIELD-INTELLIGENCE (pigeon, CP123 Wave-R)
note: "Mined `gh issue list --repo resend/resend-node --state all` 2026-06-16. These are real engineer-reported breakages, not docs. Bar met: version-specific, reproducible failures."
---

# resend-node — real SDK gotchas (the "it broke after I upgraded" cluster)

> These are the failures pigeon's provider-abstraction layer must defend against. The pattern:
> **a minor-version bump (v6.9.0) shipped a `mailparser` dependency that broke serverless runtimes**
> (Cloudflare Workers, Convex) — a textbook example of why "keyed an SDK" ≠ "production-safe."

## A. The v6.9.0 `mailparser` dependency disaster (Jan-Feb 2026) — a multi-issue cascade

Source: `gh issue list --repo resend/resend-node` (fetched 2026-06-16). Cluster of issues all
caused by the SAME root: v6.9.0 added `mailparser` (for inbound/`receiving`), which pulls Node
built-ins that don't exist on edge runtimes.

| # | Date | Title (verbatim) | Root |
|---|------|------------------|------|
| 837 | 2026-02-09 | "v6.9.0+ 500 error" | Generic 500 after upgrade. |
| 826 | 2026-02-26 | "v6.9.0+ broken build on cloudflare workers with nuxt/nitro. Uncaught TypeError: `Zv.hasOwnProperty is not a function`" | mailparser on CF Workers. |
| 824 | 2026-01-30 | "resend@6.9.1 breaks Convex deployment due to mailparser dependency" | Same dep, Convex runtime. |
| 817 | 2026-02-11 | "Adding mailparser in v6.9.0 requires `nodejs_compat` on Cloudflare workers" | The actual fix: enable `nodejs_compat`. |
| 821 | 2026-01-28 | "Persistent 500 error when sending emails" | Likely same cluster. |
| 813 | 2026-01-27 | "Urgent: 6.9.0 `resend.emails.send(options)` expect `void 0` for `react:` instead of React.ReactNode" | Type break for the `react:` prop in 6.9.0. |

**Extracted rule for pigeon:** pin the email-SDK version and treat any minor bump as a deploy-risk
event — *especially on edge/serverless runtimes*. The `@react-email/render` peer dependency is an
optional/fragile import (see §B) and Resend's own SDK has repeatedly broken Cloudflare Workers /
Convex / Nuxt-Nitro on minor bumps. A provider-abstraction layer should isolate the SDK behind a
thin interface so an SDK regression is a one-file pin, not an app-wide outage.

## B. The `@react-email/render` optional-peer-dependency footgun (2025-2026, recurring)

This import is "optional" but bundlers keep resolving it and failing:

| # | Date | Title (verbatim) |
|---|------|------------------|
| 905 | 2026-04-27 | "Warning: The `@react-email/render` dependency could not be found" |
| 629 | 2025-11-24 | "Error: Failed to render React component. Make sure to install `@react-email/render`" |
| 625 | 2025-10-21 | "Turbopack resolves optional `@react-email/render` import in v6.1.0, causing 'Module not found'" |
| 616 | 2025-12-26 | "GETTING TypeError: this.renderAsync is not a function ... when using latest version" |
| 773 | 2025-12-29 | "Security: `@react-email/render` uses vulnerable glob@10.4.5" |
| 751 | 2025-11-19 | "Types missing in 6.5.0" |
| 969 | 2026-05-25 | "Package size much bigger" |

**Rule:** if you send React-rendered emails, `@react-email/render` is NOT actually optional — install
it explicitly. Turbopack/Webpack/Vite each resolve the "optional" import differently → "Module not
found" in some, fine in others. Pin and install it.

## C. API/SDK contract-drift gotchas (docs ≠ implementation)

Real, separate bugs where the SDK or docs lied:

- **#842 (2026-02-10) "topics.list() returns snake_case fields but Topic type expects camelCase"** —
  the SDK type and the wire format disagreed → silent `undefined` on every field.
- **#812 / #790 / #854 (2026)** — `contacts.get`, `contacts.create`, Create-Contact `segments`
  wording: docs don't match implementation.
- **#775 (2026-01-08) "client.domains.get returns an outdated cached response"** — a **stale cache on
  domain status** means you can't trust `domains.get` to tell you if DNS verified. Directly relevant
  to deliverability tooling: don't poll `domains.get` and trust it; it can lie.
- **#823 (2026-01-30) "`/verify` resetting dns and domain status + triggering webhooks unnecessarily"**
  — calling verify *reset* domain status and spammed webhooks. Verifying DNS is not idempotent here.
- **#662 (2025-10-15) "Old API key stopped working unexpectedly - required regenerating new key"** —
  an API key silently stopped working. Build key-rotation + auth-failure alerting; don't assume keys
  are forever.
- **#644 / #634 (2025) `contacts.remove()` `missing_api_key` despite valid key; cURL works** — SDK
  failed to pass the key where direct REST succeeded → when the SDK misbehaves, fall back to raw REST.
- **#764 (2025-12-09) "Sending emails with attachment don't work with option."** — attachment path
  broke.

## D. 2026 product-surface signals (new features = new gotchas)

- **#967 (2026-06-10, OPEN) "Add idempotencyKey support to emails.receiving.forward()"** — idempotency
  is being added to *inbound forwarding*; transactional sends need idempotency keys too (avoid
  double-sends on retry). pigeon should default to idempotency keys on every send.
- **#901 (2026-03-30) "Feature: bot click detection for email.clicked webhook events"** &
  **#973 (2026-05-27) "ship an optional Ageniti action wrapper for the SDK"** — Resend is adding
  bot-click filtering and an agent action wrapper. Signal: **open/click tracking is increasingly
  polluted by security-scanner bots** (Apple MPP, corporate link-rewriters) — don't trust raw
  open/click as engagement for reputation decisions.

## E. Lessons pigeon inherits
1. **Pin the SDK; isolate it behind one interface.** Minor bumps break edge runtimes (v6.9.0).
2. **`domains.get` can return stale/cached DNS status (#775)** — verify authentication out-of-band
   (dig the DNS yourself), don't trust the provider's cached "verified" flag.
3. **Default to idempotency keys on every send** (#967 trend) to survive retries without double-send.
4. **Bot opens/clicks pollute engagement (#901)** — strip scanner traffic before using engagement
   signals for reputation/warmup decisions.
5. **When the SDK misbehaves, raw REST is the escape hatch (#644)** — keep a direct-HTTP fallback.
