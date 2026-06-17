---
title: "FIELD — react-email & resend GitHub gotchas (rendering = spam-trigger, build, rate-limit)"
type: source
created: 2026-06-16
tags: [field-intelligence, react-email, resend, rendering, gmail, outlook, gotchas]
researcher: FIELD-INTELLIGENCE (pigeon, CP123 Wave-R)
note: "Mined via `gh issue list --repo resend/react-email`. Every row = a real version-specific bug practitioners hit. June-2026 currency: most issues 2025-2026."
---

# react-email / resend — real GitHub gotchas (the rendering-breaks-deliverability cluster)

> Why this belongs in a *deliverability* harness: a broken-rendering email (empty body in Gmail,
> blown-out Outlook button, stripped Tailwind) gets deleted/marked-spam by humans, which trains the
> mailbox provider's reputation model AGAINST you. Rendering correctness IS a deliverability input,
> not a cosmetic one. These are the gotchas an engineer only learns after shipping a broken template.

## A. Gmail / mobile-Gmail rendering gotchas (all real, mostly 2025-2026)

Source: `gh issue list --repo resend/react-email --search "Gmail in:title"` (fetched 2026-06-16)

| # | Date | Title (verbatim) | Lesson |
|---|------|------------------|--------|
| 3480 | 2026-05-26 | "Tailwind print styles break gmail media query" | Tailwind's generated `@media print` / breakpoint CSS collides with Gmail's CSS sanitizer. |
| 2712 | 2026-05-04 | "Tailwind breakpoints don't work in Gmail" | **Gmail strips `<style>` media queries** — responsive Tailwind classes silently no-op. This is the canonical email-CSS trap. |
| 2268 | 2026-05-22 | "`<Preview>` only fills whitespace to 150 chars while Gmail shows up to 200 chars" | Preheader (the `<Preview>` text) length must be tuned to the *client's* truncation, not a guess. |
| 1785 | 2026-04-10 | "`<Preview>` causes emails to appear completely empty in Gmail when certain values are passed" | A preheader bug rendered the ENTIRE email blank in Gmail — a total-delivery-failure-class rendering bug. Fixed under canary. |
| 2595 | 2025-11-18 | "Simple list demo doesnt work in gmail" | Even `<ul>`/`<li>` from the official demo broke in Gmail. |
| 983  | 2025-07-31 | "Bad tailwind style outputs for Gmail" | The long-standing root Tailwind-in-email problem. |
| 1863 | 2025-07-11 | "gmail ios dark mode converts background color" | **Gmail iOS dark mode auto-inverts/forces background colors** — your branded email looks wrong on a huge share of opens. Dark-mode color forcing is one of the most-reported and least-controllable email gotchas. |
| 1942 | 2025-07-04 | "`<Preview>` results in poor results in Gmail" | Preheader handling again. |
| 1907 | 2025-07-18 | "Tailwind directives in generated HTML when safelist defined. Breaks styling in Gmail" | Defining a Tailwind `safelist` leaked raw `@tailwind` directives into the HTML → broke Gmail. Config-knob footgun. |
| 1136 | 2025-04-18 | "Tailwind classes being striped on Gmail IOS" | Gmail iOS strips classes — inline styles are the only safe path. |
| 670  | 2023-05-05 | "Gmail renders Body background as white only" | Older but still-cited: Gmail ignores `<body>` background. |

**Extracted taste rule:** in email HTML, *inline every style*; never trust `<style>` blocks, media
queries, or Tailwind breakpoints to survive Gmail's sanitizer. Tailwind-for-email (`@react-email/tailwind`)
is a leaky abstraction — it inlines at build time but breakpoints/print/safelist edge-cases leak.

## B. Outlook (Windows desktop = the Word rendering engine) gotchas

Source: `gh issue list --repo resend/react-email --search "Outlook in:title"` (fetched 2026-06-16)

| # | Date | Title (verbatim) | Lesson |
|---|------|------------------|--------|
| 662  | 2025-11-13 | "Some email clients don't display background color on `<Body>` (including Outlook, and others)" | Outlook ignores `<body>`/`<div>` backgrounds → need VML or table-cell bgcolor. |
| 2373 | 2025-07-18 | "Button and below fails to render on Outlook" | A button component broke EVERYTHING below it in Outlook (Word engine intolerant of malformed table nesting). |
| 1269 | 2025-04-18 | "Font Component cannot change the font family in Windows Outlook" | Windows Outlook ignores web fonts / `@font-face` — falls back to Times New Roman. |
| 1512 | 2025-01-09 | "Button: Outlook Desktop left/right padding no longer working" | Padding on `<a>`/button regressed in Outlook desktop — needs VML roundrect or MSO conditional padding. |
| 1813 | 2025-02-10 | "react-email/components >=v0.29 ... misplaced line breaks causing buttons not render in Outlook 2016 & 2019" | **Version-specific regression**: bumping `@react-email/components` past v0.29 broke buttons in Outlook 2016/2019. Fixed under canary. |
| 1131 | 2024-01-27 | "Use Style Object to set font-family will not work in MacOS outlook" | Mac Outlook + style-object font-family = no-op. |

**Extracted taste rule:** Outlook-on-Windows uses the **Microsoft Word HTML engine**, not a browser
engine. Buttons need VML "bulletproof button" markup; web fonts don't work; backgrounds need
table-cell `bgcolor`. A version bump of the component lib can silently regress Outlook (see #1813,
#1512). Pin `@react-email/components` and test Outlook on every bump.

## C. Build / preview / rate-limit operational gotchas

Source: `gh search issues --repo resend/react-email` (fetched 2026-06-16)

- **#2922 (2026-02-01) "Preview server 'Send' button returns 429 due to rate limits"** — the dev
  preview server hits Resend's API rate limit when you click Send repeatedly. Lesson: even in dev,
  transactional-send APIs are rate-limited; design for 429 backoff, don't loop-send.
- **#2402 (2025-08-01) "Build with lots of email template timeout easily on build (Preview server)"** —
  many templates → preview/build times out. Lesson: template count scales build cost.
- **#3403 (2026-04-19) "Copy for AI: Open in ChatGPT fails with HTTP 431 for long prompts"** — the
  newer AI-assist feature 431s on long prompts (request-header-too-large). Minor, but a 2026 feature.

## D. What I could NOT find in this repo (flag for GAPS)

- **No `deliverability`/`DKIM`/`DMARC`/`SPF`-labeled issues in `resend/react-email`** — confirmed
  empty: `gh search issues --repo resend/react-email "deliverability OR DKIM OR DMARC OR SPF"` → `[]`.
  That is *expected*: `react-email` is the **rendering** library; deliverability lives in the Resend
  *platform* (closed) + DNS, not the open-source repo. So the OSS repo's war-stories are all
  rendering/build, and the deliverability war-stories must come from forums/blogs (field-02+).
- `resend/resend-node` issue list did not return via my `gh` query in this pass (got empty/non-JSON);
  retry needed — flag as a gap to re-mine for bounce/webhook/SDK error stories.
