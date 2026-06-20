/**
 * `pigeon warmup plan [--domain <d>] [--target <vol>]` — author a CONTROL-LOOP warmup ramp, NOT a
 * fixed schedule (O-08, SCN-11). Watch the 421/450 deferral rate per-provider; HOLD on a spike.
 * "Slow is fast." This is why a domain-expert beats a static template.
 */
import type { Command } from "commander";
import { logRun } from "../lib/log.js";
import { ok, printResult, exitFrom, type VerbResult } from "../lib/result.js";

export interface WarmupOptions {
  domain?: string;
  target?: string;
  json?: boolean;
}

/** A standard ramp anchored to a target daily volume; each step is gated by the deferral signal. */
function buildRamp(targetVolume: number): { day: number; volume: number }[] {
  const ramp: { day: number; volume: number }[] = [];
  let vol = 50; // never blast a cold domain (50k day-one = instant blocklist — SCN-11)
  let day = 1;
  while (vol < targetVolume && day <= 30) {
    ramp.push({ day, volume: vol });
    vol = Math.min(targetVolume, Math.ceil(vol * 2)); // double ONLY if the hold signal is clear
    day += 1;
  }
  ramp.push({ day, volume: targetVolume });
  return ramp;
}

export function runWarmupPlan(opts: WarmupOptions): VerbResult {
  const start = Date.now();
  const domain = opts.domain ?? "<sending-subdomain>";
  const target = Number(opts.target ?? "100000") || 100000;
  const ramp = buildRamp(target);

  const plan = {
    domain,
    targetVolume: target,
    model: "control-loop",
    holdSignal: "421/450",
    ramp,
    rules: [
      "Start small (~50/day); increase gradually.",
      "WATCH the 421/450 soft-bounce/deferral rate PER-PROVIDER each step.",
      "If Gmail/Outlook deferral spikes → HOLD volume (do NOT double) until it clears.",
      "Prioritize engaged recipients early to build positive signal.",
      "Domain reputation > IP reputation — don't fetishize a dedicated IP (O-07).",
      "If your provider has no auto-pause-on-bounce (e.g. Resend), pigeon supplies it (O-24).",
    ],
    ref: "OPINIONS O-08 / SCN-11 / PIT-09",
  };

  const lines = [
    `warmup plan for ${domain} → ${target.toLocaleString()}/day (control loop, not a fixed schedule)`,
    `  HOLD signal: ${plan.holdSignal} deferral spike → do not double`,
    ...ramp.map((r) => `  day ${String(r.day).padStart(2)}: ${r.volume.toLocaleString()}/day (gate on deferral before advancing)`),
    "  rules:",
    ...plan.rules.map((r) => `    - ${r}`),
  ];
  const res = ok({ ...plan }, lines);
  logRun({ verb: "warmup", outcome: "ok", ms: Date.now() - start, meta: { domain, target } });
  return res;
}

export function registerWarmup(program: Command): void {
  const cmd = program
    .command("warmup")
    .description("author a control-loop warmup ramp (watch 421/450, hold on deferral) (JTBD-5)");
  cmd
    .command("plan")
    .description("author the warmup ramp plan")
    .option("--domain <d>", "the sending subdomain to warm")
    .option("--target <vol>", "target daily volume", "100000")
    .option("--json", "emit the structured plan")
    .action((opts: WarmupOptions) => {
      const res = runWarmupPlan(opts);
      printResult(res, opts.json ?? false);
      exitFrom(res);
    });
}
