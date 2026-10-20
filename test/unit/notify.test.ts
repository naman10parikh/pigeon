/**
 * `pigeon notify` sends nothing yet: the Novu call is not wired. It must say "not sent" and exit 1
 * unless --dry-run was given, and it must never report a channel as dispatched.
 * Spawns the BUILT CLI (dist/cli.js), so run `pnpm build` first (CI builds before it tests).
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fanOut } from "../../src/lib/providers/novu.js";

const CLI = join(process.cwd(), "dist", "cli.js");

describe("notify never claims a send (Novu is not wired)", () => {
  it("fanOut marks every channel as not dispatched", () => {
    for (const s of fanOut(["email", "push"])) expect(s.dispatched).toBe(false);
    for (const s of fanOut(["sms"], { dryRun: true })) expect(s.dispatched).toBe(false);
  });

  it("without --dry-run the CLI says not sent and exits 1", () => {
    const r = spawnSync("node", [CLI, "notify", "email,push"], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Not sent/);
  });

  it("with --dry-run the CLI exits 0 and reports nothing sent", () => {
    const r = spawnSync("node", [CLI, "notify", "email,push", "--dry-run", "--json"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    const data = JSON.parse(r.stdout) as { sent: boolean; dispatched: string[] };
    expect(data.sent).toBe(false);
    expect(data.dispatched).toEqual([]);
  });
});
