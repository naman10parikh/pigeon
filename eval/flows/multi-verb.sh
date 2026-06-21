#!/usr/bin/env bash
# D17 — exercise the CLI verb router on a multi-verb flow ($0, no creds).
# Proves verify → stream-check → suppress → ask each route to their handler and return.
set -euo pipefail
cd "$(dirname "$0")/../.."
CLI="node dist/cli.js"

echo "[1/4] verify (fixture)"      && $CLI verify --dns-fixture eval/fixtures/dns/aligned.json --json | grep -q '"ready": true'
echo "[2/4] stream-check (refuse)" && $CLI stream-check cold resend | grep -q 'REFUSE'
echo "[3/4] suppress (add)"        && $CLI suppress add router-flow@example.com | grep -q 'suppressed'
echo "[4/4] ask (diagnose)"        && $CLI ask "spam despite verified domain" | grep -q 'matched: SCN'
echo "multi-verb router flow: ALL 4 verbs routed + returned ✓"
