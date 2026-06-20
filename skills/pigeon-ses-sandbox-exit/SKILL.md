---
name: pigeon-ses-sandbox-exit
description: Author the AWS SES production-access (sandbox-exit) request narrative and gate its prerequisites. Use when someone says "SES denied my production access", "my SES sandbox-exit keeps getting rejected for security reasons", or "how do I get out of the SES sandbox". Emits a concrete narrative (built from the bounce-handling pigeon implements) and enforces auth-FIRST ordering.
encodes: brain/OPINIONS.md O-17/O-25 · brain/BATTLE-TESTED-SCENARIOS.md SCN-15 · brain/KNOWN-PITFALLS.md PIT-13
---

# pigeon-ses-sandbox-exit

The SES sandbox-exit denial is almost never a technical failure — it is a **quality-of-narrative**
failure, and an **ordering** failure. AWS inspects your website and wants crisp, specific answers to
four questions; vague word-salad (especially on bounce handling) gets auto-denied. And in 2024+ you
must authenticate the domain BEFORE you ask — not after.

## Trigger

Invoke when the user says any of:
- "SES denied my production access" / "sandbox-exit rejected"
- "AWS says 'your use of SES could have a negative impact' / 'security reasons'"
- "how do I get out of the SES sandbox"

## Steps

1. **Read the two distinct stances.** Load `brain/OPINIONS.md` O-25 (authenticate the domain BEFORE
   requesting production access — the 2024 ordering inversion; never ask first and authenticate later)
   and O-17 (the NARRATIVE is the product — author it; never submit vague free-text). These are
   different: O-25 is about *ordering*, O-17 is about *narrative quality*.
2. **Gate the prerequisites FIRST.** Before drafting anything, confirm with `pigeon verify <domain>`
   that SPF + DKIM + DMARC are in place and aligned (auth is the 2024 prerequisite), and confirm a
   professional landing page + privacy policy exist (AWS inspects the site). If auth is missing, STOP —
   fixing auth comes before the request (`brain/KNOWN-PITFALLS.md` PIT-13).
3. **Author the narrative.** Run `pigeon ses-narrative --domain <d>`. It authors the production-access
   request from the handling pigeon actually implements — answering the four T&S questions with
   specifics: business nature + SES use, how addresses are collected, the exact subscribe/unsubscribe
   flow, and a CONCRETE bounce/complaint handling description (consume webhook → suppress → never
   re-send → auto-pause). pigeon can write this credibly because it implements that handling
   (`brain/BATTLE-TESTED-SCENARIOS.md` SCN-15).
4. **Distinguish this from a post-exit suspension.** If the account is ALREADY out of the sandbox and
   got paused "under review" after a bad batch, that is SCN-19 (shared-pool suspension), not a
   sandbox-exit denial — different runbook (stop the offending stream, pull SNS bounce data, suppress,
   respond with a concrete remediation).

## Output

- **A prerequisite gate result:** auth present+aligned? site + privacy policy present? (with the exact
  gaps if not — and a STOP if auth is missing).
- **The production-access narrative:** specific answers to the four T&S questions, with the
  bounce/complaint handling described concretely (the part that gets vague requests denied).
- **The ordering rule restated:** authenticate first, then request — never the reverse.

## Refs

- `brain/OPINIONS.md` — O-17 (narrative is the product), O-25 (auth BEFORE the request)
- `brain/BATTLE-TESTED-SCENARIOS.md` — SCN-15 (sandbox-exit denied), SCN-19 (post-exit shared-pool pause)
- `brain/KNOWN-PITFALLS.md` — PIT-13 (vague narrative denial)
