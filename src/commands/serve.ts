/**
 * `pigeon serve` — launch the local cockpit (PLAN §10, Cluster G / item G28).
 *
 * NOT owned by the CLI builder (Cluster B). This is a discoverable stub so `pigeon --help` lists the
 * verb and the router has a handler; the G builder replaces this with the stdlib HTTP server + the
 * 4-view SPA (brain browser / run log / eval scores / ask-the-employee) on localhost:7791 (RQ-14).
 */
import type { Command } from "commander";

export function registerServe(program: Command): void {
  program
    .command("serve")
    .description("launch the local cockpit (brain / run-log / eval-scores / ask) on :7791 (Cluster G — G28)")
    .option("--port <port>", "cockpit port", "7791")
    .action(() => {
      console.error(
        "pigeon serve: the cockpit is implemented by Cluster G (item G28) — not yet wired in this build.",
      );
      console.error("  (CLI verbs are live: try `pigeon ask`, `pigeon verify`, `pigeon doctor`.)");
      process.exitCode = 1;
    });
}
