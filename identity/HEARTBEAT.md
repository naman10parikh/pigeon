# pigeon — Heartbeat

> The deliverability employee's recurring checks. The scheduled half is wired in
> `.github/workflows/health-check.yml` (D18) + the RSI deterministic loop (`rsi.yml`, §11). Every check
> appends to the append-only `logs/runs.jsonl` audit trail. Powered by Energy.

## Schedule

| Check | Frequency | Action on anomaly |
| --- | --- | --- |
| **Auth + alignment re-`dig`** (`pigeon verify $PIGEON_TEST_DOMAIN`) | Daily (health-check.yml `schedule:`) | If SPF/DKIM/DMARC drifts or alignment breaks: flag in runs.jsonl, surface in cockpit |
| **Suppression-list / complaint-rate drift** | Daily | If complaint > 0.3% or bounce > ~5%: the auto-pause guardrail fires (O-24) — HOLD sending |
| **SDK pin drift** (`pigeon doctor`) | Daily | If `resend` / `@react-email/render` / `@react-email/components` drift from pinned: flag (O-12) |
| **Golden-task regression** (re-run GT-01..13 vs fixtures) | Nightly (rsi.yml, tokenless $0) | If any golden task regresses: FAIL the RSI loop (this is L1→L2) |
| **Warmup deferral watch** (when a domain is warming) | Per-send window | If 421/450 deferrals spike: HOLD volume, do not double on schedule (O-08) |

## Health indicators

- **Healthy:** last `verify` ≤ 24h ago + aligned; complaint rate < 0.1%; no golden-task regression.
- **Warning:** complaint rate 0.1–0.3% OR a non-blocking golden task drifted OR an SDK minor bumped.
- **Critical:** complaint rate ≥ 0.3% (the blocklist line) OR auth/alignment broke OR a CI-blocking golden
  task regressed → **auto-pause** sending (O-24) and surface a blocker.

## Recovery

1. Read the last failing run from `logs/runs.jsonl`.
2. `pigeon ask "<symptom>"` — match against the 19 battle-tested scenarios for the diagnosis + prevention.
3. If fixable (re-align DNS, re-pin SDK, flatten SPF): apply, re-`verify`, resume.
4. If reputation-class (complaint spike): keep sending paused; warm-recover via the control loop — it's a
   ~30-day grind if you miss the cliff, so the auto-pause exists to never miss it.
5. If a new gotcha surfaced (a provider/sender-rule change): the RSI Claude-half proposes a
   `brain/KNOWN-PITFALLS.md` + golden-task diff (gated behind `CLAUDE_CODE_OAUTH_TOKEN`, D8).
