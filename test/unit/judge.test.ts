// The L3 judge script sends a request only when it is told which model to judge with (PIGEON_JUDGE_MODEL): the
// Messages API needs a model name, and pigeon never picks one. fetch is replaced before the script loads, so this
// test never reaches the network whatever the script does.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../../eval/judge.mjs", import.meta.url));
const OFFLINE = "data:text/javascript,globalThis.fetch=()=>Promise.reject(new Error('offline'))";

describe("the L3 judge script", () => {
  it("skips and says why when PIGEON_JUDGE_MODEL is not set", () => {
    const env: NodeJS.ProcessEnv = { ...process.env, ANTHROPIC_API_KEY: "test-key" };
    delete env.PIGEON_JUDGE_MODEL;
    const r = spawnSync("node", ["--import", OFFLINE, SCRIPT], { encoding: "utf8", env });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PIGEON_JUDGE_MODEL");
  });
});
