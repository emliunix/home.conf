// node reference/build-corpus.mjs — writes witnesses/corpus-draft.yaml: every governed document
// under the draft profile with no answers, expect produced by the reference (derived_by: reference).
import { writeFileSync } from "node:fs";
import path from "node:path";
import YAML from "../../../../node_modules/yaml/dist/index.js";
import { governed, corpusFacts, evaluateCorpus } from "./corpus.mjs";

const docs = governed(), facts = corpusFacts();
const listed = Object.keys(docs).sort(), dumped = Object.keys(facts).sort();
if (listed.join("\n") !== dumped.join("\n")) throw new Error(`governed set and fact dump differ:\n${listed}\n---\n${dumped}`);
const witness = {
  id: "corpus-draft", gate: "corpus", derived_by: "reference",
  note: "Draft profile (constraints without `profiles`), no answers. Facts: prolog/corpus-facts.pl, qualified core::. Per-document statuses per constraint binding.",
  facts_file: "prolog/corpus-facts.pl", config: ".doc-verify.yaml", documents: listed,
  modules: Object.fromEntries(listed.map((d) => [d, docs[d]])),
  steps: [{ answers: {}, profile: "draft" }],
};
const started = performance.now();
const results = await evaluateCorpus(witness, witness.steps[0]);
const ms = performance.now() - started;
witness.steps[0].expect = { documents: results };
let text = YAML.stringify(witness, { lineWidth: 0, aliasDuplicateObjects: false });
if (text.length > 300_000) {
  witness.note += " File exceeded 300 KB: expect holds per-constraint counts instead.";
  witness.steps[0].expect = { summary: true, documents: Object.fromEntries(Object.entries(results).map(([d, r]) => [d, {
    verdict: r.verdict, demand: r.demand,
    counts: Object.fromEntries(Object.entries(r.statuses).map(([c, rows]) => [c, Object.fromEntries(["satisfied", "violated", "undetermined"].map((s) => [s, rows.filter((x) => x.status === s).length]))])),
  }])) };
  text = YAML.stringify(witness, { lineWidth: 0, aliasDuplicateObjects: false });
}
writeFileSync(path.join(import.meta.dirname, "../witnesses/corpus-draft.yaml"), text);
const verdicts = Object.values(results).reduce((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] ?? 0) + 1 }), {});
console.log(`documents ${listed.length}, evaluation ${ms.toFixed(0)} ms, ${text.length} bytes, verdicts ${JSON.stringify(verdicts)}`);
