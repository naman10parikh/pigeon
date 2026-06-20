# pigeon — MEMORY (bootstrap)

> Loaded every session. Critical **deliverability** facts ONLY — the load-bearing truths, the numbers, and the
> one HARD-REFUSE. For depth, query the brain: `scripts/memory-search.sh "<topic>"` searches `brain/*.md`
> (the 19 scenarios, OPINIONS O-01..O-26, KNOWN-PITFALLS PIT-01..PIT-26, EXPERTISE-MAP, GAPS, TOOL-MATRIX).

## The 3 load-bearing truths (everything hangs on these)

1. **Authentication is necessary but NOT sufficient.** Passing SPF/DKIM/DMARC is the *entry fee*, not the
   game — reputation + engagement decide inbox placement. Average engineers stop at "auth passes"; pigeon
   treats auth as table stakes. (O-09, EXPERTISE-MAP truth 1.)
2. **Streams must be separated; contamination is asymmetric and brutal.** Marketing's spam complaints poison
   a *shared* reputation, and the victim is always the password reset — the most business-critical mail.
   Transactional / marketing / cold get separate subdomains (ideally separate providers) from day one.
   (O-01, EXPERTISE-MAP truth 2.)
3. **Every control is a loop, not a config.** Warmup, reputation recovery, and bounce-handling are feedback
   problems — watch a signal, hold/back-off when it spikes. This is why a domain-expert employee beats a
   static template. (O-08, EXPERTISE-MAP truth 3.)

## The numbers (memorize — they are thresholds, not trivia)

- **0.3%** — three complaints per thousand is the Gmail/Yahoo blocklist line. Auto-pause sending *before* it
  (bounce > ~5% or complaint > 0.1–0.3%). (O-24, PIT-05.)
- **10** — the hard SPF DNS-lookup ceiling (RFC 7208 §4.6.4). One `include:` over it returns `permerror` for
  ALL mail. Budget the 10 like a hard resource; flatten nested includes. (PIT-07, SCN-03.)
- **421 / 450** — the soft-deferral codes. When they spike during warmup, **HOLD** volume — do NOT keep
  doubling on schedule. "Slow is fast." (O-08, SCN-11.)
- **48 hours** — the window inside which a one-click unsubscribe must be honored (the 2024 Gmail/Yahoo rule).

## The HARD-REFUSE (the one absolute guardrail)

**NEVER route a `cold`/`marketing`-tagged message through a transactional-only provider** (Postmark /
Resend-transactional). It is **account death**, not a deliverability risk: the provider suspends the WHOLE
account — transactional included — within days, killing the password-reset pipeline. `stream-check` REFUSES
this; it is never a configurable override. (O-02, PIT-02, SCN-05.)

## The reflexes (apply without re-deriving)

- **`dig` DNS yourself.** Never trust the provider's "verified" flag — `domains.get` returns a stale cache
  and `domains.verify` in a loop resets status + spams webhooks. (O-11, PIT-04, PIT-21, SCN-18.)
- **Idempotency key on EVERY send.** A retry after a network blip double-sends and inflates complaints.
  (O-13, PIT-15.)
- **DMARC alignment, not just SPF/DKIM pass.** SPF + DKIM can pass while DMARC fails on alignment with the
  visible `From:` — the #1 "I set up auth but DMARC still fails." (O-10, SCN-02.)
- **Inline every style in email HTML.** Gmail strips `<style>` media queries; Tailwind breakpoints silently
  no-op; Outlook is the Word engine (VML buttons + MSO conditionals). Rendering IS a deliverability input.
  (O-03/O-04, PIT-16..PIT-20.)
- **`@react-email/render` is a non-optional, explicit, pinned install.** "Module not found" / "renderAsync is
  not a function" at runtime otherwise. Pin the `resend` SDK too (v6.9.0 broke edge runtimes on a minor bump).
  (PIT-14, PIT-03, O-12.)
- **Sending email is the canonical state-mutating action** → append every send to the append-only
  `logs/runs.jsonl` audit trail.

## Epistemic posture

**Being big does not make a config right — verify, never cargo-cult.** (O-26.) Be honest where the corpus is
thin: inbound is the #1 corpus-gap (G-09); the "98.7% deliverability" figure is vendor-adjacent. Grade an
honest 🟡 (live proof pending) over a faked ✅.

## Where depth lives

`brain/EXPERTISE-MAP.md` · `brain/BATTLE-TESTED-SCENARIOS.md` · `brain/OPINIONS.md` ·
`brain/KNOWN-PITFALLS.md` · `brain/GAPS-AND-DISPUTES.md` · `brain/TOOL-MATRIX.md`. Persona: `identity/SOUL.md`.
