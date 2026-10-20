# pigeon — LEARNINGS (append-only)

Every error → root cause → rule. Auto-compressed when >500 lines (memory-compress.sh).

## 2026-06-21 · Escape what goes into a JSONL line
- **What broke:** the stream guard wrote its reason, quotes and all, into `logs/runs.jsonl`, which made the
  line invalid JSON and broke `runs-view` and the cockpit.
- **Rule:** strip or escape `"` and `\` before a value goes into a JSONL record; keep the full text on stderr.

## 2026-06-21 · `grep -q` under `pipefail` can kill the producer
- **What broke:** the multi-verb flow test failed at random: `grep -q` exits on the first match, the
  producer gets SIGPIPE, and `pipefail` turns that into a failure.
- **Rule:** capture the output first, then match it. A refusal exits 1 by design, so assert on the routed
  output, not the exit code.

## 2026-06-21 · Never read `$?` through `| head`
- **What broke:** `node scripts/runs-view.mjs | head -8; echo $?` printed 1 and looked like a regression.
- **Root cause:** `$?` was `head`'s exit status, not node's.
- **Rule:** read a producer's exit status on its own (`cmd >/dev/null; echo $?`) or through `PIPESTATUS`.

## 2026-06-21 · Test fixtures must not look like real keys
- **What broke:** a webhook test signed with a `whsec_`-prefixed literal tripped the secret-protection hook.
- **Rule:** sign test payloads with a plain test string. For the same reason, the idempotency keys in
  `logs/runs.jsonl` (content hashes, `src/lib/idempotency.ts`) are fingerprinted in `.gitleaksignore`.

## 2026-10-19 · Evals that never run on a pull request do not gate anything
- **What broke:** `eval/eval.mjs` was written to block CI but ran only in the nightly job, so a change
  could merge with a failing golden task.
- **Rule:** CI runs `pnpm test` and `pnpm eval` on every push and pull request (`.github/workflows/ci.yml`).

## 2026-10-19 · Pin what you install in the sandbox, and skip lifecycle scripts
- **What broke:** the E2B microVM booted, but `send-test` inside it never ran: `npm install` failed.
- **Root cause:** the boot script installed `react-dom` unpinned while `package.json` pins `react@19.2.7`;
  react-dom 19.3.1 wants react 19.3.1, so npm refused the tree (ERESOLVE). The copied `package.json` also
  gained a `prepare` script (`tsc`) that cannot run under `--omit=dev`.
- **Rule:** install the exact versions `package.json` pins, with `--ignore-scripts` (dist/ is copied in).
  CI's sandbox job is allowed to fail, so read its log, not its badge.
