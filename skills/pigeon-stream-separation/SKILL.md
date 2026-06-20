---
name: pigeon-stream-separation
description: Decide where to route transactional vs marketing vs cold mail, and HARD-REFUSE the account-death routing. Use when someone asks "where should I send password resets vs newsletters", "can I send cold outreach through Postmark/Resend", "which provider for which email", or is about to co-mingle streams. Emits the subdomain/provider split and the hard guardrail.
encodes: brain/OPINIONS.md O-01/O-02 · brain/BATTLE-TESTED-SCENARIOS.md SCN-04/SCN-05 · brain/KNOWN-PITFALLS.md PIT-01/PIT-02
---

# pigeon-stream-separation

pigeon's signature taste: transactional and marketing are **separate streams from day one**, and
routing a `cold`/`marketing` message through a transactional-only provider is **account-death** — a
HARD-REFUSE, not a tuning knob.

## Trigger

Invoke when the user says any of:
- "where should I send password resets vs newsletters"
- "can I send cold outreach / a B2B blast through Postmark (or Resend / Mailgun)"
- "which provider should I use for `<kind>` email"
- "my password resets went to spam after a marketing campaign"
- they are about to send marketing and transactional from the same key / subdomain

## Steps

1. **Read the stances.** Load `brain/OPINIONS.md` O-01 (ALWAYS separate transactional + marketing
   streams; contamination is asymmetric — the disposable stream poisons the critical one) and O-02
   (NEVER route cold/marketing through a transactional-only provider — this is a HARD-REFUSE).
2. **Tag the stream.** Classify the message as `transactional` | `marketing` | `cold`. Stream-tag is
   a core primitive — you cannot route correctly without it (O-01).
3. **Check the routing against the truth table.** Run `pigeon stream-check <tag> <provider>`. It
   returns ALLOW or HARD-REFUSE (exit non-zero on refuse). `cold`/`marketing` → Postmark /
   resend-transactional / ses-transactional is REFUSED because those providers suspend the WHOLE
   account — password-resets included — within days of detecting cold/bulk (`brain/BATTLE-TESTED-SCENARIOS.md`
   SCN-05, `brain/KNOWN-PITFALLS.md` PIT-02).
4. **Emit the split.** Recommend separate subdomains (`notifications.<domain>` for transactional,
   `news.<domain>` for marketing), ideally separate providers/pools. Cold/marketing goes through a
   permissive provider (SendGrid / SES) on a SEPARATE domain; transactional stays on the curated one.
5. **Honor the harness guardrail.** The `hooks/stream-refuse-guard.sh` PreToolUse hook + the
   in-process `checkStream` both block the account-death routing — do not work around them. If a send
   is being refused, the fix is to change the route, not to suppress the guard.

## Output

- **The stream tag** for the message (transactional / marketing / cold).
- **The routing verdict:** ALLOW or HARD-REFUSE, with the reason and the `brain/` citation.
- **The recommended topology:** which subdomain + which provider for each stream, and an explicit
  warning that co-mingling is asymmetric contamination (the password reset is always the victim).

## Refs

- `brain/OPINIONS.md` — O-01 (separate streams), O-02 (HARD-REFUSE cold-on-transactional)
- `brain/BATTLE-TESTED-SCENARIOS.md` — SCN-04 (stream contamination), SCN-05 (whole-account suspension)
- `brain/KNOWN-PITFALLS.md` — PIT-01 (mixing on one IP/subdomain), PIT-02 (cold through transactional-only)
