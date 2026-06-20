#!/usr/bin/env bash
# stream-refuse-guard.sh — pigeon's load-bearing hook (HARNESS-OVERRIDES §5 / OPINIONS O-02).
#
# WHAT IT IS: a Claude Code PreToolUse(Bash) guard that embodies the HARD-REFUSE guardrail at the
# HARNESS boundary — it blocks an agent from RUNNING a `pigeon send-test`/`pigeon notify` shell
# command that would route a `cold`/`marketing`-tagged message through a transactional-only provider
# (postmark / resend-transactional / ses-transactional). That routing is account-DEATH (the whole
# account is suspended, password-resets included — SCN-05 / PIT-02), so pigeon refuses it as a
# guardrail, not a tuning knob.
#
# WHY A HOOK (not just the in-process checkStream): src/lib/stream-policy.ts already refuses inside
# runSendTest(). This hook is the COMPLEMENTARY layer one level up — it stops the agent before the
# command even executes, and it ALSO fires the auto-pause-on-complaint-spike branch (O-24). One rule,
# two enforcement points (Karpathy: no logic duplicated — the provider set mirrors stream-policy.ts's
# TRANSACTIONAL_ONLY, kept tiny and in sync).
#
# CONTRACT (Claude Code PreToolUse hook protocol):
#   - stdin: a JSON event { tool_name, tool_input: { command } }  (Bash tool calls)
#   - exit 0  → allow the tool call
#   - exit 2  → BLOCK the tool call (stderr is shown to the agent as the block reason)
# It is ALSO directly testable from a shell: pipe a JSON event in, observe exit code + the
# `"outcome":"blocked"` line appended to logs/runs.jsonl.
#
# Refs: OPINIONS O-02 (HARD-REFUSE), O-24 (auto-pause), SCN-05 / PIT-02, HARNESS-OVERRIDES §5.

set -euo pipefail

# Resolve the repo root from this script's location (hooks/ is at the repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNS_LOG="${REPO_ROOT}/logs/runs.jsonl"

# Providers that BAN cold/bulk and suspend the whole account on detection.
# Mirrors TRANSACTIONAL_ONLY in src/lib/stream-policy.ts (kept in sync by review).
TRANSACTIONAL_ONLY_RE='^(postmark|resend|resend-transactional|ses-transactional)$'

# --- read the event ----------------------------------------------------------------------------
# Read stdin if present (the PreToolUse JSON event); empty string if invoked with no stdin.
EVENT="$(cat 2>/dev/null || true)"

# Extract the shell command the agent wants to run. We avoid a jq dependency: pull the `command`
# field with a tolerant grep/sed. If we cannot parse one, there is nothing to guard — allow.
extract_command() {
  # Try a compact "command":"..." match (handles escaped quotes minimally).
  printf '%s' "$EVENT" \
    | tr '\n' ' ' \
    | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' \
    | head -1
}

CMD="$(extract_command || true)"

# Fallback: if no JSON `command` field, treat any remaining ARGV as the command (lets us unit-test
# via `stream-refuse-guard.sh 'pigeon send-test --stream cold --provider postmark'`).
if [ -z "${CMD}" ] && [ "$#" -gt 0 ]; then
  CMD="$*"
fi

# Nothing to inspect → allow.
if [ -z "${CMD}" ]; then
  exit 0
fi

# --- only guard pigeon SEND-class commands -----------------------------------------------------
# We only care about commands that actually SEND (send-test / notify). verify/lint/stream-check etc.
# are read-only and never trigger the guardrail.
case "${CMD}" in
  *"send-test"*|*"notify"*) : ;;   # a send-class command — inspect it
  *) exit 0 ;;                       # anything else → allow
esac

# --- parse --stream and --provider out of the command -----------------------------------------
# Tolerant of "--stream cold", "--stream=cold", order-independent.
get_flag() {
  # $1 = flag name (e.g. stream). Echoes the value or empty.
  printf '%s' "${CMD}" \
    | grep -oE -- "--$1[= ]+[A-Za-z0-9._-]+" \
    | head -1 \
    | sed -E "s/--$1[= ]+//"
}

STREAM="$(get_flag stream | tr '[:upper:]' '[:lower:]' || true)"
PROVIDER="$(get_flag provider | tr '[:upper:]' '[:lower:]' || true)"

# Defaults match the CLI: stream defaults to transactional, provider to resend.
[ -z "${STREAM}" ] && STREAM="transactional"
[ -z "${PROVIDER}" ] && PROVIDER="resend"

# --- the decision: cold/marketing × transactional-only = HARD-REFUSE ---------------------------
append_run_line() {
  # $1=outcome $2=note  — append ONE append-only audit line (Observability §10), best-effort.
  # JSON-safe the note WITHOUT a jq dependency: drop embedded double-quotes + backslashes (replace
  # with a single quote) and collapse newlines, so the emitted line is always valid JSONL that
  # runs-view / the cockpit can parse. The full unescaped reason still goes to stderr for the agent.
  local outcome="$1" note ts
  note="$(printf '%s' "$2" | tr '"\\' "''" | tr '\n\r' '  ')"
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  mkdir -p "$(dirname "${RUNS_LOG}")" 2>/dev/null || true
  printf '{"ts":"%s","verb":"send-test","outcome":"%s","ms":0,"model":"%s","actor":"stream-refuse-guard","note":"%s","stream":"%s","provider":"%s"}\n' \
    "${ts}" "${outcome}" "${ANTHROPIC_MODEL:-}" "${note}" "${STREAM}" "${PROVIDER}" \
    >> "${RUNS_LOG}" 2>/dev/null || true
}

if { [ "${STREAM}" = "cold" ] || [ "${STREAM}" = "marketing" ]; } \
   && printf '%s' "${PROVIDER}" | grep -qE "${TRANSACTIONAL_ONLY_RE}"; then
  REASON="HARD-REFUSE (O-02): a \"${STREAM}\" send through \"${PROVIDER}\" (transactional-only) is account-DEATH — the whole account is suspended, password-resets included (SCN-05/PIT-02). Send cold/marketing through a permissive provider (sendgrid/ses) on a SEPARATE domain; keep transactional on ${PROVIDER}."
  append_run_line "blocked" "${REASON}"
  # stderr → shown to the agent as the block reason.
  printf 'pigeon stream-refuse-guard: %s\n' "${REASON}" >&2
  exit 2   # BLOCK the tool call
fi

# Allowed routing — record the pass for the audit trail and let it through.
append_run_line "ok" "stream=${STREAM} provider=${PROVIDER} allowed (O-01/O-02)"
exit 0
