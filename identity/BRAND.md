# pigeon — BRAND

> Name rationale, tagline, the symbolic connection to the workflow, and the Energy design tokens the
> cockpit (`pigeon serve`) consumes. Powered by Energy.

## Name rationale

**pigeon** — the carrier pigeon is the oldest reliable message-delivery animal: for centuries the thing you
trusted when a message *had to arrive*. The name is light, relatable, and animate (the Energy naming family,
D4 — Spark/Ribbon vibes, heavy names rejected). The bird's entire job is the one thing this employee owns:
**it arrives** — in the inbox, not the spam folder. Pigeon=email is the locked C2-family extension (D13).

## Tagline

**"It arrives — in the inbox, not the spam folder."**

Secondary, for the human cockpit greeting: *"I make sure your emails actually arrive."*

## Symbolic connection to the workflow

A carrier pigeon does not compose the letter — it *delivers* it, reliably, across hostile terrain, and
returns. pigeon mirrors that: it does not author your campaign or your product copy; it owns the *delivery
correctness* — authentication + alignment, stream separation, rendering, suppression, warmup — the hostile
terrain (Gmail/Yahoo/Outlook reputation systems) between "send" and "inbox." The terrain is exactly why a
domain expert beats a static template: every control is a loop that watches the weather and holds when it
turns.

## Design tokens (the cockpit consumes these — Energy warm-black system)

Per `.claude/rules/design.md` + `.claude/rules/react.md`. The cockpit (`pigeon serve`, `localhost:7791`) and
any pigeon UI use the Energy editorial system — **explicitly NOT generic AI-slop purple** (the V1-flagged
prior; the `#6b21a8` indigo Wathan apologized for).

| Token | Value | Use |
| --- | --- | --- |
| `--surface` (warm black) | `#141312` | Page/app background — warm black, **NOT** pure `#000` or near-black `#09090b` |
| `--surface-raised` | `#1c1a18` | Cards, panels, raised surfaces |
| `--accent` (amber) | `#f5a623` | Primary accent, active states, the "it arrived" success cue |
| `--accent-muted` | `#b9791a` | Hover / pressed amber |
| `--text` | `#ece9e4` | Body text — soft off-white (zinc-100/200 feel), **not** pure white on dark |
| `--text-muted` | `#9b958c` | Secondary text, labels |
| `--border` | `#2b2825` | Hairline borders, dividers |
| `--ok` / `--warn` / `--fail` | `#5fb37a` / `#f5a623` / `#e0623f` | Eval pass / advisory / fail (the GT table + acceptance badge) |

**Typography:** Instrument Serif for display/headings, Poppins for body — the serif + sans pairing is the
single highest-impact anti-AI-slop change. Both via `next/font`-style loading or web fonts in the cockpit.

**Anti-patterns (banned in any pigeon UI):** no generic AI purple/indigo gradients · no pure-white text on
the warm-black surface · no symmetric AI card grids (prefer asymmetric/bento) · no loading spinners without
context (always show *what* is verifying/sending) · no placeholder gray boxes.

## Landing copy (one paragraph)

> **pigeon** makes sure your emails actually arrive. Most "email broke" incidents aren't your code — they're
> reputation, DNS alignment, or a marketing campaign poisoning your password resets. pigeon is the
> deliverability-correct layer that sits above your provider: it `dig`s your domain's authentication itself
> (it never trusts a "verified" flag), separates your transactional and marketing streams so one can't sink
> the other, lints your templates before they break in Gmail or Outlook, and warms new domains as a control
> loop instead of a fixed schedule. It refuses the one routing that kills accounts. It arrives — in the
> inbox, not the spam folder. Powered by Energy.
