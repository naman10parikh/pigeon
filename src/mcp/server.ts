#!/usr/bin/env node
/**
 * server.ts — pigeon's OWN MCP server (PLAN §3 component 7 / §4 "MCP server tool
 * list"; HARNESS-OVERRIDES component 7). A stdio JSON-RPC 2.0 server exposing the
 * 12 pigeon deliverability tools (verify/send_test/lint/stream_check/unsubscribe_gen/
 * warmup_plan/suppress/webhook_verify/ses_narrative/migrate_plan/notify/ask) so a
 * coding agent (Claude Code, the energy hub, a sibling employee) can call pigeon
 * locally WITHOUT the shell. This is pigeon's own server — NOT the inherited
 * github/context7/memory/obsidian template.
 *
 * Transport: newline-delimited JSON-RPC over stdin/stdout (the MCP stdio
 * transport's line framing). We hand-roll the line loop rather than pulling in the
 * heavy @modelcontextprotocol/sdk — the PLAN §7 dependency pins do not include it,
 * the dev-tool stdio-local profile only needs request/response, and a dependency-
 * free server keeps the diff surgical (Karpathy simplicity; same call made by the
 * sibling CP123 hush/badge/acorn servers). Methods: `initialize`, `tools/list`,
 * `tools/call`.
 *
 * Dual-mode (D3): stdio-local NOW (this file); a hosted-OAuth HTTP transport is
 * DEFERRED ("full SaaS deferred" per D3) — when it lands it reuses the SAME
 * `callTool` dispatcher in tools.ts, so the tool surface is transport-agnostic.
 *
 * HARD invariant: stdout is the JSON-RPC channel ONLY. All diagnostics + the
 * audit-log warnings go to stderr so the protocol stream stays clean. Every tool
 * delegates to the Cluster-B `runX` lib (one engine, two faces — Karpathy), which
 * also keeps the §10 audit trail intact for MCP-initiated sends.
 */
import { createInterface } from "node:readline";
import { TOOL_DESCRIPTORS, callTool } from "./tools.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_VERSION = "0.1.0";

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: string | number | null;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

interface JsonRpcError {
  readonly code: number;
  readonly message: string;
}

/** Write a single JSON-RPC response line to stdout (the ONLY thing on stdout). */
function reply(id: string | number | null, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

/** Write a JSON-RPC error response line. */
function replyError(id: string | number | null, error: JsonRpcError): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error }) + "\n");
}

/** MCP `content` envelope: one text part carrying the JSON-stringified structured result. */
function textContent(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

/** Dispatch one parsed request. Returns nothing for notifications (no id). Async (verify/send are async). */
async function handle(req: JsonRpcRequest): Promise<void> {
  const id = req.id ?? null;
  const isNotification = req.id === undefined;

  try {
    switch (req.method) {
      case "initialize": {
        if (isNotification) return;
        reply(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: "pigeon", version: SERVER_VERSION },
          capabilities: { tools: {} },
          instructions:
            "pigeon — the deliverability-correct transactional-email + notifications employee. It arrives, in the inbox, not the spam folder. Tools mirror the CLI 1:1: verify (dig+ALIGNMENT), send_test (Resend test-mode + idempotency), lint (cross-client render hazards), stream_check (the O-02 HARD-REFUSE truth table), unsubscribe_gen (RFC-8058 POST-only, marketing-only), warmup_plan (control loop), suppress, webhook_verify, ses_narrative, migrate_plan, notify, ask (diagnose vs the 19 scenarios). I REFUSE to route cold/marketing through a transactional-only provider, and I dig DNS myself — I never trust a provider's cached 'verified' flag.",
        });
        return;
      }

      // The MCP `notifications/initialized` ping — acknowledge by doing nothing.
      case "notifications/initialized":
        return;

      case "tools/list": {
        if (isNotification) return;
        reply(id, { tools: TOOL_DESCRIPTORS });
        return;
      }

      case "tools/call": {
        if (isNotification) return;
        const name = typeof req.params?.name === "string" ? req.params.name : "";
        const args =
          req.params?.arguments && typeof req.params.arguments === "object"
            ? (req.params.arguments as Record<string, unknown>)
            : {};
        try {
          const result = await callTool(name, args);
          reply(id, { ...textContent(result.content), isError: result.isError });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Tool-level failure is reported as an MCP error-content result (a tool
          // outcome the client can read), not a transport error.
          reply(id, { ...textContent({ error: message }), isError: true });
        }
        return;
      }

      default: {
        if (isNotification) return;
        replyError(id, { code: -32601, message: `method not found: ${req.method}` });
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isNotification) replyError(id, { code: -32603, message });
  }
}

/** Read newline-delimited JSON-RPC from stdin; one request per line. */
function main(): void {
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      // A non-JSON line cannot carry an id — emit a parse error with null id.
      replyError(null, { code: -32700, message: "parse error" });
      return;
    }
    // handle() is async; surface any unexpected rejection to stderr (never stdout).
    void handle(req).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`pigeon-mcp: ${message}\n`);
    });
  });
  rl.on("close", () => process.exit(0));
}

main();
