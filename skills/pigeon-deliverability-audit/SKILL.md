---
name: pigeon-deliverability-audit
description: Audit whether a sending domain is ready to send and diagnose why mail lands in spam. Use when someone asks "is my domain ready to send", "why are my emails going to spam", "check my SPF/DKIM/DMARC", or reports a deliverability symptom. Runs `pigeon verify` (out-of-band dig + alignment) and maps the symptom to pigeon's 19 battle-tested scenarios.
encodes: brain/EXPERTISE-MAP.md (JTBD-1) · brain/OPINIONS.md O-09/O-10/O-11 · brain/BATTLE-TESTED-SCENARIOS.md (the SCN triage index)
---

# pigeon-deliverability-audit

The entry-fee skill: prove a domain is *actually* ready to send before go-live, and triage a live
"my email is in spam" incident the way a deliverability engineer would — by checking **alignment**,
not just presence, and never trusting a provider's cached "verified" flag.

## Trigger

Invoke when the user says any of:
- "is my domain ready to send" / "can I go live with email on `<domain>`"
- "why are my emails going to spam" / "deliverability dropped"
- "check my SPF / DKIM / DMARC" / "is my email auth set up right"
- pastes a deliverability symptom (bounces, quarantine, spam-foldering)

## Steps

1. **Read the stances first.** Load `brain/OPINIONS.md` O-09 (auth is necessary-NOT-sufficient),
   O-10 (DMARC *alignment*, not just SPF/DKIM pass, is what matters), O-11 (dig DNS yourself — never
   trust the provider's cached "verified" flag). These are the decision rules for everything below.
2. **Verify the domain out-of-band.** Run `pigeon verify <domain>` (or `pigeon verify --dns-fixture
   <path>` for a reproducible/offline check). This `dig`s SPF, DKIM, and DMARC AND checks alignment
   against the visible `From:` — it does NOT call the provider's status API (which can lie — `brain/KNOWN-PITFALLS.md`
   PIT-04, PIT-21).
3. **Read `ready:` honestly.** `ready: true` requires SPF + DKIM + DMARC present AND aligned. If
   `ready: false` with a `dmarc-unaligned` finding, that is the #1 misunderstood mechanic
   (`brain/BATTLE-TESTED-SCENARIOS.md` SCN-02): a third party authenticates under its OWN domain, so
   SPF/DKIM pass but DMARC fails alignment against your `From:`.
4. **If there is a symptom, triage it.** Map the symptom to a scenario with `pigeon ask "<symptom>"`,
   which matches against the 19 SCN scenarios and returns symptom → diagnosis → resolution → prevention
   with the `brain/` citation. Use the highest-signal discriminators first (SCN-02 alignment, SCN-05
   cold-on-transactional, SCN-13 GET-unsubscribe, SCN-17 corporate DKIM rewrite, SCN-18 verify
   poll-loop).
5. **Never overstate.** Auth passing ≠ inbox placement (O-09). Reputation + engagement decide the
   inbox; carry that uncertainty in the answer instead of claiming "deliverability solved."

## Output

A readiness verdict + a diagnosis, in this shape:
- **Readiness:** `ready: <bool>` with the per-mechanism status (SPF / DKIM / DMARC / aligned) and the
  exact records to add if any are missing.
- **Diagnosis (if a symptom was given):** the matched `SCN-NN`, its root cause, the resolution steps,
  and the prevention rule — each traceable to a `brain/` node.
- **The honest caveat:** if auth passes, state explicitly that auth is necessary but not sufficient
  (O-09) and name the next reputation/engagement lever, rather than declaring victory.

## Refs

- `brain/EXPERTISE-MAP.md` — JTBD-1 "Authenticate a domain"
- `brain/OPINIONS.md` — O-09, O-10, O-11
- `brain/BATTLE-TESTED-SCENARIOS.md` — SCN-02 (and the full triage index)
- `brain/KNOWN-PITFALLS.md` — PIT-04, PIT-08, PIT-21
