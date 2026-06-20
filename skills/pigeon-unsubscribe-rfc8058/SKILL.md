---
name: pigeon-unsubscribe-rfc8058
description: Generate an RFC-8058 one-click unsubscribe configuration that won't get mass-unsubscribed by scanners. Use when someone asks to "add one-click unsubscribe", reports "Gmail says my mail is non-compliant", or sees "mass unsubscribes nobody clicked". Emits a POST-only, opaque-ID, DKIM-h=-covered config — and ONLY for the marketing stream.
encodes: brain/OPINIONS.md O-05/O-06 · brain/BATTLE-TESTED-SCENARIOS.md SCN-13 · brain/KNOWN-PITFALLS.md PIT-06
---

# pigeon-unsubscribe-rfc8058

The counterintuitive rule: the one-click unsubscribe endpoint is **POST-only** (GET never
unsubscribes), IDs are **opaque**, DKIM `h=` covers the List-Unsubscribe headers — and one-click is
for **marketing mail ONLY**, never transactional. This is exactly what RFC 8058 exists to enforce.

## Trigger

Invoke when the user says any of:
- "add one-click unsubscribe" / "List-Unsubscribe header" / "RFC 8058"
- "Gmail/Yahoo says my bulk mail is non-compliant" (the 2024 sender rules)
- "we got a wave of mass-unsubscribes and users say they never clicked"

## Steps

1. **Read the stances.** Load `brain/OPINIONS.md` O-05 (the endpoint is ALWAYS POST-only; GET shows at
   most an info page; IDs opaque) and O-06 (one-click is for MARKETING mail ONLY — never add it to
   transactional). Stream determines the header policy.
2. **Confirm the stream is marketing.** Run `pigeon unsubscribe gen --stream marketing`. If the stream
   is `transactional`, the verb REFUSES (exit non-zero) — a List-Unsubscribe on a password reset is
   wrong (O-06), and omitting it from a newsletter is a 2024 violation; you cannot apply it correctly
   without knowing the stream.
3. **Emit the POST-only config.** The generated config gives: the `List-Unsubscribe` +
   `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers, an endpoint contract that mutates only
   on POST (GET → info page), opaque Sqids/HMAC IDs (so enumeration can't unsubscribe arbitrary users
   — needs `UNSUBSCRIBE_TOKEN_SECRET`), and the `h=` tag list DKIM must cover.
4. **Explain the footgun it prevents.** Security scanners, Outlook Safe Links, and Gmail
   image-prefetchers PRELOAD GET URLs and silently mass-unsubscribe (`brain/BATTLE-TESTED-SCENARIOS.md`
   SCN-13, `brain/KNOWN-PITFALLS.md` PIT-06) — POST-only is the defense.
5. **Currency check.** This scopes to the Feb-2024 Gmail/Yahoo rule and the Nov-2025 hard-rejection
   escalation; build for the future `p=reject`/enforcement world, not the bare minimum (O-20 family).

## Output

An RFC-8058 unsubscribe config for the marketing stream:
- the two `List-Unsubscribe*` headers (mailto + https POST endpoint),
- the endpoint contract (POST mutates, GET = info page),
- the opaque-ID scheme (Sqids/HMAC) and where the secret comes from,
- the DKIM `h=` coverage list,
- a refusal (with reason) if the caller asked for `--stream transactional`.

## Refs

- `brain/OPINIONS.md` — O-05 (POST-only, opaque IDs), O-06 (marketing-only)
- `brain/BATTLE-TESTED-SCENARIOS.md` — SCN-13 (scanner mass-unsubscribe)
- `brain/KNOWN-PITFALLS.md` — PIT-06 (GET unsubscribe footgun)
