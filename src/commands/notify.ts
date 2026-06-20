/**
 * `pigeon notify <channels> [--provider novu]` — multi-channel notification fan-out (email + push +
 * SMS + in-app), Chime folded in. A THIN Novu adapter behind the same send()-shaped discipline;
 * mock/dry-run by default (RQ-15). Knock is the documented alt (NOT wired). pigeon does
 * transactional + notifications, NEVER marketing campaigns.
 */
import type { Command } from "commander";
import { fanOut, parseChannels } from "../lib/providers/novu.js";
import { logRun } from "../lib/log.js";
import { ok, fail, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface NotifyOptions {
  provider?: string;
  live?: boolean;
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

  const statuses = fanOut(channels, { live: opts.live });
  const lines = [
    `notify via ${provider}: ${channels.join(", ")}`,
    ...statuses.map((s) => `  ${s.channel.padEnd(7)} ${s.mode.padEnd(8)} — ${s.note}`),
  ];
  const res = ok(
    {
      provider,
      dispatched: statuses.map((s) => s.channel),
      perChannelStatus: statuses,
      alt: "Knock (documented, not wired)",
    },
    lines,
  );
  logRun({
    verb: "notify",
    outcome: "ok",
    ms: Date.now() - start,
    meta: { provider, channels: channels.join(","), live: Boolean(opts.live) },
  });
  return res;
}

export function registerNotify(program: Command): void {
  program
    .command("notify")
    .description("multi-channel fan-out email+push+SMS+in-app (Chime folded in)")
    .argument("<channels>", "comma/space-separated: email,push,sms,in-app")
    .option("--provider <name>", "fan-out provider (default: novu)", "novu")
    .option("--live", "use a present NOVU_API_KEY (default: dry-run — RQ-15)")
    .option("--json", "emit the structured fan-out result")
    .action((channels: string, opts: NotifyOptions) => {
      const res = runNotify(channels, opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
