#!/usr/bin/env node
/**
 * pigeon — the deliverability-correct transactional-email + notifications CLI.
 *
 * "It arrives — in the inbox, not the spam folder." Powered by Energy.
 *
 * This is the employee's hands (PLAN §4 command tree) AND the internal verb router
 * (component 8, Dispatch). Every verb is registered here via its command module's
 * register(program) function; each verb logs to logs/runs.jsonl (Observability §10),
 * has a --help, and exits 0 (ok) / non-zero (fail or HARD-REFUSE).
 */
import { Command } from "commander";

import { registerVerify } from "./commands/verify.js";
import { registerLint } from "./commands/lint.js";
import { registerStreamCheck } from "./commands/stream-check.js";
import { registerSendTest } from "./commands/send-test.js";
import { registerUnsubscribe } from "./commands/unsubscribe.js";
import { registerWarmup } from "./commands/warmup.js";
import { registerSuppress } from "./commands/suppress.js";
import { registerWebhook } from "./commands/webhook.js";
import { registerSesNarrative } from "./commands/ses-narrative.js";
import { registerMigrate } from "./commands/migrate.js";
import { registerNotify } from "./commands/notify.js";
import { registerInbound } from "./commands/inbound.js";
import { registerDoctor } from "./commands/doctor.js";
import { registerAsk } from "./commands/ask.js";
import { registerServe } from "./commands/serve.js";

const program = new Command();

program
  .name("pigeon")
  .description(
    "Deliverability-correct transactional email + notifications. It arrives — in the inbox, not the spam folder.",
  )
  .version("0.1.0", "-V, --version", "print pigeon version")
  .showHelpAfterError();

// Cluster B — the deterministic + send verbs (this builder).
registerVerify(program); //  verify <domain>            (B9, JTBD-1)
registerSendTest(program); // send-test                  (B10, THE bar half 2)
registerLint(program); //    lint <template|->          (B9, JTBD-3)
registerStreamCheck(program); // stream-check <tag> <p>  (B9, O-02 HARD-REFUSE)
registerUnsubscribe(program); // unsubscribe gen         (B11, JTBD-6)
registerWarmup(program); //  warmup plan                (B11, JTBD-5)
registerSuppress(program); // suppress add|check        (B11, JTBD-4)
registerWebhook(program); // webhook verify             (B11, JTBD-4)
registerSesNarrative(program); // ses-narrative          (B11, JTBD-7)
registerMigrate(program); // migrate plan <from> <to>   (B11, JTBD-8)
registerNotify(program); //  notify <channels>          (B11, multi-channel)
registerInbound(program); // inbound setup              (B11, JTBD-9)
registerDoctor(program); //  doctor                     (B11, JTBD-10)
registerAsk(program); //     ask "<symptom>"            (B11, ask-the-employee)

// Cluster G — cockpit (owned by the G builder; stub here so the verb is discoverable).
registerServe(program); //   serve                      (G28)

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`pigeon: ${msg}`);
  process.exitCode = 1;
});
