---
name: pigeon-email-render-lint
description: Static-analyze an email HTML / React-Email template for cross-client rendering hazards before shipping. Use when touching email templates, when an email renders blank in Gmail, when a button breaks in Outlook, or before sending any HTML email. Flags the detectable hazards (uninlined styles, media queries, <Preview> blank-risk, Tailwind safelist leak, missing MSO button conditional) — because rendering correctness IS a deliverability input.
encodes: brain/OPINIONS.md O-03/O-04 · brain/KNOWN-PITFALLS.md PIT-16..PIT-20 · brain/BATTLE-TESTED-SCENARIOS.md SCN-09/SCN-10
---

# pigeon-email-render-lint

Rendering correctness is a **deliverability input**, not a cosmetic concern: humans delete/mark-spam
a broken email, which trains the mailbox provider's reputation model against you. A template that
renders blank in Gmail or breaks in Outlook is a P0 deliverability defect.

## Trigger

Invoke when the user:
- is editing / about to ship an email HTML or React-Email (`.tsx`) template
- reports "my email is blank in Gmail" / "the button disappears in Outlook" / "styling is gone"
- asks "is this email template safe to send"

## Steps

1. **Read the stances.** Load `brain/OPINIONS.md` O-03 (treat a broken template as a deliverability
   bug, not cosmetic) and O-04 (in email HTML, ALWAYS inline every style — NEVER trust `<style>`
   blocks, media queries, or Tailwind breakpoints).
2. **Run the linter.** Run `pigeon lint <template-path>` (or pipe HTML: `cat email.html | pigeon lint -`).
   It statically flags the *detectable* subset of hazards:
   - **Uninlined styles / `<style>` media queries** — Gmail strips them (`brain/KNOWN-PITFALLS.md`
     PIT-16; `brain/BATTLE-TESTED-SCENARIOS.md` SCN-10).
   - **`<Preview>` blank-body risk** — certain values blank the entire email in Gmail (PIT-17, SCN-10).
   - **Tailwind `safelist` leak** — raw `@tailwind` directives leaking into the HTML (PIT-19).
   - **Missing MSO conditional around a button** — Outlook (Word engine) drops the button + everything
     below it (PIT-18, SCN-09); the fix is a VML bulletproof button.
3. **Distinguish hard flags from advisory.** Treat missing-inline / Preview-blank / safelist-leak as
   blocking hazards. The un-automatable ones (Gmail iOS dark-mode force-inversion PIT-20; exact VML
   correctness) are advisory warnings — never claim 100% client coverage (it's not a rendering engine).
4. **Re-test on every component bump.** `@react-email/components` has silently regressed Outlook
   buttons (>v0.29, #1813) and padding (#1512) — pin the lib and re-lint after any bump (O-12 family).

## Output

A hazard report: a list of `{ rule, severity, client, fix }` rows — e.g. `preview-blank-risk` (high,
Gmail, "sanitize/limit the `<Preview>` value"), `uninlined-style` (high, Gmail, "inline every
style"), `outlook-button-no-mso` (medium, Outlook, "wrap in a VML bulletproof button"). Plus the
advisory notes for the hazards that can't be statically proven. A clean template → "no detectable
hazards" with the explicit caveat that client coverage is not exhaustive.

## Refs

- `brain/OPINIONS.md` — O-03 (rendering is a deliverability input), O-04 (inline everything)
- `brain/KNOWN-PITFALLS.md` — PIT-16, PIT-17, PIT-18, PIT-19, PIT-20
- `brain/BATTLE-TESTED-SCENARIOS.md` — SCN-09 (Outlook button), SCN-10 (Gmail blank)
