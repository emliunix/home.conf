// node reference/run-reference.mjs witnesses/*.yaml
// Evaluates every step of every witness with the naive reference and compares with `expect`.
// Prints `<id> step <n>: ok | MISMATCH <field> expected ... got ...`; exits 1 on any mismatch.
import { evaluateWitnessStep, loadWitness } from "./reference.mjs";
import { evaluateCorpus } from "./corpus.mjs";

const canon = (row) => JSON.stringify(Object.keys(row).sort().map((k) => [k, String(row[k])]));
const sameSet = (a = [], b = []) => {
  const x = [...a].map((r) => typeof r === "string" ? r : canon(r)).sort(), y = [...b].map((r) => typeof r === "string" ? r : canon(r)).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
const show = (v) => JSON.stringify(v);

/** Field-by-field comparison of one expect against one result; returns mismatch lines. */
export function compare(expect, got, where = "") {
  const out = [];
  for (const id of new Set([...Object.keys(expect.statuses ?? {}), ...Object.keys(got.statuses)])) {
    if (!sameSet(expect.statuses?.[id], got.statuses[id])) out.push(`${where}statuses.${id} expected ${show(expect.statuses?.[id])} got ${show(got.statuses[id])}`);
  }
  for (const policy of ["full", "prefix"]) {
    if (!sameSet(expect.demand?.[policy], got.demand[policy])) out.push(`${where}demand.${policy} expected ${show(expect.demand?.[policy])} got ${show(got.demand[policy])}`);
  }
  if (expect.verdict !== got.verdict) out.push(`${where}verdict expected ${expect.verdict} got ${got.verdict}`);
  for (const id of new Set([...Object.keys(expect.missing ?? {}), ...Object.keys(got.missing)])) {
    if (!sameSet(expect.missing?.[id], got.missing[id])) out.push(`${where}missing.${id} expected ${show(expect.missing?.[id])} got ${show(got.missing[id])}`);
  }
  return out;
}

let failed = false;
for (const file of process.argv.slice(2)) {
  const { witness, program, facts, rejected } = await loadWitness(file);
  if (witness.reference === "unsupported") { console.log(`${witness.id}: skipped (reference: unsupported; ${witness.unsupported_reason ?? "outside the stratified fragment"})`); continue; }
  for (const [n, step] of witness.steps.entries()) {
    const started = performance.now();
    let lines;
    if (witness.gate === "corpus") {
      const results = await evaluateCorpus(witness, step);
      lines = Object.keys({ ...step.expect.documents, ...results }).flatMap((doc) =>
        results[doc] && step.expect.documents[doc] ? compare(step.expect.documents[doc], results[doc], `${doc} `) : [`${doc} missing on one side`]);
    } else if (rejected || step.expect.rejected) { // §8 static checks
      lines = rejected && step.expect.rejected ? [] : [`rejected expected ${Boolean(step.expect.rejected)} got ${rejected ? show(rejected) : false}`];
    } else {
      lines = compare(step.expect, evaluateWitnessStep(program, facts, new Map(Object.entries(step.answers ?? {}))));
    }
    const ms = (performance.now() - started).toFixed(1);
    if (lines.length === 0) console.log(`${witness.id} step ${n + 1}: ok${witness.gate === "corpus" ? ` (${ms} ms)` : ""}`);
    for (const line of lines) { console.log(`${witness.id} step ${n + 1}: MISMATCH ${line}`); failed = true; }
  }
}
process.exit(failed ? 1 : 0);
