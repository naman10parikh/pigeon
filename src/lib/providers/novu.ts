/**
 * Novu multi-channel adapter (the OSS default for `notify` — RQ-3, D10). A THIN fan-out behind the
 * same send()-shaped discipline: email + push + SMS + in-app. The Novu trigger call is NOT wired in
 * this version, so nothing is ever sent: every channel reports dispatched:false (PLAN §13 risk 4).
 *
 * Knock is the documented alt (best DX / superior multi-tenant prefs, relevant to PIT-25) — NOT
 * wired (Karpathy minimum-viable). pigeon does transactional + notifications, never campaigns.
 */

export const NOTIFY_CHANNELS = ["email", "push", "sms", "in-app"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

export interface ChannelStatus {
  channel: NotifyChannel;
  dispatched: boolean;
  mode: "dry-run" | "not-sent";
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
 * Plan a notification fan-out across channels. Nothing is sent: the real Novu trigger call would go
 * here, and it is not wired yet (it keeps the acceptance test Resend-only). A dry run says it sent
 * nothing on purpose; otherwise each channel reports "not sent".
 */
export function fanOut(
  channels: NotifyChannel[],
  opts: { dryRun?: boolean } = {},
): ChannelStatus[] {
  return channels.map((channel) => ({
    channel,
    dispatched: false,
    mode: opts.dryRun ? "dry-run" : "not-sent",
    note: opts.dryRun ? "dry run, nothing sent" : "Novu sending is not built yet",
  }));
}
