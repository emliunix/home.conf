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
//   --s3           also run S3 (clingo, kernel3/subject-clingo.mjs; round-4b-preregistration.md) and
//                  compare it under the S3 rule (compareS3); with --random N, S3 against enumeration
//   --s3-seeds     run S3's three seeded defects over the witnesses and the random track (default 100
//                  programs, or --random N) and print which results each flips
// Exit 0 iff S1 has no unexpected mismatch (and, with --s3, S3 has none). S2 is informational.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import YAML from "../../../node_modules/yaml/dist/index.js";
import { Kernel } from "./kernel2/kernel.mjs";
import { translateWitness, translateProgram, parseFactText, compileWitnessModule } from "./kernel2/translate.mjs";
import { prepareS2, evaluateS2 } from "./kernel2/subject-ts.mjs";
import { prepareS3, loadS3Program, clingoVersion as _cv } from "./kernel3/subject-clingo.mjs";
import * as S3mod from "./kernel3/subject-clingo.mjs";

// A mismatch on a witness listed here prints `expected-failure`; a listed witness that passes
// prints `unexpected-pass`, a contradiction of the plan (not a success).
// S1 interval-count was listed until the two-query count encoding (core.pl §3) was in place;
// the failing state is reproduced with --count=naive, which re-adds it (see below).
const EXPECTED_FAILURES = {
  S1: {},
  S2: { "d2-minimal": "preregistration amendment: S2's prefix `settled` rule demands the irrelevant disjunct atom" },
  // round 4b: features S3 refuses. m2-negative-loop is NOT listed (review amendment 4: the even
  // loop has two answer sets and must match statuses and verdict).
  S3: {
    "present-candidates": "present/3 is out of scope for S3 (preregistration)",
    "matches-bound-interval": "matches over a count result is refused (review amendment 6: no pre-evaluation of a count operand)",
  },
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, dflt) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split("=")[1] : dflt; };
const countMode = option("count", "interval");
const incremental = flag("incremental");
const quiet = flag("quiet");
const s3 = flag("s3") || flag("s3-seeds");
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

// ---- S3 comparison rule (round-4b-preregistration.md, "Comparison rule"; review amendments) -------
const rowKeyOf = (r) => r.population !== undefined ? "population" : JSON.stringify(Object.keys(r).filter((k) => k !== "status").sort().map((k) => [k, String(r[k])]));
/** S3 mode: undetermined may refine; satisfied/violated must match (an absent binding reads as
 *  satisfied, model §4); NEEDS-REVIEW may refine to PASS/NO-GO, any other verdict must match;
 *  demand.full ⊆ the expectation's; prefix, missing and findings are not compared; `rejected`
 *  must agree. Returns { mismatches, refined }. */
export function compareS3(expect, got) {
  const mismatches = [], refined = [];
  if (expect.rejected !== undefined || got.rejected !== undefined) {
    if (!expect.rejected !== !got.rejected) mismatches.push(`rejected: expected ${show(expect.rejected ?? false)} got ${show(got.rejected ?? false)}`);
    if (expect.rejected || got.rejected) return { mismatches, refined };
  }
  if (expect.statuses !== undefined) {
    for (const id of new Set([...Object.keys(expect.statuses), ...Object.keys(got.statuses ?? {})])) {
      const E = expect.statuses[id] ?? [], G = got.statuses?.[id] ?? [];
      for (const e of E) {
        const g = G.find((x) => rowKeyOf(x) === rowKeyOf(e)), gs = g?.status ?? "satisfied";
        if (e.status === "undetermined") {
          if (gs !== "undetermined") refined.push({ kind: "status", id, row: e, to: gs, line: `statuses.${id} ${rowKeyOf(e)}: undetermined -> ${gs}${g ? "" : " (binding absent)"}` });
        } else if (gs !== e.status || (g && g.population !== e.population)) mismatches.push(`statuses.${id}: expected ${show(e)} got ${show(g ?? "absent")}`);
      }
      for (const g of G) if (g.status !== "satisfied" && !E.some((e) => rowKeyOf(e) === rowKeyOf(g))) mismatches.push(`statuses.${id}: S3 row ${show(g)} not in the expectation`);
    }
  }
  if (expect.verdict !== undefined && expect.verdict !== got.verdict) {
    if (expect.verdict === "NEEDS-REVIEW") refined.push({ kind: "verdict", line: `verdict: NEEDS-REVIEW -> ${got.verdict}` });
    else mismatches.push(`verdict: expected ${expect.verdict} got ${got.verdict}`);
  }
  if (expect.demand?.full !== undefined) {
    const extra = (got.demand?.full ?? []).filter((a) => !expect.demand.full.includes(a));
    if (extra.length) mismatches.push(`demand.full: ${show(extra)} not in the expectation's ${show(expect.demand.full)}`);
  }
  return { mismatches, refined };
}

/** Cause of an S3 refinement (review amendment 7), by re-solving variants. */
export function causeOf(prepared, answers, got, r) {
  if (r.kind === "verdict") return "follows-status";
  if (got.unknownFree > 0) return "authored-u";
  const statusIn = (res) => res.statuses?.[r.id]?.find((x) => rowKeyOf(x) === rowKeyOf(r.row))?.status ?? "satisfied";
  if (prepared.hasChoose && statusIn(prepared.variant(answers, { noExclusivity: true })) === "undetermined") return "exclusivity";
  if (prepared.usesCount(r.id)) return "exact-count";
  if (statusIn(prepared.variant(answers, { dropAnswers: true })) === r.to) return "tautology";
  return "other";
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

async function runS3(witness, opts = {}) {
  const t0 = performance.now();
  const prepared = await prepareS3(witness.module, witness.facts, opts);
  const compileMs = performance.now() - t0;
  const steps = witness.steps.map((step) => {
    const t = performance.now();
    const result = prepared.rejected ? { rejected: prepared.rejected } : prepared.step(step.answers);
    return { result, evalMs: performance.now() - t };
  });
  const loaded = await loadS3Program(witness.module);
  return { compileMs, steps, prepared, note: loaded.note };
}

/** One witness under S3: per-step lines, and pass / refined / expected-failure / FAIL / unexpected-pass. */
function judgeS3(witness, s3r, { print = true } = {}) {
  const log = print ? console.log : () => {};
  const expectedFailure = EXPECTED_FAILURES.S3[witness.id] ?? EXPECTED_FAILURES.S3[witness.gate];
  let mismatches = 0, refinedN = 0, outOfScope = false;
  if (s3r.error) { log(`${witness.gate} ${witness.id} S3: MISMATCH error: ${s3r.error.stack ?? s3r.error}`); return { verdict: expectedFailure ? "expected-failure" : "FAIL", refinedN, outOfScope: true }; }
  if (s3r.note && !quiet) log(`${witness.gate} ${witness.id} S3: note ${s3r.note}`);
  s3r.steps.forEach(({ result, evalMs }, i) => {
    const exp = witness.steps[i].expect ?? {};
    const { mismatches: lines, refined } = compareS3(exp, result);
    const head = `${witness.gate} ${witness.id} step ${i + 1} S3:`;
    if (result.rejected && !exp.rejected) outOfScope = true;
    for (const r of refined) log(`${head} refined ${r.line} [${causeOf(s3r.prepared, witness.steps[i].answers ?? {}, result, r)}]`);
    for (const l of lines) log(`${head} ${expectedFailure ? "expected-failure" : "FAIL"} ${l}`);
    if (!lines.length && !refined.length) log(`${head} ok`);
    if (result.unsat) log(`${head} finding unsat: no answer set; every binding undetermined, NEEDS-REVIEW`);
    if (!result.rejected) log(`${head} verdict ${result.verdict} joint ${result.joint}; externals E=${result.externals} (unknown-free ${result.unknownFree}), clingo solves ${result.solves}, ${evalMs.toFixed(1)} ms`);
    mismatches += lines.length; refinedN += refined.length;
  });
  let verdict = mismatches ? (expectedFailure ? "expected-failure" : "FAIL") : refinedN ? "refined" : "pass";
  if (expectedFailure && !mismatches) verdict = "unexpected-pass";
  return { verdict, refinedN, outOfScope: outOfScope && !expectedFailure };
}

// ---- main --------------------------------------------------------------------------------------
const files = readdirSync(dir).filter((f) => f.endsWith(".yaml") && (f !== "corpus-draft.yaml")).sort();
const summary = [];
const timings = [];
let s1Unexpected = 0;
const unexpectedPasses = [];
let selftest;
const tAll = performance.now();
let s3Unexpected = 0, s3Complete = true, s3Refined = 0;
const s3Rejected = [];
if (flag("s3-seeds")) { await runSeeds(); process.exit(0); }

for (const file of files) {
  const witness = YAML.parse(readFileSync(path.join(dir, file), "utf8"));
  if (witness.gate === "corpus") continue;
  const s1 = await runS1(witness).catch((e) => ({ error: e }));
  const s2 = await runS2(witness).catch((e) => ({ error: e }));
  selftest ??= s1.selftest;
  const row = { gate: witness.gate, id: witness.id };
  let s3r;
  if (s3) {
    s3r = await runS3(witness).catch((e) => ({ error: e }));
    const j = judgeS3(witness, s3r);
    row.S3 = j.verdict; s3Refined += j.refinedN;
    if (j.verdict === "FAIL") s3Unexpected += 1;
    if (j.verdict === "unexpected-pass") { s3Unexpected += 1; unexpectedPasses.push(`S3 ${witness.id}`); console.log(`${witness.gate} ${witness.id} S3: unexpected-pass (listed as expected failure: ${EXPECTED_FAILURES.S3[witness.id]})`); }
    if (j.outOfScope) s3Complete = false;
    const expRej = witness.steps.some((st) => st.expect?.rejected) ? "yes" : "no";
    const gotRej = s3r.error ? "error" : s3r.steps.some((st) => st.result.rejected) ? "yes" : "no";
    row.S3rej = `${expRej}/${gotRej}`;
  }
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
    timings.push({ id: witness.id, s1: `startup ${s1.setup.startupMs.toFixed(1)} consult ${s1.setup.consultMs.toFixed(1)} steps ${s1.steps.map((s) => s.evalMs.toFixed(1)).join("/")}`, s2: `compile ${s2.compileMs.toFixed(1)} steps ${s2.steps.map((s) => s.evalMs.toFixed(1)).join("/")}`,
      s3: s3r && !s3r.error ? `prepare ${s3r.compileMs.toFixed(1)} steps ${s3r.steps.map((s) => s.evalMs.toFixed(1)).join("/")}` : undefined });
  }
}

// ---- corpus ------------------------------------------------------------------------------------
if (flag("corpus") && existsSync(path.join(dir, "corpus-draft.yaml"))) {
  const { runCorpus } = await import("./kernel2/corpus.mjs");
  const r = await runCorpus(YAML.parse(readFileSync(path.join(dir, "corpus-draft.yaml"), "utf8")), { compare, countMode });
  const row = { gate: "corpus", id: "corpus-draft", S1: r.S1, S2: r.S2 };
  if (r.S1 === "FAIL") s1Unexpected += 1;
  if (s3) {
    const { runCorpusS3 } = await import("./kernel3/corpus.mjs");
    const r3 = await runCorpusS3(YAML.parse(readFileSync(path.join(dir, "corpus-draft.yaml"), "utf8")), { compareS3, causeOf });
    row.S3 = r3.S3; row.S3rej = `-/${r3.skipped.length ? "census" : "no"}`; s3Refined += r3.refined;
    console.log(`corpus S3: refined ${r3.refined}, failing document-steps ${r3.fails}, skipped (census, listed) ${new Set(r3.skipped).size} documents`);
    if (r3.S3 === "FAIL") s3Unexpected += 1;
  }
  summary.push(row);
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
    const row = { gate: "brute force", id: `random x${n}`, S1: r.S1, S2: r.S2 ?? "n/a" };
    if (r.S1 === "FAIL") s1Unexpected += 1;
    if (s3) {
      const { runRandomS3 } = await import("./kernel3/random.mjs");
      const r3 = await runRandomS3(brute, n, {});
      row.S3 = r3.S3; row.S3rej = "-";
      if (r3.S3 === "FAIL") s3Unexpected += 1;
      if (!r3.complete) s3Complete = false;
    }
    summary.push(row);
  }
}

console.log(`\nF9 delay-order self-test: ${selftest}`);
console.log(`S1 options: count=${countMode}, tables=${incremental ? "incremental" : "abolished per step"}`);
if (s3) {
  console.log(`S3: ${S3mod.clingoVersion ?? "clingo (not run)"} via clingo-wasm 0.6.0 (in-thread runner dist/run.js)`);
  console.log("\n| Gate | Witness | S1 | S2 | S3 | S3 rejected (exp/got) |\n| --- | --- | --- | --- | --- | --- |");
  for (const r of summary) console.log(`| ${r.gate} | ${r.id} | ${r.S1} | ${r.S2} | ${r.S3 ?? "-"} | ${r.S3rej ?? "-"} |`);
} else {
  console.log("\n| Gate | Witness | S1 | S2 |\n| --- | --- | --- | --- |");
  for (const r of summary) console.log(`| ${r.gate} | ${r.id} | ${r.S1} | ${r.S2} |`);
}
if (!quiet) {
  console.log("\ntimings (ms)");
  for (const t of timings) console.log(`  ${t.id}: S1 ${t.s1}; S2 ${t.s2}${t.s3 ? `; S3 ${t.s3}` : ""}`);
}
if (unexpectedPasses.length) console.log(`\nunexpected-pass (plan contradictions): ${unexpectedPasses.join(", ")}`);
console.log(`\nprocess ${(performance.now() - tAll).toFixed(0)} ms; S1 unexpected mismatches: ${s1Unexpected}${s3 ? `; S3 unexpected: ${s3Unexpected}, S3 refined: ${s3Refined}; clingo solves ${S3mod.stats.solves} (${S3mod.stats.solveMs.toFixed(0)} ms)` : ""}`);
if (s3) console.log(`complete: ${s3Complete}`);
process.exit(s1Unexpected === 0 && (!s3 || s3Unexpected === 0) ? 0 : 1);

// ---- S3 seeded defects (review amendment 8) -----------------------------------------------------
async function runSeeds() {
  const n = args.includes("--random") ? Number(args[args.indexOf("--random") + 1]) : 100;
  const witnesses = readdirSync(dir).filter((f) => f.endsWith(".yaml") && f !== "corpus-draft.yaml").sort()
    .map((f) => YAML.parse(readFileSync(path.join(dir, f), "utf8"))).filter((w) => w.gate !== "corpus");
  // seeds-only fixture (not a witness file): an odd negative loop has no answer set; the model's WFS
  // leaves p(d,a) undefined, so the binding is undetermined and the verdict NEEDS-REVIEW (amendment 4).
  witnesses.push({ id: "seed-odd-loop-unsat", gate: "seed", facts: ["section(d, a, root)"],
    module: "schema_version: 2\nkind: verification-module\nmodule: w\nrounds: 3\nimports: {core: doc-verify:core}\nrules:\n  p(D, S): core.section(D, S, _), not p(D, S)\nconstraints:\n  c1: {forall: \"core.section(D, S, _)\", require: \"p(D, S)\", severity: error}\n",
    steps: [{ answers: {}, expect: { statuses: { c1: [{ D: "d", S: "a", status: "undetermined" }] }, verdict: "NEEDS-REVIEW" } }] });
  const { runRandomS3 } = await import("./kernel3/random.mjs");
  const baseline = new Map();
  for (const w of witnesses) baseline.set(w.id, judgeS3(w, await runS3(w).catch((e) => ({ error: e })), { print: false }).verdict);
  const base = await runRandomS3(path.join(here, "reference/random-brute.mjs"), n, { checks: false, log: () => {} });
  console.log(`seeds baseline: witnesses ${[...baseline.values()].filter((v) => v === "FAIL").length} FAIL; random x${n} unequal ${base.unequal}`);
  for (const defect of ["ignore-body", "unsat-vacuous", "no-exclusivity"]) {
    const flipped = [];
    for (const w of witnesses) {
      const v = judgeS3(w, await runS3(w, { defect }).catch((e) => ({ error: e })), { print: false }).verdict;
      if (v !== baseline.get(w.id)) flipped.push(`${w.id} ${baseline.get(w.id)}->${v}`);
    }
    const r = await runRandomS3(path.join(here, "reference/random-brute.mjs"), n, { defect, checks: false, log: () => {} });
    const any = flipped.length > 0 || r.unequal > base.unequal;
    console.log(`seed ${defect}: ${any ? "FLIPS" : "DOES NOT FLIP"}; witnesses flipped ${flipped.length ? flipped.join(", ") : "none"}; random x${n} programs unequal to enumeration ${r.unequal} (baseline ${base.unequal})`);
  }
  console.log("complete: true");
}
void translateProgram; void parseFactText; void compileWitnessModule; void evaluateS2;
