/**
 * `pigeon serve` — launch the local cockpit (PLAN §10, Cluster G / G28): stdlib HTTP server + the
 * 4-view vanilla-JS SPA (brain browser / run log / eval scores / ask-the-employee) on :7791 (RQ-14).
 */
import type { Command } from "commander";
import { startCockpit } from "../cockpit/server.js";

export function registerServe(program: Command): void {
  program
    .command("serve")
    .description("launch the local cockpit (brain / run-log / eval-scores / ask) on :7791 (Cluster G — G28)")
    .option("--port <port>", "cockpit port", "7791")
    .action((opts: { port?: string }) => {
      startCockpit(Number(opts.port) || 7791);
    });
}
