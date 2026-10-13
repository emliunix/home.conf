/**
 * Child entry for hang-prone boundary cells (E15 under T1). Spawned with
 * `node --experimental-strip-types`. Built package must exist (`npm test` builds first).
 * Usage: node --experimental-strip-types boundary-one.ts <seedId> <candidate>
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import YAML from "yaml";

import type { Kernel as KernelType, TranslateProgram } from "../../src/kernel/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const ESCAPE = "/tmp/dv-escape";
const BUDGET = 876_940;
const seedId = process.argv[2];
const candName = process.argv[3];
if (seedId === undefined || candName === undefined) {
  throw new Error("usage: boundary-one.ts <seedId> <candidate>");
}

const kernelMod = (await import(pathToFileURL(path.join(ROOT, "doc-verify/dist/kernel/kernel.js")).href)) as {
  Kernel: typeof KernelType;
};
const translateMod = (await import(pathToFileURL(path.join(ROOT, "doc-verify/dist/kernel/translate.js")).href)) as {
  translateWitness: (w: { module: string; facts?: string[] }) => Promise<{
    text: string;
    program: TranslateProgram;
  }>;
};

const base = await translateMod.translateWitness(
  YAML.parse(readFileSync(path.join(HERE, "witnesses/policy-invariance.yaml"), "utf8")) as {
    module: string;
    facts?: string[];
  },
);
const reach = (payload: string) => ({
  text: `${base.text}\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), ${payload}.\n`,
  program: base.program,
  answers: {} as Record<string, string>,
});
const SUFFIX: Record<string, string> = {
  E15: "\n'w::loopx' :- 'w::loopx'.\n",
  E17: "\n'w::loopx' :- 'w::loopx'.\n",
};
if (seedId !== "E15" && seedId !== "E17") throw new Error(`hang child covers E15/E17 only; got ${seedId}`);
const built = seedId === "E15" ? reach("'w::loopx'") : reach("catch('w::loopx', _, true)");
built.text += SUFFIX[seedId] ?? "";

const CANDIDATES: Record<string, { sandbox: boolean; budget: boolean }> = {
  T1: { sandbox: true, budget: false },
  T2b: { sandbox: false, budget: true },
  T2: { sandbox: true, budget: true },
};
const cand = CANDIDATES[candName];
if (cand === undefined) throw new Error(`unknown candidate ${candName}`);

rmSync(ESCAPE, { force: true });
const kernel = await kernelMod.Kernel.create();
let outcome: string | undefined;
try {
  await kernel.load(built.text, { sandbox: cand.sandbox });
} catch (e) {
  const prolog = e instanceof Error && "prolog" in e && typeof (e as { prolog: unknown }).prolog === "string"
    ? (e as { prolog: string }).prolog
    : "";
  outcome = /core_rejected\((unsafe|directive)/.test(prolog) ? "rejected" : "error";
}
if (outcome === undefined) {
  kernel.setAnswers(built.answers);
  try {
    const result = cand.budget
      ? kernel.evaluate(built.program, { budget: BUDGET })
      : kernel.evaluate(built.program);
    outcome = result.rejected ? "rejected" : result.blocked ? "BLOCKED" : result.resource ? "resource" : "ran";
  } catch {
    outcome = "error";
  }
}
const hostEffect = existsSync(ESCAPE);
rmSync(ESCAPE, { force: true });
process.stdout.write(`__CELL__${JSON.stringify({ outcome, hostEffect })}\n`);
