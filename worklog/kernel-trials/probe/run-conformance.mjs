// Round-2 conformance runner (worklog/kernel-trials/round-2-preregistration.md, Predicate).
// For every witness in probe/witnesses/*.yaml (corpus-draft.yaml only with --corpus), for every
// step: run S1 (the WFS kernel, kernel2/) and S2 (the TypeScript evaluator, kernel2/subject-ts.mjs)
// and compare each with the witness's hand-derived `expect`.
//
// Usage: node worklog/kernel-trials/probe/run-conformance.mjs [--corpus] [--count=naive]
//          [--incremental] [--dir=<witness dir>] [--random N] [--d3] [--quiet]
//   --count=naive  run S1 without the interval-count encoding (records the failing state)
//   --incremental  keep S1's tables between steps (incremental tabling) instead of abolishing
//   --d3           print S1's D3 measure (model §6) per step
// Exit 0 iff S1 has no unexpected mismatch. S2 is informational.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import YAML from "../../../node_modules/yaml/dist/index.js";
import { Kernel } from "./kernel2/kernel.mjs";
import { translateWitness, translateProgram, parseFactText, compileWitnessModule } from "./kernel2/translate.mjs";
import { prepareS2, evaluateS2 } from "./kernel2/subject-ts.mjs";

// A mismatch on a witness listed here prints `expected-failure`; a listed witness that passes
// prints `unexpected-pass`, a contradiction of the plan (not a success).
// S1 interval-count was listed until the two-query count encoding (core.pl §3) was in place;
// the failing state is reproduced with --count=naive, which re-adds it (see below).
const EXPECTED_FAILURES = {
  S1: {},
  S2: { "d2-minimal": "preregistration amendment: S2's prefix `settled` rule demands the irrelevant disjunct atom" },
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, dflt) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split("=")[1] : dflt; };
const countMode = option("count", "interval");
const incremental = flag("incremental");
const quiet = flag("quiet");
if (countMode === "naive") EXPECTED_FAILURES.S1["interval-count"] = "naive count: WFS has no three-valued aggregate (preregistration)";
const here = import.meta.dirname;
const dir = path.resolve(here, option("dir", "witnesses"));

// ---- comparison --------------------------------------------------------------------------------
const canon = (row, keys) => JSON.stringify((keys ?? Object.keys(row)).filter((k) => row[k] !== undefined).sort().map((k) => [k, Array.isArray(row[k]) ? row[k].map(String) : String(row[k])]));
const sameSet = (a = [], b = [], keysOf) => {
  const x = a.map((r) => typeof r === "string" ? r : canon(r, keysOf?.(r))).sort();
  const y = b.map((r) => typeof r === "string" ? r : canon(r, keysOf?.(r))).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
const show = (v) => JSON.stringify(v);

/** Mismatch lines `field: expected X got Y` of one result against one expect. */
export function compare(expect, got, { subject }) {
  const out = [];
  if (expect.rejected !== undefined || got.rejected !== undefined) {
    if (!expect.rejected !== !got.rejected) out.push(`rejected: expected ${show(expect.rejected ?? false)} got ${show(got.rejected ?? false)}`);
    if (expect.rejected || got.rejected) return out;
  }
  for (const id of new Set([...Object.keys(expect.statuses ?? {}), ...Object.keys(got.statuses ?? {})])) {
    if (!sameSet(expect.statuses?.[id], got.statuses?.[id])) out.push(`statuses.${id}: expected ${show(expect.statuses?.[id])} got ${show(got.statuses?.[id])}`);
  }
  for (const policy of ["full", "prefix"]) {
    if (expect.demand?.[policy] === undefined) continue;
    if (got.demand?.[policy] === undefined) continue; // S2 has one policy (prefix); full is n/a
    if (!sameSet(expect.demand[policy], got.demand[policy])) out.push(`demand.${policy}: expected ${show(expect.demand[policy])} got ${show(got.demand[policy])}`);
  }
  if (expect.verdict !== undefined && expect.verdict !== got.verdict) out.push(`verdict: expected ${expect.verdict} got ${got.verdict}`);
  if (expect.missing !== undefined) {
    // binding values + literal; the clause path only where the witness states one; extra
    // explanatory fields of the witness (note, status) are not compared
    for (const id of new Set([...Object.keys(expect.missing), ...Object.keys(got.missing ?? {})])) {
      const exp = expect.missing[id] ?? [];
      const optional = ["path", "passed_u"].filter((k) => exp.some((r) => r[k] !== undefined));
      const keysOf = (r) => Object.keys(r).filter((k) => !["note", "status"].includes(k) && (!["path", "passed_u"].includes(k) || optional.includes(k)));
      const gotRows = (got.missing?.[id] ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !["path", "passed_u"].includes(k) || optional.includes(k))));
      if (!sameSet(exp, gotRows, keysOf)) out.push(`missing.${id}: expected ${show(exp)} got ${show(got.missing?.[id] ?? [])}`);
    }
  }
  // findings: a list of {kind: unfounded, constraint, <binding vars>, atom} (m2-negative-loop)
  const expUnfounded = Array.isArray(expect.findings)
    ? expect.findings.filter((f) => f.kind === "unfounded").reduce((acc, { kind, constraint, ...rest }) => ((acc[constraint] ??= []).push(rest), acc), {})
    : expect.unfounded;
  if (expUnfounded !== undefined && subject === "S1") {
    for (const id of new Set([...Object.keys(expUnfounded), ...Object.keys(got.unfounded ?? {})])) {
      if (!sameSet(expUnfounded[id] ?? [], got.unfounded?.[id] ?? [])) out.push(`unfounded.${id}: expected ${show(expUnfounded[id] ?? [])} got ${show(got.unfounded?.[id] ?? [])}`);
    }
  }
  return out;
}

// ---- subjects ----------------------------------------------------------------------------------
async function runS1(witness) {
  const t0 = performance.now();
  const tr = await translateWitness(witness);
  const kernel = await Kernel.create();
  kernel.load(tr.text, { countMode });
  const setup = { translateMs: performance.now() - t0 - kernel.startupMs - kernel.consultMs, startupMs: kernel.startupMs, consultMs: kernel.consultMs, notes: [] };
  if (tr.repaired) setup.notes.push(`module YAML repaired mechanically: ${tr.firstError}`);
  if (tr.checkerRejected) setup.notes.push(`design-04 checker refused (S1 uses the syntax-only resolver): ${tr.checkerRejected}`);
  const steps = witness.steps.map((step) => {
    const t = performance.now();
    kernel.setAnswers(step.answers, { incremental });
    const result = kernel.evaluate(tr.program);
    const evalMs = performance.now() - t;
    const d3 = flag("d3") && !result.rejected && result.demand.full.length > 0 ? kernel.d3(tr.program, step.answers, result.demand) : undefined;
    if (d3) kernel.setAnswers(step.answers, { incremental: false });
    return { result, evalMs, d3 };
  });
  return { setup, steps, selftest: kernel.q("core_selftest_order(R)") };
}

async function runS2(witness) {
  const t0 = performance.now();
  const prepared = await prepareS2(witness.module, witness.facts);
  const compileMs = performance.now() - t0;
  const steps = witness.steps.map((step) => {
    const t = performance.now();
    const result = prepared.rejected ? { rejected: prepared.rejected } : prepared.step(step.answers);
    return { result, evalMs: performance.now() - t };
  });
  return { compileMs, steps };
}

// ---- main --------------------------------------------------------------------------------------
const files = readdirSync(dir).filter((f) => f.endsWith(".yaml") && (f !== "corpus-draft.yaml")).sort();
const summary = [];
const timings = [];
let s1Unexpected = 0;
const unexpectedPasses = [];
let selftest;
const tAll = performance.now();

for (const file of files) {
  const witness = YAML.parse(readFileSync(path.join(dir, file), "utf8"));
  if (witness.gate === "corpus") continue;
  const s1 = await runS1(witness).catch((e) => ({ error: e }));
  const s2 = await runS2(witness).catch((e) => ({ error: e }));
  selftest ??= s1.selftest;
  const row = { gate: witness.gate, id: witness.id };
  for (const [name, sub] of [["S1", s1], ["S2", s2]]) {
    const expectedFailure = EXPECTED_FAILURES[name][witness.id] ?? EXPECTED_FAILURES[name][witness.gate];
    let mismatches = 0;
    if (sub.error) {
      console.log(`${witness.gate} ${witness.id} ${name}: MISMATCH error: ${sub.error.message ?? sub.error}`);
      mismatches += 1;
    } else {
      for (const note of sub.setup?.notes ?? []) if (!quiet) console.log(`${witness.gate} ${witness.id} ${name}: note ${note}`);
      sub.steps.forEach(({ result, d3 }, i) => {
        const lines = compare(witness.steps[i].expect ?? {}, result, { subject: name });
        const head = `${witness.gate} ${witness.id} step ${i + 1} ${name}:`;
        if (lines.length === 0) console.log(`${head} ok`);
        for (const l of lines) console.log(`${head} ${expectedFailure ? "expected-failure" : "MISMATCH"} ${l}`);
        mismatches += lines.length;
        if (name === "S1" && !quiet) {
          const u = Object.entries(result.unfounded ?? {}).filter(([, r]) => r.length);
          if (u.length) console.log(`${head} finding unfounded ${show(Object.fromEntries(u))}`);
          if (result.rejected) console.log(`${head} rejected: ${result.rejected}`);
        }
        if (d3) console.log(`${head} D3 relevant ${show(d3.relevant)} share full ${d3.full} prefix ${d3.prefix}`);
      });
    }
    let verdict = mismatches === 0 ? "pass" : expectedFailure ? "expected-failure" : "FAIL";
    if (expectedFailure && mismatches === 0) {
      verdict = "unexpected-pass";
      unexpectedPasses.push(`${name} ${witness.id}`);
      console.log(`${witness.gate} ${witness.id} ${name}: unexpected-pass (listed as expected failure: ${expectedFailure})`);
    }
    if (name === "S1" && verdict === "FAIL") s1Unexpected += 1;
    row[name] = verdict;
  }
  summary.push(row);
  if (!s1.error && !s2.error) {
    timings.push({ id: witness.id, s1: `startup ${s1.setup.startupMs.toFixed(1)} consult ${s1.setup.consultMs.toFixed(1)} steps ${s1.steps.map((s) => s.evalMs.toFixed(1)).join("/")}`, s2: `compile ${s2.compileMs.toFixed(1)} steps ${s2.steps.map((s) => s.evalMs.toFixed(1)).join("/")}` });
  }
}

// ---- corpus ------------------------------------------------------------------------------------
if (flag("corpus") && existsSync(path.join(dir, "corpus-draft.yaml"))) {
  const { runCorpus } = await import("./kernel2/corpus.mjs");
  const r = await runCorpus(YAML.parse(readFileSync(path.join(dir, "corpus-draft.yaml"), "utf8")), { compare, countMode });
  summary.push({ gate: "corpus", id: "corpus-draft", S1: r.S1, S2: r.S2 });
  if (r.S1 === "FAIL") s1Unexpected += 1;
}

// ---- C4 random brute force ----------------------------------------------------------------------
if (args.includes("--random")) {
  const n = Number(args[args.indexOf("--random") + 1] ?? 50);
  const brute = path.join(here, "reference/random-brute.mjs");
  if (!existsSync(brute)) {
    console.log(`random: ${brute} does not exist; C4 skipped`);
  } else {
    const { runRandom } = await import("./kernel2/random.mjs");
    const r = await runRandom(brute, n, { compare, countMode });
    summary.push({ gate: "brute force", id: `random x${n}`, S1: r.S1, S2: r.S2 ?? "n/a" });
    if (r.S1 === "FAIL") s1Unexpected += 1;
  }
}

console.log(`\nF9 delay-order self-test: ${selftest}`);
console.log(`S1 options: count=${countMode}, tables=${incremental ? "incremental" : "abolished per step"}`);
console.log("\n| Gate | Witness | S1 | S2 |\n| --- | --- | --- | --- |");
for (const r of summary) console.log(`| ${r.gate} | ${r.id} | ${r.S1} | ${r.S2} |`);
if (!quiet) {
  console.log("\ntimings (ms)");
  for (const t of timings) console.log(`  ${t.id}: S1 ${t.s1}; S2 ${t.s2}`);
}
if (unexpectedPasses.length) console.log(`\nunexpected-pass (plan contradictions): ${unexpectedPasses.join(", ")}`);
console.log(`\nprocess ${(performance.now() - tAll).toFixed(0)} ms; S1 unexpected mismatches: ${s1Unexpected}`);
process.exit(s1Unexpected === 0 ? 0 : 1);
void translateProgram; void parseFactText; void compileWitnessModule; void evaluateS2;
