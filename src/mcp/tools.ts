/**
 * tools.ts — pigeon's MCP tool surface (PLAN §4 "MCP server tool list").
 *
 * Each tool REUSES the Cluster-B library entrypoint (`runVerify`/`runSendTest`/
 * `lintSource`/`runStreamCheck`/…) that the CLI also calls — the CLI and the MCP
 * server are two faces of the SAME engine, no logic duplication (Karpathy: one
 * source of truth). The 12 tool names mirror the CLI verbs 1:1 (the parity
 * contract tested in test/contract/mcp-parity.test.ts).
 *
 * Why the `runX` libs and not the CLI `register*` actions: the actions call
 * `printResult` (writes stdout) + `exitFrom` (sets process.exitCode). On the MCP
 * stdio transport stdout IS the JSON-RPC channel — any stray write corrupts it.
 * The `runX` functions return a structured `VerbResult` and only `logRun()` (which
 * on its error path uses `console.warn` → stderr, never stdout). So calling them
 * is BOTH clean for the protocol stream AND keeps the §10 audit trail intact —
 * an MCP-initiated send is logged to logs/runs.jsonl exactly like a CLI send.
 */
import { runVerify } from "../commands/verify.js";
import { runSendTest } from "../commands/send-test.js";
import { lintSource } from "../commands/lint.js";
import { runStreamCheck } from "../commands/stream-check.js";
import { runUnsubscribeGen } from "../commands/unsubscribe.js";
import { runWarmupPlan } from "../commands/warmup.js";
import { runSuppress } from "../commands/suppress.js";
import { runWebhookVerify } from "../commands/webhook.js";
import { runSesNarrative } from "../commands/ses-narrative.js";
import { runMigratePlan } from "../commands/migrate.js";
import { runNotify } from "../commands/notify.js";
import { runAsk } from "../commands/ask.js";
import type { VerbResult } from "../lib/result.js";

/** JSON Schema (draft-07 subset) for an MCP tool's input. */
interface InputSchema {
  readonly type: "object";
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
}

/** An MCP tool descriptor returned by `tools/list`. */
export interface ToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: InputSchema;
}

const STR = { type: "string" } as const;
const BOOL = { type: "boolean" } as const;
const STR_ARR = { type: "array", items: { type: "string" } } as const;

/**
 * The 12 pigeon tools (PLAN §4 MCP list). Names are `pigeon.<verb>` so they
 * mirror the CLI verbs 1:1 (snake_case where the CLI verb is multi-word —
 * e.g. CLI `send-test` ↔ MCP `pigeon.send_test`). The parity test asserts this set
 * equals the CLI verb set (minus the local-only `serve`/`doctor`/`inbound` shell verbs).
 */
export const TOOL_DESCRIPTORS: readonly ToolDescriptor[] = [
  {
    name: "pigeon.verify",
    description:
      "dig SPF/DKIM/DMARC out-of-band AND check DMARC ALIGNMENT with the From: (never trusts a provider's cached 'verified' flag — O-11/O-10/SCN-02). Returns { spf, dkim, dmarc, aligned, ready, findings[] }. ready=true iff all three present AND aligned AND under the 10-lookup SPF ceiling.",
    inputSchema: {
      type: "object",
      properties: { domain: STR, dnsFixture: STR, from: STR },
    },
  },
  {
    name: "pigeon.send_test",
    description:
      "Render a React-Email template and send it through the active provider in TEST MODE with a default idempotency key (THE acceptance bar half 2). Returns { id, accepted, idempotencyKey, testMode, deduped }. Respects the O-02 HARD-REFUSE stream guardrail even in test mode.",
    inputSchema: {
      type: "object",
      properties: {
        provider: STR,
        template: STR,
        to: STR,
        stream: STR,
        testMode: BOOL,
        idempotencyKey: STR,
      },
    },
  },
  {
    name: "pigeon.lint",
    description:
      "Statically analyze email HTML/JSX for cross-client rendering hazards (Gmail <style> stripping, Outlook VML buttons, <Preview> blank-body, Tailwind safelist leak — PIT-16..20/SCN-09/10). Rendering correctness IS a deliverability input (O-03). Returns { hazards[], blocking, count }.",
    inputSchema: {
      type: "object",
      properties: { html: STR, templatePath: STR },
    },
  },
  {
    name: "pigeon.stream_check",
    description:
      "The HARD-REFUSE truth table (O-02/SCN-05/PIT-02): transactional|marketing|cold × provider → ALLOW or HARD-REFUSE. Routing cold/marketing through a transactional-only provider (Postmark/Resend) is account-DEATH. Returns { allowed, stream, provider, reason }.",
    inputSchema: {
      type: "object",
      properties: { tag: STR, provider: STR },
      required: ["tag", "provider"],
    },
  },
  {
    name: "pigeon.unsubscribe_gen",
    description:
      "Emit an RFC-8058 one-click unsubscribe config: POST-only endpoint, opaque Sqids/HMAC IDs, DKIM h= header list — MARKETING stream ONLY (O-05/O-06/SCN-13). REFUSES the transactional stream. Returns { headers, endpointContract, dkimHTags[] }.",
    inputSchema: {
      type: "object",
      properties: { stream: STR },
    },
  },
  {
    name: "pigeon.warmup_plan",
    description:
      "Author a CONTROL-LOOP warmup ramp that watches the 421/450 deferral rate and HOLDs on a spike — 'slow is fast' (O-08/SCN-11/PIT-09), not a fixed doubling schedule. Returns { schedule[], holdSignal }.",
    inputSchema: {
      type: "object",
      properties: { domain: STR, targetVolume: STR },
    },
  },
  {
    name: "pigeon.suppress",
    description:
      "Cross-provider hard-bounce/complaint suppression list — add or check an address; suppressed addresses are NEVER re-sent (PIT-05, the AUP-threshold guardrail). Returns { suppressed, entry }.",
    inputSchema: {
      type: "object",
      properties: { op: STR, address: STR, reason: STR },
      required: ["op", "address"],
    },
  },
  {
    name: "pigeon.webhook_verify",
    description:
      "Validate a bounce/complaint webhook signature (HMAC), then suppress the bounced/complained address (consume→suppress, PIT-05/JTBD-4). Returns { valid, action }.",
    inputSchema: {
      type: "object",
      properties: { provider: STR, payload: STR, signature: STR, secret: STR },
      required: ["provider", "payload"],
    },
  },
  {
    name: "pigeon.ses_narrative",
    description:
      "Author the AWS SES production-access (sandbox-exit) narrative from the bounce/complaint/unsubscribe handling pigeon implements — auth-first ordering, the four T&S questions (O-17/O-25/SCN-15/PIT-13). The narrative IS the product; never submit vague free-text. Returns { narrative, prerequisitesMet[] }.",
    inputSchema: {
      type: "object",
      properties: { domain: STR },
    },
  },
  {
    name: "pigeon.migrate_plan",
    description:
      "The safe provider-migration runbook: EXPORT logs BEFORE flipping DNS (tiny retention windows), re-verify auth+alignment, warm from ZERO via the control loop (reputation does NOT transfer — O-19/SCN-08/PIT-09/10). Returns { steps[], logRetentionDays, warmupRequired }.",
    inputSchema: {
      type: "object",
      properties: { from: STR, to: STR },
      required: ["from", "to"],
    },
  },
  {
    name: "pigeon.notify",
    description:
      "Multi-channel notification fan-out (email + push + SMS + in-app) behind the same send() shape — Novu default, mock/dry-run by default (RQ-3/RQ-15). Returns { dispatched[], perChannelStatus }.",
    inputSchema: {
      type: "object",
      properties: { channels: STR_ARR, provider: STR },
      required: ["channels"],
    },
  },
  {
    name: "pigeon.ask",
    description:
      "Diagnose a deliverability symptom against the 19 battle-tested scenarios (the ask-the-employee path). Returns { scenarioId, diagnosis, resolution, prevention } with a brain citation and carried uncertainty where the source is disputed (e.g. SCN-05/G-05).",
    inputSchema: {
      type: "object",
      properties: { symptom: STR },
      required: ["symptom"],
    },
  },
];

/** Result of a tool call: the structured payload + an isError flag for the JSON-RPC layer. */
export interface ToolCallResult {
  readonly content: unknown;
  readonly isError: boolean;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`'${field}' must be a non-empty string`);
  }
  return v;
}

function optString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function optBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function asStringArray(v: unknown, field: string): string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  if (typeof v === "string" && v.length > 0) return v.split(",").map((s) => s.trim());
  throw new Error(`'${field}' must be a string[] or a comma-separated string`);
}

/** Wrap a VerbResult into the MCP tool-call shape (ok:false → isError:true). */
function fromVerb(res: VerbResult): ToolCallResult {
  return { content: res.data, isError: !res.ok };
}

/**
 * Dispatch a tool call to the reused Cluster-B library entrypoint. Throws on an
 * unknown tool or bad args (the JSON-RPC layer maps the throw to an error result).
 * Async because `pigeon.verify` and `pigeon.send_test` are async (DNS / provider).
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  switch (name) {
    case "pigeon.verify":
      return fromVerb(
        await runVerify(optString(args.domain), {
          ...(optString(args.dnsFixture) !== undefined ? { dnsFixture: optString(args.dnsFixture) } : {}),
          ...(optString(args.from) !== undefined ? { from: optString(args.from) } : {}),
        }),
      );

    case "pigeon.send_test":
      return fromVerb(
        await runSendTest({
          ...(optString(args.provider) !== undefined ? { provider: optString(args.provider) } : {}),
          ...(optString(args.template) !== undefined ? { template: optString(args.template) } : {}),
          ...(optString(args.to) !== undefined ? { to: optString(args.to) } : {}),
          ...(optString(args.stream) !== undefined ? { stream: optString(args.stream) } : {}),
          ...(optBool(args.testMode) !== undefined ? { testMode: optBool(args.testMode) } : {}),
          ...(optString(args.idempotencyKey) !== undefined
            ? { idempotencyKey: optString(args.idempotencyKey) }
            : {}),
        }),
      );

    case "pigeon.lint": {
      const source = optString(args.html);
      if (source !== undefined) return fromVerb(lintSource(source));
      // templatePath form: read the file via the same lib path the CLI uses.
      const path = asString(args.templatePath, "templatePath (or 'html')");
      const { readFileSync } = await import("node:fs");
      return fromVerb(lintSource(readFileSync(path, "utf8")));
    }

    case "pigeon.stream_check":
      return fromVerb(runStreamCheck(asString(args.tag, "tag"), asString(args.provider, "provider")));

    case "pigeon.unsubscribe_gen":
      return fromVerb(
        runUnsubscribeGen(
          optString(args.stream) !== undefined ? { stream: optString(args.stream) } : {},
        ),
      );

    case "pigeon.warmup_plan":
      return fromVerb(
        runWarmupPlan({
          ...(optString(args.domain) !== undefined ? { domain: optString(args.domain) } : {}),
          ...(optString(args.targetVolume) !== undefined ? { target: optString(args.targetVolume) } : {}),
        }),
      );

    case "pigeon.suppress":
      return fromVerb(
        runSuppress(asString(args.op, "op"), asString(args.address, "address"), {
          ...(optString(args.reason) !== undefined
            ? { reason: args.reason as "hard-bounce" | "complaint" | "manual" }
            : {}),
        }),
      );

    case "pigeon.webhook_verify":
      return fromVerb(
        runWebhookVerify(asString(args.provider, "provider"), asString(args.payload, "payload"), {
          ...(optString(args.signature) !== undefined ? { signature: optString(args.signature) } : {}),
          ...(optString(args.secret) !== undefined ? { secret: optString(args.secret) } : {}),
        }),
      );

    case "pigeon.ses_narrative":
      return fromVerb(
        runSesNarrative(optString(args.domain) !== undefined ? { domain: optString(args.domain) } : {}),
      );

    case "pigeon.migrate_plan":
      return fromVerb(runMigratePlan(asString(args.from, "from"), asString(args.to, "to"), {}));

    case "pigeon.notify":
      return fromVerb(
        runNotify(asStringArray(args.channels, "channels").join(","), {
          ...(optString(args.provider) !== undefined ? { provider: optString(args.provider) } : {}),
        }),
      );

    case "pigeon.ask":
      return fromVerb(runAsk(asString(args.symptom, "symptom")));

    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

/** The tool names (for the CLI/MCP parity contract test). */
export function toolNames(): string[] {
  return TOOL_DESCRIPTORS.map((t) => t.name);
}
