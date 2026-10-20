/**
 * `pigeon notify <channels> [--provider novu]` — multi-channel notification fan-out (email + push +
 * SMS + in-app), Chime folded in. A THIN Novu adapter behind the same send()-shaped discipline.
 * The Novu call is not wired yet, so it sends nothing: it says "not sent" and exits 1, or exits 0
 * with --dry-run. Knock is the documented alt (NOT wired). pigeon does transactional +
 * notifications, NEVER marketing campaigns.
 */
import type { Command } from "commander";
import { fanOut, parseChannels } from "../lib/providers/novu.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface NotifyOptions {
  provider?: string;
  live?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export function runNotify(channelsArg: string, opts: NotifyOptions): VerbResult {
  const start = Date.now();
  const provider = (opts.provider ?? "novu").toLowerCase();
  let channels;
  try {
    channels = parseChannels(channelsArg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const res = fail({ dispatched: [], error: msg }, [`notify: ${msg}`]);
    logRun({ verb: "notify", outcome: "fail", ms: Date.now() - start, note: msg });
    return res;
  }

  const dryRun = Boolean(opts.dryRun);
  const statuses = fanOut(channels, { dryRun });
  const lines = [
    `notify via ${provider}: ${channels.join(", ")}`,
    ...statuses.map((s) => `  ${s.channel.padEnd(7)} ${s.mode.padEnd(8)} ${s.note}`),
    dryRun
      ? "Dry run: nothing was sent."
      : "Not sent: sending through Novu is not built in this version. Use --dry-run to preview the fan-out.",
  ];
  const data = {
    provider,
    sent: false,
    dispatched: [] as string[],
    perChannelStatus: statuses,
    alt: "Knock (documented, not wired)",
  };
  // Nothing is sent, so only an explicit dry run succeeds (exit 0); a send request fails (exit 1).
  const res = dryRun ? ok(data, lines) : fail(data, lines);
  logRun({
    verb: "notify",
    outcome: dryRun ? "ok" : "fail",
    ms: Date.now() - start,
    meta: { provider, channels: channels.join(","), dryRun },
    ...(dryRun ? {} : { note: "not sent: Novu is not wired" }),
  });
  return res;
}

export function registerNotify(program: Command): void {
  program
    .command("notify")
    .description("multi-channel fan-out email+push+SMS+in-app (Chime folded in). Sending is not built yet")
    .argument("<channels>", "comma/space-separated: email,push,sms,in-app")
    .option("--provider <name>", "fan-out provider (default: novu)", "novu")
    .option("--dry-run", "preview the per-channel fan-out without sending (exit 0)")
    .option("--live", "send through Novu, the default (not built yet, so it exits 1)")
    .option("--json", "emit the structured fan-out result")
    .action((channels: string, opts: NotifyOptions) => {
      const res = runNotify(channels, opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
