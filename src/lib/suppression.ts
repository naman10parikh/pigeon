/**
 * Cross-provider suppression list (JTBD-4 / PIT-05). Consume bounce/complaint → suppress → NEVER
 * re-send. 0.3% complaint is the Gmail/Yahoo blocklist line (3 per 1,000). The list is the durable
 * record that a hard-bounced/complained address is never mailed again.
 *
 * Storage: a plain JSON file at logs/suppression.json (simple, committable, no DB — Karpathy
 * minimum-viable; a production deploy would back this with a per-tenant store, O-15).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SuppressionEntry {
  address: string;
  reason: "hard-bounce" | "complaint" | "manual";
  at: string;
}

function listPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "logs", "suppression.json");
}

function load(): SuppressionEntry[] {
  const p = listPath();
  if (!existsSync(p)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? (parsed as SuppressionEntry[]) : [];
  } catch {
    return []; // corrupt list → start clean rather than crash a send-blocking check
  }
}

function save(entries: SuppressionEntry[]): void {
  const p = listPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(entries, null, 2) + "\n");
}

function norm(addr: string): string {
  return addr.trim().toLowerCase();
}

/** Add an address to the suppression list (idempotent on the address). Returns the entry. */
export function suppressAdd(
  address: string,
  reason: SuppressionEntry["reason"] = "manual",
): SuppressionEntry {
  const a = norm(address);
  const entries = load();
  const existing = entries.find((e) => e.address === a);
  if (existing) return existing;
  const entry: SuppressionEntry = { address: a, reason, at: new Date().toISOString() };
  entries.push(entry);
  save(entries);
  return entry;
}

/** Is this address suppressed? (the never-resend gate.) */
export function isSuppressed(address: string): boolean {
  const a = norm(address);
  return load().some((e) => e.address === a);
}

/** Look up a suppression entry (or null). */
export function suppressCheck(address: string): SuppressionEntry | null {
  const a = norm(address);
  return load().find((e) => e.address === a) ?? null;
}
