/**
 * Email HTML render-hazard linter — the DETECTABLE subset of the cross-client rendering pitfalls
 * (PIT-16..20 / SCN-09 / SCN-10). Rendering correctness IS a deliverability input (O-03): a
 * template that blanks in Gmail or breaks in Outlook trains the spam filter against you.
 *
 * Karpathy / PLAN §13 risk-3: ship the detectable assertions as real flags; advisory-warn the
 * un-automatable ones; NEVER claim 100% client coverage (this is not a rendering engine).
 */

export interface Hazard {
  /** machine code, e.g. "preview-blank-risk", "style-media-query". */
  rule: string;
  severity: "error" | "warn" | "advisory";
  /** which client this primarily bites. */
  client: "gmail" | "outlook" | "all";
  message: string;
  /** the fix. */
  fix: string;
  /** brain citation. */
  ref: string;
}

/**
 * Statically analyze email HTML (or React-Email JSX source) for the detectable hazards.
 * Operates on the source string — no DOM, no rendering. Detects the high-signal subset:
 *  - <Preview> present + blank/risky value → Gmail-blank risk (PIT-17 / SCN-10)
 *  - <style> media queries present → Gmail strips them (PIT-16)
 *  - Tailwind safelist directive leak → raw @tailwind in HTML (PIT-19)
 *  - a button/CTA with no MSO conditional → Outlook drops it + everything below (PIT-18 / SCN-09)
 *  - non-inlined style reliance (a class= with no style= anywhere) → advisory inline-everything (O-04)
 */
export function lintHtml(source: string): Hazard[] {
  const hazards: Hazard[] = [];
  const lower = source.toLowerCase();

  // PIT-17 / SCN-10 — <Preview> blanks the whole email in Gmail on certain/blank values.
  const previewMatch = source.match(/<preview\b[^>]*>([\s\S]*?)<\/preview>/i);
  if (previewMatch || /<preview\b[^>]*\/>/i.test(source)) {
    const inner = previewMatch && previewMatch[1] !== undefined ? previewMatch[1].trim() : "";
    if (inner.length === 0) {
      hazards.push({
        rule: "preview-blank-risk",
        severity: "error",
        client: "gmail",
        message:
          "<Preview> is present but EMPTY — certain/blank <Preview> values blank the ENTIRE email body in Gmail (#1785).",
        fix: "Set a non-empty, length-tuned preheader (~50-100 chars); pin a react-email version without the preheader bug.",
        ref: "PIT-17 / SCN-10 / field-01 §A",
      });
    } else if (inner.length > 150) {
      hazards.push({
        rule: "preview-length-risk",
        severity: "warn",
        client: "gmail",
        message: `<Preview> is ${inner.length} chars — react-email pads to 150 while Gmail shows ~200; mismatch truncates oddly (#2268).`,
        fix: "Tune the preheader length to the client (~90-110 chars is safe).",
        ref: "PIT-17 / field-01 §A",
      });
    }
  }

  // PIT-16 — Gmail strips <style> media queries / breakpoints silently no-op.
  if (/<style\b[\s\S]*?@media[\s\S]*?<\/style>/i.test(source)) {
    hazards.push({
      rule: "style-media-query",
      severity: "error",
      client: "gmail",
      message:
        "A <style> block contains @media queries — Gmail's sanitizer STRIPS them (layout correct in preview, broken in Gmail web + iOS, #2712/#3480).",
      fix: "INLINE every style; do not rely on media queries surviving Gmail.",
      ref: "PIT-16 / OPINIONS O-04 / field-01 §A",
    });
  }

  // PIT-19 — Tailwind safelist leaks raw @tailwind directives into the HTML.
  if (lower.includes("safelist") || /@tailwind\b/.test(lower)) {
    hazards.push({
      rule: "tailwind-safelist-leak",
      severity: "error",
      client: "gmail",
      message:
        "A Tailwind `safelist` and/or a raw `@tailwind` directive is present — the safelist leaks raw @tailwind directives into the generated HTML, breaking Gmail styling (#1907).",
      fix: "Remove the safelist or verify the inlined output; treat Tailwind-for-email as a leaky build-time convenience.",
      ref: "PIT-19 / OPINIONS O-04 / field-01 §A",
    });
  }

  // PIT-18 / SCN-09 — Outlook (Word engine) drops a button + everything below it without MSO/VML.
  const hasButtonLike =
    /<button\b/i.test(source) ||
    /<a\b[^>]*\b(class|style)=[^>]*\b(btn|button|cta)\b/i.test(source) ||
    /<(button|a)\b[^>]*>(\s*)(get started|verify|confirm|reset|click here|sign in|log in)\b/i.test(
      source,
    );
  const hasMsoButton =
    /v:roundrect/i.test(source) || /mso-/i.test(source) || /<!--\[if\s+mso\]/i.test(source);
  if (hasButtonLike && !hasMsoButton) {
    hazards.push({
      rule: "outlook-button-not-bulletproof",
      severity: "error",
      client: "outlook",
      message:
        "A CTA button is present with NO VML/MSO conditional — Outlook-on-Windows (Word engine) can drop the button AND everything below it (#2373), strip padding (#1512), or ignore the web font.",
      fix: "Use a bulletproof button: VML <v:roundrect> inside an <!--[if mso]--> conditional, falling back to a styled <a> elsewhere; table-cell bgcolor for backgrounds.",
      ref: "PIT-18 / SCN-09 / field-01 §B",
    });
  }

  // O-04 advisory — class-driven styling with no inline style= reliance.
  const usesClasses = /\bclass(name)?=/i.test(source);
  const usesInline = /\bstyle=/i.test(source);
  if (usesClasses && !usesInline) {
    hazards.push({
      rule: "no-inline-styles",
      severity: "advisory",
      client: "all",
      message:
        "Styling is class-driven with no inline `style=` seen — many clients (Gmail) need styles inlined to render.",
      fix: "Inline every style at build (react-email/render inlines automatically); verify the rendered HTML, don't trust the source.",
      ref: "OPINIONS O-04 (inline everything) / field-01 §A",
    });
  }

  // PIT-20 advisory — Gmail iOS dark mode force-inverts backgrounds (uncontrollable; flag if a bg color carries meaning).
  if (/background(-color)?\s*[:=]\s*['"]?#?[0-9a-f]{3,8}/i.test(source)) {
    hazards.push({
      rule: "dark-mode-inversion",
      severity: "advisory",
      client: "gmail",
      message:
        "A background color is set — Gmail iOS dark mode can force-invert it (#1863); largely uncontrollable.",
      fix: "Don't rely on a background color carrying meaning; design for forced inversion.",
      ref: "PIT-20 / field-01 §A",
    });
  }

  return hazards;
}

/** True if any hazard is severity "error" (drives the lint exit code). */
export function hasBlockingHazard(hazards: Hazard[]): boolean {
  return hazards.some((h) => h.severity === "error");
}
