# pigeon sandbox — the Sandbox/Infra component (E22)

The isolated-runtime boot for pigeon's send path. It boots an E2B Firecracker microVM,
copies pigeon's built `dist/` + `src/templates/` into the VM, runs the REAL
`pigeon send-test --provider resend --test-mode` flow **inside the sandbox** (twice, same
idempotency key — the O-13/PIT-15 exactly-once proof), asserts rc=0 + a non-empty send id,
measures the cold start (≤500ms target), records a line to `logs/runs.jsonl`, and tears the
sandbox down.

This is a **separate sandbox-component gate (RQ-8), NOT the per-PR merge blocker.** The merge
gate is `eval/eval.mjs` (L1/L2) + the acceptance workflow's `verify` + `send-test` on the
GH-Actions runner — those need **no** E2B key (D15 local-first).

## Files

| File | Role |
| --- | --- |
| `boot.mjs` | The boot script. Real `Sandbox.create` when `E2B_API_KEY` is present; a `$0` host fallback (same send-test flow) when it is absent. Mirrors `bee/src/backend/sandbox/boot.mjs`. |
| `Dockerfile` | Portable `node:22-slim` image (parity with `hush/sandbox/Dockerfile`) for a local `docker run` of the same boot. |
| `README.md` | This file — the alt-sandbox documentation E22 requires. |

## Run it

```bash
pnpm build              # boot.mjs runs the COMPILED dist/cli.js — build first
node sandbox/boot.mjs   # E2B live boot if E2B_API_KEY is set; else the $0 host fallback
```

- **With `E2B_API_KEY`** (inherited from energy per D7): a real Firecracker boot. The
  live-Resend `re_…` id half is `🔄` until `RESEND_API_KEY` is set inside the VM (item
  S-RESEND); a `stub_…` id (no Resend key in-VM) still satisfies the boot gate honestly.
- **Without the key**: `boot.mjs` runs the identical `send-test` flow on the host ($0,
  deterministic `stub_…` id) and asserts the same rc=0 + idempotency invariant, so the CI job
  is meaningful and never blocks on a cred. Exits 0.

## CI wiring

The `sandbox-boot` job in `.github/workflows/acceptance.yml` is **additive, `push`-only, and
`continue-on-error: true`** — it can never turn the merge gate red. It passes
`E2B_API_KEY` from repo secrets; when the secret is unset it runs the $0 host fallback.

## Alt sandboxes (documented, per E22 / INFRA-STACK)

E2B is the default, but it is not a lock-in. The same `send-test --test-mode` flow runs
unchanged under any OCI-compatible microsandbox:

- **Daytona** — dev-environment sandboxes; `daytona create` + run `node sandbox/boot.mjs`
  inside the workspace. Good when you want a persistent, warmable environment.
- **microsandbox** (libkrun, Apache-2.0) — self-hosted Firecracker-class isolation with no
  vendor account. Build this `Dockerfile` and boot it under microsandbox; break-even vs
  managed E2B is ≈11k sandbox-hours/mo (see energy `.claude/harnesses/INFRA-STACK.md`).
- **Plain `docker run`** — `docker build -t pigeon-sandbox sandbox/ && docker run --rm
  pigeon-sandbox` runs the boot in an isolated container (the CI ubuntu alt uses the same
  script directly, no Docker layer needed).

## Cold start

E2B Firecracker microVMs cold-start in ~150ms. `boot.mjs` measures the actual boot time and
logs `{ verb: "sandbox-boot", coldStartMs, coldStartOk, … }` to `logs/runs.jsonl`.
