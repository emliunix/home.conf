// corpus.mjs - `run-conformance.mjs --corpus`: S1 and S2 over corpus-draft.yaml. Every governed
// document is evaluated alone, under its rule's composed modules (composeModules, as
// probe/export-facts.mjs and reference/corpus.mjs resolve them), with its facts from
// prolog/corpus-facts.pl, constraints filtered by the step's profile.
import { readFileSync } from "node:fs";
import path from "node:path";
import { composeModules } from "../../../../doc-verify/dist/engine/index.js";
import { compileWitnessModule, translateProgram, parseFactText } from "./translate.mjs";
import { Kernel } from "./kernel.mjs";
import { evaluateS2 } from "./subject-ts.mjs";
import { compileModule } from "../../../../doc-verify/dist/engine/index.js";

const root = path.resolve(import.meta.dirname, "../../../..");
const probe = path.resolve(import.meta.dirname, "..");

function corpusFacts(file) {
  const byDoc = {};
  let doc;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const header = /^% (.+) \([^)]*\)$/.exec(line);
    if (header) { doc = header[1]; byDoc[doc] = []; continue; }
    if (doc && line.trim() && !line.startsWith(":-") && !line.startsWith("%")) byDoc[doc].push(parseFactText(line.trim().replace(/\.$/, "")));
  }
  return byDoc;
}

export async function runCorpus(witness, { compare, countMode }) {
  const facts = corpusFacts(path.join(probe, witness.facts_file ?? "prolog/corpus-facts.pl"));
  const composed = new Map();
  const out = { S1: "pass", S2: "pass", timings: [] };
  for (const [n, step] of witness.steps.entries()) {
    for (const doc of witness.documents) {
      const mods = witness.modules[doc];
      const k = mods.join(" ");
      if (!composed.has(k)) {
        const c = await composeModules(mods, async (file) => ({ path: file, content: readFileSync(path.join(root, file), "utf8"), hash: "" }));
        const { program } = await compileWitnessModule(c.yaml);
        let s2program; try { s2program = await compileModule(c.yaml); } catch (e) { s2program = { rejected: String(e.message ?? e) }; }
        composed.set(k, { program, s2program });
      }
      const { program, s2program } = composed.get(k);
      const inProfile = (c) => c.profiles === undefined || step.profile === undefined || c.profiles.includes(step.profile);
      const p1 = { ...program, constraints: program.constraints.filter(inProfile) };
      const t0 = performance.now();
      const kernel = await Kernel.create();
      kernel.load(translateProgram(p1, facts[doc] ?? []), { countMode });
      kernel.setAnswers(step.answers);
      const r1 = kernel.evaluate(p1);
      const ms = performance.now() - t0;
      const r2 = s2program.rejected ? { rejected: s2program.rejected } : evaluateS2({ ...s2program, constraints: s2program.constraints.filter(inProfile) }, facts[doc] ?? [], step.answers);
      const exp = step.expect.documents[doc];
      for (const [name, r] of [["S1", r1], ["S2", r2]]) {
        const lines = exp ? compare(exp, r, { subject: name }) : ["document: expected nothing for this document"];
        const head = `corpus ${doc} step ${n + 1} ${name}:`;
        if (lines.length === 0) console.log(`${head} ok`);
        for (const l of lines) console.log(`${head} MISMATCH ${l}`);
        if (lines.length) out[name] = "FAIL";
      }
      out.timings.push(ms);
    }
  }
  const t = out.timings;
  console.log(`corpus S1 per-document (instance startup + consult + evaluate): min ${Math.min(...t).toFixed(1)} ms, max ${Math.max(...t).toFixed(1)} ms, total ${t.reduce((a, b) => a + b, 0).toFixed(0)} ms`);
  return out;
}
