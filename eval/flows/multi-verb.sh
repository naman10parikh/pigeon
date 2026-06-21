#!/usr/bin/env bash
# D17 — exercise the CLI verb router on a multi-verb flow ($0, no creds).
# Proves verify → stream-check → suppress → ask each route to their handler and return.
# (Captures each verb's output to a var before grepping — avoids grep -q SIGPIPE under pipefail.)
set -euo pipefail
cd "$(dirname "$0")/../.."
CLI=(node dist/cli.js)

step() { # <label> <needle> <argv...>
  local label="$1" needle="$2"; shift 2
  # capture output + tolerate the verb's own exit code (a REFUSE exits non-zero by design;
  # this test asserts each verb ROUTED to its handler, not that it "passed").
  local out; out="$("${CLI[@]}" "$@" 2>&1 || true)"
  case "$out" in *"$needle"*) echo "  ok  $label" ;; *) echo "  FAIL $label — output lacked '$needle'"; exit 1 ;; esac
}

echo "multi-verb router flow:"
step "verify (fixture)"      '"ready": true' verify --dns-fixture eval/fixtures/dns/aligned.json --json
step "stream-check (refuse)" 'REFUSE'        stream-check cold resend
step "suppress (add)"        'suppressed'    suppress add router-flow@example.com
step "ask (diagnose)"        'matched: SCN'  ask "spam despite verified domain"
echo "ALL 4 verbs routed + returned ✓"
