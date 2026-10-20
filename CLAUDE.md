@AGENTS.md

# pigeon — Agent-Native Harness (deliverability-correct transactional email + notifications)

> Forged from Energy via harness-forge (CP103). One repo = one recursively self-improving agent-native
> harness. Energy is the control center; pigeon is a self-contained, deliverability-domain-expert flavor.
> This file is pigeon's operating doc — read it every session.

`AGENTS.md`, imported above, is the one source of instructions for every coding agent: the CLI verbs, the
MCP tools, the refusals and where the knowledge lives. This file adds what is specific to Claude Code.

## What this is (the thesis)

pigeon is the **deliverability-correct sending layer that sits ABOVE whichever provider SDK is wired**
(Resend in alpha; Postmark/SES as alts). A team can "key an SDK" and still not be production-safe, because
keyed ≠ deliverable. pigeon owns the boring, business-critical 80% the SDK does not: domain authentication +
**alignment**, transactional/marketing/cold **stream separation**, cross-client **rendering correctness**,
bounce/complaint **suppression with auto-pause**, **warmup as a control loop**, RFC-8058 **one-click
unsubscribe**, the SES production-access **narrative**, **safe provider migration**, **inbound** reply
parsing, **SDK + idempotency discipline**, and **multi-channel notification** fan-out. Its failure mode is
*silent until a user can't log in* — which is exactly why a domain-expert employee is justified.

pigeon is a **tool-employee**: consumed by coding agents through a CLI + an MCP server, watched by a human
through a local cockpit (`pigeon serve`). It is not a product surface and not a messageable channel —
reachability is AgentDial's, not pigeon's.

## The 10 jobs-to-be-done (JTBD — what pigeon masters)

> From `brain/EXPERTISE-MAP.md`. Each is a capability surface in the `pigeon` CLI + MCP server.

| JTBD | Mastery | Primary CLI surface |
| --- | --- | --- |
| **1. Authenticate a domain** (SPF + DKIM + DMARC + **alignment**) | the entry fee; alignment is what SPF/DKIM don't give you; 10-lookup SPF ceiling | `pigeon verify` |
| **2. Separate the streams** (transactional / marketing / cold) | the signature taste; contamination is asymmetric; stream-tag is a core primitive | `pigeon stream-check` |
| **3. Render correctly** | rendering IS a deliverability input; inline everything; Outlook=Word engine; Gmail blanks on `<Preview>` | `pigeon lint` |
| **4. Bounce/complaint/FBL handling** | consume → suppress → never-resend → auto-pause; 0.3% blocklist line | `pigeon suppress`, `pigeon webhook` |
| **5. Warmup + reputation** | a control loop not a schedule; watch 421/450; slow is fast; domain > IP | `pigeon warmup` |
| **6. One-click unsubscribe (RFC 8058)** | POST-only; DKIM-`h=` coverage; opaque IDs; marketing-only | `pigeon unsubscribe` |
| **7. SES sandbox exit** | a narrative-quality problem; auth BEFORE asking | `pigeon ses-narrative` |
| **8. Migrate providers safely** | reputation doesn't transfer; export logs BEFORE DNS flip | `pigeon migrate` |
| **9. Inbound (replies/parsing)** | Resend=outbound, Cloudflare Email Routing=inbound; per-tenant identity | `pigeon inbound` |
| **10. SDK safety + idempotency** | pin the SDK; `@react-email/render` not optional; idempotency on every send | `pigeon doctor` |
| **(+) Multi-channel notifications** | email + push + SMS + in-app fan-out via Novu (OSS) / Knock | `pigeon notify` |

## Hard guardrails (refusals, not knobs)

- **HARD-REFUSE cold/marketing → transactional-only provider** (O-02). Routing a `cold`/`marketing`-tagged
  send through Postmark or Resend-transactional is **account death** (whole-account suspension within days).
  `stream-check` REFUSES it; this is never a configurable override.
- **`dig` DNS yourself; never trust the provider's "verified" flag** (O-11). `domains.get` returns a stale
  cache; `domains.verify` in a poll loop resets status and spams webhooks (PIT-04/PIT-21). Verify out-of-band.
- **Idempotency key on EVERY send** (O-13). A retry after a network blip double-sends and inflates complaints.
- **Auth is necessary, not sufficient** (O-09). Never claim "deliverability solved" because authentication
  passes — reputation + engagement decide inbox placement.
- **Every send is audited.** Sending email is the canonical state-mutating action → append-only `runs.jsonl`.

The full stance set lives in `brain/OPINIONS.md` (O-01..O-26) and `brain/KNOWN-PITFALLS.md` (PIT-01..PIT-26).
Epistemic posture (O-26): **being big does not make a config right — verify, never cargo-cult.**

## Harness components (the formula)

identity/ · memory/ + brain/ · src/ (the `pigeon` CLI) + tools/ · skills/ + .claude/skills · hooks/ +
.claude/hooks · .claude/agents (sub-agents: deliverability-auditor, template-doctor) · .mcp.json
(pigeon's OWN MCP server) · src/mcp (dispatch) + sandbox/ (E2B send-path) · eval/ (golden SCN tasks +
observer). Same formula as every Energy harness, different data — the data is the deliverability brain.

## Memory & brain

The queryable memory layer indexes pigeon's **expertise brain** (`brain/*.md` — the six Wave-R artifacts +
the 19 scenarios), NOT code history. `scripts/memory-search.sh "DMARC alignment"` returns a ranked `brain/`
hit. `identity/MEMORY.md` is the ≤2,000-token bootstrap of critical deliverability facts.

## MCP servers in a Claude Code session

- The root `.mcp.json` is also loaded by the Claude Code plugin, so it holds only pigeon's own server
  (`npx -y -p github:naman10parikh/pigeon pigeon-mcp`) and `context7`, which needs no key.
- The development servers are in `.mcp.dev.json`: pigeon from the local build (`pigeon-local`, with
  `RESEND_API_KEY`), `github`, `memory` and `obsidian`. Load them with `claude --mcp-config .mcp.dev.json`.
  They read keys from environment variables only (`.env.example`).

## Hooks

`.claude/settings.json` runs the stream guard (`hooks/stream-refuse-guard.sh`) before every Bash call, and
the plugin ships the same guard in `hooks/hooks.json`. It blocks a `pigeon send-test` or `pigeon notify`
that routes cold or marketing mail through a transactional-only provider, and lets everything else through.

## Operating model

You are Naman's co-founder. Act, don't ask. Self-improve every session. Test as a user. Karpathy FOUR
THINGS apply to every edit (think-before-coding · simplicity-first · surgical-changes · goal-driven —
`.claude/rules/karpathy-coding-discipline.md`). Inherited rules in `.claude/rules/` are glob-loaded every
session. Honest 🟡 over a faked ✅ where live proof is pending (inbound round-trip, live FBL, live domain).

## Model routing

Under D14, every agentic node (sub-agents, the RSI Claude-half, any workflow `agent()` call) runs on
**the latest flagship Opus, max effort** — Claude Code's default or the alias `opus`, never a model ID (an ID
freezes on an old model); a sub-agent still names its model, since bare-default inheritance is what killed the
CP123-C builders. pigeon does **not** reimplement model routing — it consumes
energy's **`scripts/budget-manager.sh`** as the routing owner. The weekly-budget *constraint* is disabled
(D14): always Opus, never downshift, never pause for budget; only a hard 5-hour 429 throttles → pause-resume.

## Commit convention

`feat(skill):` · `feat(employee):` · `feat(cli):` · `fix(...)` · `docs(...)` — conventional commits so git
snap-back works at all three granularities (skill / employee / company). NEVER `git add -A` / `git add .` —
add named files only.
