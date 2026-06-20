---
name: pigeon-warmup-control-loop
description: Author a warmup ramp for a new sending domain as a control loop, not a fixed schedule. Use when someone asks "what warmup schedule for a new domain", "how do I ramp sending volume", "we're migrating providers and need to warm up", or "we got blocklisted after blasting a fresh domain". Emits a deferral-watching ramp that HOLDS volume on 421/450 spikes — "slow is fast."
encodes: brain/OPINIONS.md O-08 · brain/BATTLE-TESTED-SCENARIOS.md SCN-11 · brain/KNOWN-PITFALLS.md PIT-09
---

# pigeon-warmup-control-loop

Warmup is a **control loop**, not a fixed doubling schedule. The failure mode is doubling on-schedule
WHILE a provider is already deferring you (421/450) — which outruns how fast providers update their
reputation models. "Slow is fast." This is why a domain-expert beats a static warmup template.

## Trigger

Invoke when the user says any of:
- "what warmup schedule for a new domain / IP"
- "how do I ramp sending volume safely"
- "we're migrating to a new provider/subdomain — how do we warm up"
- "we blasted a fresh domain and got blocklisted in a day"

## Steps

1. **Read the stance.** Load `brain/OPINIONS.md` O-08 (warmup is a CONTROL LOOP — watch the 421/450
   deferral rate PER-PROVIDER; if it spikes, HOLD volume, don't follow the doubling schedule). Also
   O-07 (domain reputation > IP reputation — protect the sending subdomain first).
2. **Author the ramp.** Run `pigeon warmup plan --domain <d> --target <vol>`. The plan starts small,
   increases gradually, prioritizes ENGAGED recipients early (to build positive signal), and — the
   load-bearing part — emits the HOLD signal: if Gmail/Outlook 421/450 deferrals spike, do NOT double;
   hold at the current volume until the deferral rate clears.
3. **Never blast on arrival.** Reputation does NOT transfer between providers/subdomains
   (`brain/KNOWN-PITFALLS.md` PIT-09); a fresh domain blasted with production volume (e.g. 50k day-one)
   is an instant blocklist (`brain/BATTLE-TESTED-SCENARIOS.md` SCN-11). Warm from ZERO.
4. **Supply auto-pause if the provider lacks it.** Resend has no warmup tooling and no
   auto-pause-on-bounce — pigeon supplies the control loop and the auto-pause guardrail (O-24, wired in
   `hooks/stream-refuse-guard.sh`). Pair the ramp with bounce/complaint suppression.
5. **Strip bots before trusting engagement.** When using engagement to prioritize/advance the ramp,
   filter scanner/MPP/link-rewriter traffic first — raw open/click is polluted (O-21).

## Output

A warmup ramp plan:
- a per-day/per-provider volume schedule starting from zero,
- the explicit **HOLD signal**: the 421/450 deferral threshold at which volume must NOT increase,
- the "prioritize engaged recipients first" guidance,
- a pointer to the auto-pause guardrail to pair with it,
- the prevention rule (never blast a cold domain; reputation doesn't transfer).

## Refs

- `brain/OPINIONS.md` — O-08 (control loop, "slow is fast"), O-07 (domain > IP), O-24 (auto-pause)
- `brain/BATTLE-TESTED-SCENARIOS.md` — SCN-11 (warm a brand-new domain), SCN-12 (recovery runbook)
- `brain/KNOWN-PITFALLS.md` — PIT-09 (reputation doesn't transfer)
