/**
 * Shared verb-result contract + tiny output helpers.
 *
 * Every pigeon verb returns a VerbResult so the CLI dispatcher (B8 router) and the MCP server
 * (C14) can both consume the SAME lib function with NO logic duplication (Karpathy: one source).
 * The CLI prints + sets the exit code; the MCP server returns the structured payload as JSON-RPC.
 */

export interface VerbResult<T = Record<string, unknown>> {
  /** true → exit 0; false → exit non-zero. A REFUSE (guardrail) is ok:false. */
  ok: boolean;
  /** the structured payload mirrored 1:1 between CLI and MCP. */
  data: T;
  /** human-readable lines printed by the CLI (the MCP server ignores these). */
  lines?: string[];
}

/** Build a successful result. */
export function ok<T extends Record<string, unknown>>(
  data: T,
  lines?: string[],
): VerbResult<T> {
  return { ok: true, data, lines };
}

/** Build a failing/refusing result (CLI exits non-zero). */
export function fail<T extends Record<string, unknown>>(
  data: T,
  lines?: string[],
): VerbResult<T> {
  return { ok: false, data, lines };
}

/**
 * Print a VerbResult to stdout. Honors --json by emitting the structured payload;
 * otherwise prints the human lines (falling back to pretty JSON if none were provided).
 */
export function printResult(res: VerbResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }
  if (res.lines && res.lines.length > 0) {
    for (const l of res.lines) console.log(l);
    return;
  }
  console.log(JSON.stringify(res.data, null, 2));
}

/** Set process exit code from a VerbResult without hard-killing (lets logs flush). */
export function exitFrom(res: VerbResult): void {
  process.exitCode = res.ok ? 0 : 1;
}
