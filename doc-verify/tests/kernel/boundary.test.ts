/**
 * Round 5 trust boundary: 48 steps = 16 seeds × (T1 + T2b + T2), recorded outcomes
 * from results/round-5-gate.txt and round-5-budget.txt. E1, E17, E18 named explicitly.
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { Kernel, PrologError } from "../../src/kernel/index.js";
import {
  BUDGET,
  CANDIDATES,
  ESCAPE,
  HANG_TIMEOUT_MS,
  SEED_SUFFIX,
  SEEDS,
  buildSeed,
  loadCorpusFacts,
  type Candidate,
  type Outcome,
} from "./boundary-seeds.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function runCell(
  candName: Candidate,
  text: string,
  program: Awaited<ReturnType<typeof buildSeed>>["program"],
  answers: Record<string, string>,
): Promise<{ outcome: Outcome; hostEffect: boolean }> {
  rmSync(ESCAPE, { force: true });
  const cand = CANDIDATES[candName];
  const kernel = await Kernel.create();
  let outcome: Outcome = "ran";
  let loaded = false;
  try {
    await kernel.load(text, { sandbox: cand.sandbox });
    loaded = true;
  } catch (e) {
    const err = e as PrologError;
    outcome = /core_rejected\((unsafe|directive)/.test(err.prolog) ? "rejected" : "error";
  }
  if (loaded) {
    kernel.setAnswers(answers);
    try {
      const result = cand.budget
        ? kernel.evaluate(program, { budget: BUDGET })
        : kernel.evaluate(program);
      outcome = result.rejected ? "rejected" : result.blocked ? "BLOCKED" : result.resource ? "resource" : "ran";
    } catch {
      outcome = "error";
    }
  }
  const hostEffect = existsSync(ESCAPE);
  rmSync(ESCAPE, { force: true });
  return { outcome, hostEffect };
}

/** Hang-expecting cells: child process with a 20 s timeout -> `hang`. */
function runHangCell(seedId: string, candName: Candidate): { outcome: Outcome; hostEffect: boolean } {
  rmSync(ESCAPE, { force: true });
  try {
    const out = execFileSync(
      process.execPath,
      ["--experimental-strip-types", path.join(HERE, "boundary-one.ts"), seedId, candName],
      {
        timeout: HANG_TIMEOUT_MS,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const m = /__CELL__(.*)/.exec(out);
    if (!m) return { outcome: "error", hostEffect: false };
    return JSON.parse(m[1] as string) as { outcome: Outcome; hostEffect: boolean };
  } catch (e) {
    const err = e as { killed?: boolean; signal?: string; code?: string; stdout?: string };
    if (err.killed || err.signal === "SIGTERM" || /ETIMEDOUT/.test(String(err.code))) {
      const hostEffect = existsSync(ESCAPE);
      rmSync(ESCAPE, { force: true });
      return { outcome: "hang", hostEffect };
    }
    const m = /__CELL__(.*)/.exec(err.stdout ?? "");
    if (m) return JSON.parse(m[1] as string) as { outcome: Outcome; hostEffect: boolean };
    return { outcome: "error", hostEffect: false };
  }
}

describe("kernel boundary (round 5 gate + budget)", () => {
  const byDoc = loadCorpusFacts();

  for (const seed of SEEDS) {
    for (const cand of ["T1", "T2b", "T2"] as Candidate[]) {
      const expected = seed.expect[cand];
      const named =
        seed.id === "E1" || seed.id === "E17" || seed.id === "E18" ? ` (${seed.id} ${cand})` : "";
      it(`${seed.id} under ${cand} -> ${expected}${named}`, async () => {
        let r: { outcome: Outcome; hostEffect: boolean };
        if (expected === "hang") {
          r = runHangCell(seed.id, cand);
        } else {
          const built = await buildSeed(seed.id, byDoc);
          if (SEED_SUFFIX[seed.id]) built.text += SEED_SUFFIX[seed.id];
          r = await runCell(cand, built.text, built.program, built.answers);
        }
        expect(r.hostEffect, "host effect is a containment breach").toBe(false);
        expect(r.outcome).toBe(expected);
      }, expected === "hang" ? HANG_TIMEOUT_MS + 15_000 : 120_000);
    }
  }
});
