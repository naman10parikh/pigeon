/**
 * Novu multi-channel adapter (the OSS default for `notify` — RQ-3, D10). A THIN fan-out behind the
 * same send()-shaped discipline: email + push + SMS + in-app. Mock/dry-run by default (RQ-15) — a
 * live Novu send is on-demand (needs NOVU_API_KEY), not the merge bar (PLAN §13 risk 4).
 *
 * Knock is the documented alt (best DX / superior multi-tenant prefs, relevant to PIT-25) — NOT
 * wired (Karpathy minimum-viable). pigeon does transactional + notifications, never campaigns.
 */

export const NOTIFY_CHANNELS = ["email", "push", "sms", "in-app"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

export interface ChannelStatus {
  channel: NotifyChannel;
  dispatched: boolean;
  mode: "dry-run" | "live";
  note: string;
}

/** Validate a comma/space-separated channel list; throws on an unknown channel (corrupt input). */
export function parseChannels(raw: string): NotifyChannel[] {
  const parts = raw
    .split(/[,\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
  const out: NotifyChannel[] = [];
  for (const p of parts) {
    if (!(NOTIFY_CHANNELS as readonly string[]).includes(p)) {
      throw new Error(`unknown channel "${p}" — must be one of: ${NOTIFY_CHANNELS.join(", ")}`);
    }
    out.push(p as NotifyChannel);
  }
  if (out.length === 0) throw new Error("no channels given");
  return out;
}

/**
 * Fan out a notification across channels. Dry-run by default: records intent per channel without a
 * live send. With NOVU_API_KEY present + live=true, this is where a real Novu trigger call would go
 * (documented; not wired in this wave to keep the acceptance test Resend-only).
 */
export function fanOut(
  channels: NotifyChannel[],
  opts: { live?: boolean } = {},
): ChannelStatus[] {
  const haveKey = Boolean(process.env.NOVU_API_KEY);
  const live = Boolean(opts.live) && haveKey;
  return channels.map((channel) => ({
    channel,
    dispatched: true,
    mode: live ? "live" : "dry-run",
    note: live
      ? "would trigger via Novu (live wiring is on-demand)"
      : haveKey
        ? "dry-run (pass --live to use the present NOVU_API_KEY)"
        : "dry-run (no NOVU_API_KEY; live fan-out is on-demand — RQ-15)",
  }));
}
