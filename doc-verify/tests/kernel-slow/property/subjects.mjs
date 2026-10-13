// Subject adapters for S1 and S3 (kernel-slow suite). Every evaluate() call is counted.
// S1 uses the production doc-verify Kernel (dist/), not worklog probe sources.
import {
  compileWitnessModule,
  translateProgram,
  parseFactText,
  Kernel,
} from "../../../dist/kernel/index.js";
import { prepareS3 } from "../subject-clingo.mjs";
import { corePatcher } from "./seeds.mjs";

export const counters = { S1: 0, S3: 0, instances: 0 };

/**
 * S1: the WFS kernel. The design-04 checker's refusal (unstratified loops; a constant count
 * result) is recorded as `checkerRejected` and the kernel still runs the program, as
 * translateWitness does. A core.pl patch that does not apply throws (never a silent skip).
 * Fresh Kernel.create() per program (gate-ledger item 9: production uses a fresh instance).
 */
export async function makeS1(moduleYaml, facts, { corePatch = null } = {}) {
  let program, checkerRejected;
  try {
    ({ program, checkerRejected } = await compileWitnessModule(moduleYaml));
  } catch (e) {
    const rejected = `compile: ${e.message}`;
    return { rejected, evaluate: () => ({ rejected }) };
  }
  const kernel = await Kernel.create();
  counters.instances += 1;
  const patch = typeof corePatch === "string" ? corePatcher(corePatch) : corePatch;
  await kernel.load(translateProgram(program, facts.map(parseFactText)), { corePatch: patch });
  return {
    program, checkerRejected,
    evaluate(ans) {
      counters.S1 += 1;
      try {
        kernel.setAnswers(ans);
        return kernel.evaluate(program);
      } catch (e) {
        return { rejected: String(e.prolog ?? e.message ?? e), statuses: {}, demand: { full: [], prefix: [] }, verdict: "BLOCKED" };
      }
    },
  };
}

/** S3: clingo. `defect` is a subject-clingo seeded defect. */
export async function makeS3Eval(moduleYaml, factTexts, { defect } = {}) {
  let prepared;
  try {
    prepared = await prepareS3(moduleYaml, factTexts, { defect });
  } catch (e) {
    const rejected = String(e.message ?? e);
    return { rejected, evaluate: () => ({ rejected }) };
  }
  counters.instances += 1;
  if (prepared.rejected) return { rejected: prepared.rejected, evaluate: () => ({ rejected: prepared.rejected }) };
  return {
    prepared,
    evaluate(ans) { counters.S3 += 1; return prepared.step(ans); },
  };
}

/** One subject instance for a rendered program; `seed`: an S1 seed id (core patch) or an S3 defect. */
export function makeSubject(subject, module, facts, { patch = null, defect = null } = {}) {
  return subject === "S1" ? makeS1(module, facts, { corePatch: patch }) : makeS3Eval(module, facts, { defect });
}
