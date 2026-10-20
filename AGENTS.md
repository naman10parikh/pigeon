# AGENTS.md — pigeon, for a coding agent

> You (a coding agent — Claude Code, the Energy hub, or a sibling employee) are reading this to learn how to
> *use* pigeon. pigeon is the **deliverability-correct transactional-email + notifications layer** that sits
> ABOVE whichever email provider SDK is wired. Powered by Energy.

## What I am, in one breath

I'm **pigeon**. Call `pigeon verify <domain>` before any go-live; `pigeon send-test` to prove delivery in
provider test mode; `pigeon lint <template>` before you ship HTML; `pigeon stream-check <tag> <provider>`
before you route. **I refuse account-death routing** (cold/marketing through a transactional-only provider)
and **I `dig` DNS myself** — I don't trust a provider's "verified" flag. My MCP tools mirror every CLI verb
1:1. **Read `brain/OPINIONS.md` for my stances** (O-01..O-26) and `brain/KNOWN-PITFALLS.md` for the
version-specific gotchas (PIT-01..PIT-26).

## CLI verbs (the command tree — every verb mirrored by an MCP tool)

```
pigeon verify <domain>                 # dig SPF/DKIM/DMARC + ALIGNMENT out-of-band; never trust the provider flag (O-11, JTBD-1)
pigeon send-test [--provider resend]   # send a React-Email template in provider TEST MODE w/ idempotency key (THE bar)
        [--template <name>] [--to <addr>] [--test-mode]
pigeon lint <template-path|->          # static-analyze email HTML for Gmail/Outlook/Preview/Tailwind hazards (JTBD-3)
pigeon stream-check <tag> <provider>   # transactional|marketing|cold × provider → ALLOW or HARD-REFUSE (O-02 guardrail)
pigeon unsubscribe gen [--stream marketing]  # emit RFC-8058 one-click config: POST-only, opaque IDs, DKIM h= list (JTBD-6)
pigeon warmup plan [--domain <d>] [--target <vol>]  # author a control-loop ramp (watch 421/450, hold on deferral) (JTBD-5)
pigeon suppress add|check <addr>       # cross-provider hard-bounce/complaint suppression list (JTBD-4, PIT-05)
pigeon webhook verify <provider> <payload>  # validate a bounce/complaint webhook signature → suppress (JTBD-4)
pigeon ses-narrative [--domain <d>]    # author the SES production-access narrative from implemented handling (JTBD-7)
pigeon migrate plan <from> <to>        # the safe-migration runbook: export-logs-first, re-verify, warm-from-zero (JTBD-8)
pigeon notify <channels> [--provider novu] [--dry-run]  # multi-channel fan-out email+push+SMS+in-app; Novu sending not built yet, so it exits 1 unless --dry-run
pigeon inbound setup [--provider cloudflare]  # Cloudflare Email Routing → webhook → gateway (JTBD-9)
pigeon doctor                          # SDK/runtime health: pinned versions, @react-email/render present, key valid (JTBD-10)
pigeon ask "<symptom>"                 # diagnose against the 19 battle-tested scenarios (the ask-the-employee path)
pigeon serve                           # launch the local cockpit (stdlib server + SPA), localhost:7791
```

Run the CLI straight from GitHub with `npx -y -p github:naman10parikh/pigeon pigeon --help`, or from a clone
with `pnpm install && pnpm build && node dist/cli.js --help`.

Every verb logs to `logs/runs.jsonl`, exits 0 (ok) / non-zero (fail), and has a `--help`. Deterministic verbs
(`verify`, `lint`, `stream-check`) need no network beyond DNS / static analysis and are `--offline`-safe where
possible (`verify --dns-fixture <path>` for reproducible CI).

## MCP tools (the same surface, over JSON-RPC stdio)

`pigeon.verify` · `pigeon.send_test` · `pigeon.lint` · `pigeon.stream_check` · `pigeon.unsubscribe_gen` ·
`pigeon.warmup_plan` · `pigeon.suppress` · `pigeon.webhook_verify` · `pigeon.ses_narrative` ·
`pigeon.migrate_plan` · `pigeon.notify` · `pigeon.ask` — mirror the CLI 1:1. Dual-mode: stdio-local now;
hosted-OAuth deferred. `tools/list` is the contract surface.

Start the server with `npx -y -p github:naman10parikh/pigeon pigeon-mcp` (the root `.mcp.json` does this), or
`node dist/mcp/server.js` from a built clone; it reads `RESEND_API_KEY` from the environment when you send for
real. The development servers (pigeon from the local build, `github`, `memory`, `obsidian`) are in
`.mcp.dev.json`; load them with `claude --mcp-config .mcp.dev.json`.

## My behaviors you must respect (refusals, not warnings)

- **I HARD-REFUSE** routing a `cold`/`marketing`-tagged message through a transactional-only provider
  (Postmark / Resend-transactional) — it suspends the *whole* account, including transactional. Tag your
  stream and call `stream-check` first.
- **I never poll a mutating endpoint** (`domains.verify`) to read status — I `dig`. Ask me to `verify`, not to
  re-verify in a loop.
- **I never promise inbox placement from auth alone** — `verify` passing means the *entry fee* is paid, not
  that you'll land in the inbox.
- **I am not your inbound reachability gateway** — that's AgentDial. I do *product* outbound email +
  notifications (and inbound *reply parsing* via Cloudflare Email Routing as JTBD-9).

## Sub-agents you can invoke

- **`deliverability-auditor`** (`.claude/agents/deliverability-auditor.md`) — audits a domain/config against
  the 19 scenarios + 26 pitfalls. The reusable, packaged one (callable via `Agent` from energy main).
- **`template-doctor`** (`.claude/agents/template-doctor.md`) — audits email HTML for cross-client hazards.

## Where my knowledge lives

`brain/EXPERTISE-MAP.md` (the 10 JTBD) · `brain/BATTLE-TESTED-SCENARIOS.md` (the 19 SCN golden tasks) ·
`brain/OPINIONS.md` (O-01..O-26 stances) · `brain/KNOWN-PITFALLS.md` (PIT-01..PIT-26) ·
`brain/GAPS-AND-DISPUTES.md` (where I'm honest about thin corpus) · `brain/TOOL-MATRIX.md` (defaults vs alts).
The agent-readable map is `llms.txt`; my persona is `identity/SOUL.md`.
