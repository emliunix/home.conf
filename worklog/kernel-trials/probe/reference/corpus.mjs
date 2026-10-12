// The corpus side of the reference: governed documents from .doc-verify.yaml (last match wins,
// as the checker reads it), their facts from probe/prolog/corpus-facts.pl, and each rule's
// composed program (composeModules, syntax only). Evaluation is evaluateWitnessStep per document.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import YAML from "../../../../node_modules/yaml/dist/index.js";
import { minimatch } from "../../../../node_modules/minimatch/dist/esm/index.js";
import { composeModules } from "../../../../doc-verify/dist/engine/index.js";
import { evaluateWitnessStep, loadProgram } from "./reference.mjs";
import { parseFact } from "./terms.mjs";

export const root = path.resolve(import.meta.dirname, "../../../..");
const probe = path.resolve(import.meta.dirname, "..");

/** Every tracked path a `.doc-verify.yaml` rule governs, with that rule's modules. */
export function governed() {
  const config = YAML.parse(readFileSync(path.join(root, ".doc-verify.yaml"), "utf8"));
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const out = {};
  for (const file of tracked) {
    let rule;
    for (const r of config.documents) if (minimatch(file, r.pattern, { dot: true })) rule = r.exclude ? undefined : r;
    if (rule) out[file] = rule.modules;
  }
  return out;
}

/** Facts per document, from the exported dump (one fact per line under a `% path (kind)` header). */
export function corpusFacts(file = path.join(probe, "prolog/corpus-facts.pl")) {
  const byDoc = {};
  let doc;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const header = /^% (.+) \([^)]*\)$/.exec(line);
    if (header) { doc = header[1]; byDoc[doc] = []; continue; }
    if (doc && line.trim() && !line.startsWith(":-") && !line.startsWith("%")) byDoc[doc].push(parseFact(line.trim()));
  }
  return byDoc;
}

const programs = new Map();
export async function programFor(modules) {
  const k = modules.join(" ");
  if (!programs.has(k)) {
    const composed = await composeModules(modules, async (file) => {
      const content = readFileSync(path.join(root, file), "utf8");
      return { path: file, content, hash: "" };
    });
    const { program, rejected } = await loadProgram(composed.yaml);
    if (rejected) throw new Error(`${k}: ${rejected.join("; ")}`);
    programs.set(k, program);
  }
  return programs.get(k);
}

let factsCache;
/** Evaluates one corpus step: every listed document under its rule's program, filtered by profile. */
export async function evaluateCorpus(witness, step) {
  factsCache ??= corpusFacts(witness.facts_file ? path.join(probe, witness.facts_file) : undefined);
  const results = {};
  for (const doc of witness.documents) {
    const program = await programFor(witness.modules[doc]);
    const constraints = program.constraints.filter((c) => c.profiles === undefined || step.profile === undefined || c.profiles.includes(step.profile));
    results[doc] = evaluateWitnessStep({ ...program, constraints }, factsCache[doc] ?? [], new Map(Object.entries(step.answers ?? {})));
  }
  return results;
}
