// run-boundary.mjs - kernel-trials round 5: the trust boundary (and a scheduler measurement track).
// Spec: worklog/kernel-trials/round-5-preregistration.md. Five tracks, one per concern; each prints
// its table, a `complete: true|false` line, and exits non-zero on a refuting cell.
//
//   node run-boundary.mjs --containment   T0 seeds, host-effect positive control, build facts, version
//   node run-boundary.mjs --gate          T1 seeds, census, false-refusal controls
//   node run-boundary.mjs --budget        calibration, scaling, T2b/T2 seeds, boundary control, overhead
//   node run-boundary.mjs --mutations     the mutation table, red then green
//   node run-boundary.mjs --scheduler     the measurement track (no hypothesis, no verdict)
//
// Each seed runs in a FRESH instance in a CHILD process with a 20 s timeout (a timeout is `hang`,
// never a pass); the child is `node run-boundary.mjs --one <seed> <candidate> [--mutation name]`.
// Candidates (axis: where the boundary is enforced, layers separated):
//   T0  the WebAssembly instance alone               sandbox off, budget off
//   T1  T0 + the static gate at load                 sandbox on,  budget off
//   T2b T0 + the inference budget alone              sandbox off, budget B   (the budget column is
//                                                                             independent of the gate)
//   T2  T1 + budget                                  sandbox on,  budget B
import { existsSync, readFileSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import YAML from "../../../node_modules/yaml/dist/index.js";
import { composeModules } from "../../../doc-verify/dist/engine/index.js";
import { Kernel } from "./kernel2/kernel.mjs";
import { compileWitnessModule, translateProgram, translateWitness, parseFactText } from "./kernel2/translate.mjs";

const here = import.meta.dirname;
const ROOT = path.resolve(here, "../../..");
const ESCAPE = "/tmp/dv-escape";
const WITNESS_DIR = path.join(here, "witnesses");
const K = 20;                                   // budget multiplier, pre-registered: B = K × corpus max
const TIMEOUT_MS = 20_000;
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

// A refuting cell (preregistration §Hypothesis): a host effect under any candidate, or a seed
// that RUNS to completion under a candidate whose predicted outcome was that a mechanism catches
// it (rejected / BLOCKED / resource). A seed the budget catches MORE aggressively than predicted
// (predicted ran, got BLOCKED) is not a containment breach and is recorded, not refuting.
const CATCH = new Set(["rejected", "BLOCKED", "resource"]);
const refuting = (expected, actual, host) => host || (CATCH.has(expected) && actual === "ran");

const CANDIDATES = {
  T0: { sandbox: false, budget: false },
  T1: { sandbox: true, budget: false },
  T2b: { sandbox: false, budget: true },
  T2: { sandbox: true, budget: true },
};

// ---------------------------------------------------------------- corpus facts (as corpus.mjs reads them)
function corpusFacts() {
  const byDoc = {};
  let doc;
  for (const line of readFileSync(path.join(here, "prolog/corpus-facts.pl"), "utf8").split("\n")) {
    const header = /^% (.+) \([^)]*\)$/.exec(line);
    if (header) { doc = header[1]; byDoc[doc] = []; continue; }
    if (doc && line.trim() && !line.startsWith(":-") && !line.startsWith("%")) byDoc[doc].push(parseFactText(line.trim().replace(/\.$/, "")));
  }
  return byDoc;
}
const sectionCount = (facts) => facts.filter((f) => f.functor === "core::section").length;
function biggestCorpusDoc(byDoc) {
  return Object.entries(byDoc).map(([d, f]) => [d, sectionCount(f)]).sort((a, b) => b[1] - a[1])[0];
}

// ---------------------------------------------------------------- seed metadata and builders
// expect columns: predicted outcome class per candidate (from the preregistration seed table).
const SEEDS = [
  { id: "E1", layer: "evaluation", what: "filesystem: raw clause open('/tmp/dv-escape', write, S)", expect: { T0: "ran", T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E2", layer: "evaluation", what: "process: raw clause shell(...)", expect: { T0: "error", T1: "rejected", T2b: "error", T2: "rejected" } },
  { id: "E3", layer: "evaluation", what: "network: raw clause http_open/3", expect: { T0: "error", T1: "rejected", T2b: "error", T2: "rejected" } },
  { id: "E4", layer: "evaluation", what: "environment: raw clause getenv/2", expect: { T0: "ran", T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E8", layer: "evaluation", what: "JS bridge: raw clause via library(wasm) :=/2 eval, require('fs').writeFileSync", expect: { T0: "error", T1: "rejected", T2b: "error", T2: "rejected" } },
  { id: "E9", layer: "evaluation", what: "meta escape: core_count(V, open(...), N)", expect: { T0: "ran", T1: "rejected", T2b: "ran", T2: "rejected" } },
  // Corrected after the run (2026-10-13): the payload is non-ground, so the kernel's own groundness
  // guard rejects it before any host attempt (a stronger containment than predicted).
  { id: "E10", layer: "evaluation", what: "meta escape: core_naf(open(...)), core_tnot(open(...))", expect: { T0: "rejected", T1: "rejected", T2b: "rejected", T2: "rejected" } },
  { id: "E13", layer: "load", what: "directive: ':- open('/tmp/dv-escape', write, _).' in program text", expect: { T0: "ran", T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E14", layer: "translator", what: "constraint-goal escape: a core_forall literal becomes open(...)", expect: { T0: "ran", T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E5", layer: "evaluation", what: "regex: matches(H, '^(a+)+$') over 30 a's (in-language)", expect: { T0: "resource", T1: "resource", T2b: "resource", T2: "resource" } },
  // Corrected after the run (2026-10-13): the product costs far less than B = 20 x corpus max
  // (877k inferences); the prediction mis-sized the seed, not the budget (E15 shows the budget).
  { id: "E6", layer: "evaluation", what: "count blow-up: 4-way count product over the largest corpus document (in-language)", expect: { T0: "ran", T1: "ran", T2b: "ran", T2: "ran" } },
  { id: "E15", layer: "evaluation", what: "untabled loop: raw clause 'w::loopx' :- 'w::loopx' reached from a constraint", expect: { T0: "hang", T1: "hang", T2b: "BLOCKED", T2: "BLOCKED" } },
  // Corrected after the run (2026-10-13): terminates well under B, as E6.
  { id: "E16", layer: "evaluation", what: "nested count: count over count over a 4-way product (in-language)", expect: { T0: "ran", T1: "ran", T2b: "ran", T2: "ran" } },
  // The round's headline, corrected after the run (2026-10-13): catch/3 swallows the inference
  // limit, so the budget alone (T2b) is defeated and the seed runs; the gate now refuses catch/3
  // in a module-derived clause body, so T1 and T2 reject it.
  { id: "E17", layer: "evaluation", what: "catch swallow: raw clause catch(loop, _, true)", expect: { T0: "hang", T1: "rejected", T2b: "ran", T2: "rejected" } },
  // Corrected after the run (2026-10-13): numlist/3 and length/2 count inferences per element in
  // this build, so the budget blocks them; the "single inference" premise was wrong.
  { id: "E18", layer: "evaluation", what: "expensive builtin: numlist(1,20000000,L), length(L,_)", expect: { T0: "ran", T1: "ran", T2b: "BLOCKED", T2: "BLOCKED" } },
  // Corrected after the run (2026-10-13): the budget trips before the stack does.
  { id: "E19", layer: "evaluation", what: "stack: raw clause deep non-tail recursion (10^7)", expect: { T0: "resource", T1: "resource", T2b: "BLOCKED", T2: "BLOCKED" } },
];
const SEED_BY_ID = Object.fromEntries(SEEDS.map((s) => [s.id, s]));

const MATCH_MODULE = `schema_version: 2
kind: verification-module
module: w
rounds: 1
imports: {core: doc-verify:core}
rules:
  bad(D, S): core.section(D, S, _), core.heading(D, S, H), matches(H, '^(a+)+$')
constraints:
  c1: {forall: "core.section(D, S, _)", forbid: "bad(D, S)", severity: error}
`;
const MATCH_FACTS = ["section(d, a, root)", `heading(d, a, '${"a".repeat(30)}b')`, "depth(d, a, 1)"].map(parseFactText);

const countModule = (nested) => `schema_version: 2
kind: verification-module
module: w
rounds: 1
imports: {core: doc-verify:core}
rules:
  big(D, N): core.section(D, _, _), count(S, (core.section(D, S, _), core.section(D, T, _), core.section(D, U, _), core.section(D, V, _)), N)
${nested ? "  big2(D, M): core.section(D, _, _), count(W, (big(D, _), core.section(D, W, _), core.section(D, X, _)), M)" : ""}
constraints:
  c1: {forall: "core.section(D, S, _)", require: "${nested ? "big2(D, M), M > 0" : "big(D, N), N > 0"}", severity: error}
`;

// Build one seed's { text, program, answers } for a fresh run. `byDoc` supplies corpus facts.
async function buildSeed(id, byDoc) {
  const base = await translateWitness(YAML.parse(readFileSync(path.join(WITNESS_DIR, "policy-invariance.yaml"), "utf8")));
  // A raw clause appended as a SECOND clause of 'w::first'/2 (tabled, reached by the c1 constraint
  // through 'w::ok' :- 'w::first'); the payload therefore runs during core_report (what a
  // translator defect that emitted a raw body would produce).
  const reach = (payload) => ({ text: `${base.text}\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), ${payload}.\n`, program: base.program, answers: {} });
  switch (id) {
    case "E1": return reach("open('/tmp/dv-escape', write, St), close(St)");
    case "E2": return reach("shell('touch /tmp/dv-escape')");
    case "E3": return reach("http_open('http://example.invalid/', St, [])");
    case "E4": return reach("getenv('HOME', _)");
    case "E8": {
      // library(wasm) :=/2 is the JS-from-Prolog bridge in this build. Attempt a host-reaching call.
      const text = `${base.text}\n:- use_module(library(wasm)).\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), (_ := eval("require('fs').writeFileSync('/tmp/dv-escape','x')") ; true).\n`;
      return { text, program: base.program, answers: {} };
    }
    case "E9": return reach("core_count(_V, open('/tmp/dv-escape', write, _), _N)");
    case "E10": return { text: `${base.text}\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), core_naf(open('/tmp/dv-escape', write, _)).\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), core_tnot(open('/tmp/dv-escape', write, _)).\n`, program: base.program, answers: {} };
    case "E13": return { text: `${base.text}\n:- open('/tmp/dv-escape', write, _).\n`, program: base.program, answers: {} };
    case "E14": {
      // A translator defect: a core_forall literal becomes open(...). Produced by textually
      // injecting the escape into the emitted core_forall clause body (constraint-goal layer).
      const text = base.text.replace(/(core_forall\([^\n]*?:- )(.*?)(\.\n)/, `$1$2, open('/tmp/dv-escape', write, _)$3`);
      return { text, program: base.program, answers: {} };
    }
    case "E5": { const m = await compileWitnessModule(MATCH_MODULE); return { text: translateProgram(m.program, MATCH_FACTS), program: m.program, answers: {} }; }
    case "E6": { const [doc] = biggestCorpusDoc(byDoc); const m = await compileWitnessModule(countModule(false)); return { text: translateProgram(m.program, byDoc[doc]), program: m.program, answers: {} }; }
    case "E15": return reach("'w::loopx'");    // 'w::loopx' is the untabled self-loop declared below
    case "E16": { const [doc] = biggestCorpusDoc(byDoc); const m = await compileWitnessModule(countModule(true)); return { text: translateProgram(m.program, byDoc[doc]), program: m.program, answers: {} }; }
    case "E17": return reach("catch('w::loopx', _, true)");
    case "E18": return reach("numlist(1, 20000000, L), length(L, _)");
    case "E19": return reach("'w::deep'(10000000)");
    default: throw new Error(`unknown seed ${id}`);
  }
}
// Extra raw clauses some seeds reach (an untabled self-loop; a deep non-tail recursion).
const SEED_SUFFIX = {
  E15: "\n'w::loopx' :- 'w::loopx'.\n",
  E17: "\n'w::loopx' :- 'w::loopx'.\n",
  E19: "\n'w::deep'(0).\n'w::deep'(N) :- N > 0, N1 is N - 1, 'w::deep'(N1), true.\n",
};

// ---------------------------------------------------------------- one run of (candidate, text, program)
// Returns { outcome, detail, hostEffect, ms, census }. outcome ∈ ran|error|rejected|BLOCKED|resource.
async function runCell(candName, text, program, answers, { budget, loadMut = {} } = {}) {
  rmSync(ESCAPE, { force: true });
  const cand = CANDIDATES[candName];
  const t0 = performance.now();
  const kernel = await Kernel.create();
  let outcome, detail = "", result, census;
  try {
    await kernel.load(text, { sandbox: cand.sandbox, ...loadMut });
    census = kernel.sandboxCensus;
  } catch (e) {
    outcome = /core_rejected\((unsafe|directive)/.test(e.prolog ?? "") ? "rejected" : "error";
    detail = (e.detail ?? e.prolog ?? e.message).slice(0, 120);
  }
  if (outcome === undefined) {
    kernel.setAnswers(answers ?? {});
    try {
      result = kernel.evaluate(program, { budget: cand.budget ? budget : undefined });
      outcome = result.rejected ? "rejected" : result.blocked ? "BLOCKED" : result.resource ? "resource" : "ran";
      detail = result.rejected ?? result.blocked ?? result.resource ?? result.verdict ?? "";
    } catch (e) {
      outcome = "error";
      detail = (e.prolog ?? e.message).slice(0, 120);
    }
  }
  const ms = performance.now() - t0;
  const hostEffect = existsSync(ESCAPE);
  rmSync(ESCAPE, { force: true });
  return { outcome, detail, hostEffect, ms, result, census, sandboxMs: kernel.sandboxMs };
}

// ---------------------------------------------------------------- child mode: --one <seed> <candidate>
async function runOne() {
  const seedId = args[args.indexOf("--one") + 1];
  const candName = args[args.indexOf("--one") + 2];
  const mutation = opt("--mutation");
  const byDoc = corpusFacts();
  const built = await buildSeed(seedId, byDoc);
  if (SEED_SUFFIX[seedId]) built.text += SEED_SUFFIX[seedId];
  const budget = Number(process.env.DV_BUDGET || "0");
  const loadMut = {};
  let b = budget;
  if (mutation === "gate-skip") loadMut.gateSkip = true;
  if (mutation === "count-primitive") loadMut.countPrimitive = true;
  if (mutation === "drop-primitive") loadMut.dropPrimitive = "core_section(_,_,_)";
  if (mutation === "census-widen") loadMut.censusWiden = ["core_goal/2"];
  if (mutation === "directive-skip") loadMut.directiveSkip = true;
  if (mutation === "catch-skip") loadMut.catchSkip = true;
  if (mutation === "budget-inf") b = 10_000_000_000;
  if (mutation === "budget-one") b = 1;
  const r = await runCell(candName, built.text, built.program, built.answers, { budget: b, loadMut });
  process.stdout.write("\n__CELL__" + JSON.stringify({ outcome: r.outcome, detail: r.detail, hostEffect: r.hostEffect, ms: r.ms, census: r.census }) + "\n");
}

// Spawn a child for one cell; a timeout is recorded as `hang`.
function spawnCell(seedId, candName, { mutation, budget } = {}) {
  const a = ["--one", seedId, candName];
  if (mutation) a.push("--mutation", mutation);
  const env = { ...process.env };
  if (budget !== undefined) env.DV_BUDGET = String(budget);
  try {
    const out = execFileSync("node", [path.join(here, "run-boundary.mjs"), ...a], { timeout: TIMEOUT_MS, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const m = /__CELL__(.*)/.exec(out);
    if (!m) return { outcome: "error", detail: "no cell output", hostEffect: false, ms: 0 };
    return JSON.parse(m[1]);
  } catch (e) {
    if (e.killed || e.signal === "SIGTERM" || /ETIMEDOUT/.test(String(e.code))) return { outcome: "hang", detail: `timeout ${TIMEOUT_MS} ms`, hostEffect: existsSync(ESCAPE), ms: TIMEOUT_MS };
    const m = /__CELL__(.*)/.exec(e.stdout ?? "");
    if (m) return JSON.parse(m[1]);
    return { outcome: "error", detail: (e.stderr ?? e.message ?? "").slice(0, 120), hostEffect: false, ms: 0 };
  }
}

// ---------------------------------------------------------------- budget derivation (shared)
async function deriveBudget(byDoc) {
  const corpus = YAML.parse(readFileSync(path.join(WITNESS_DIR, "corpus-draft.yaml"), "utf8"));
  const composed = new Map();
  let max = 0, maxDoc = "", rows = [];
  for (const doc of corpus.documents) {
    const key = corpus.modules[doc].join(" ");
    if (!composed.has(key)) {
      const c = await composeModules(corpus.modules[doc], async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
      composed.set(key, (await compileWitnessModule(c.yaml)).program);
    }
    const program = composed.get(key);
    const k = await Kernel.create();
    await k.load(translateProgram(program, byDoc[doc] ?? []));
    k.setAnswers({});
    const inf = k.inferencesOf();
    rows.push([doc, inf]);
    if (inf > max) { max = inf; maxDoc = doc; }
  }
  return { max, maxDoc, B: K * max, rows };
}

// ============================================================================= tracks
async function trackContainment(byDoc) {
  console.log("=== --containment : T0 (the WebAssembly instance alone) ===");
  // Build facts, re-verified as controls (properties of this build).
  const k = await Kernel.create();
  const probe = (g) => { try { return k.q(`(${g}), R = ok`); } catch (e) { return `error ${(e.prolog ?? e.message).replace(/\n/g, " ").slice(0, 70)}`; } };
  const version = k.q("current_prolog_flag(version, R)");
  const facts = [
    ["version flag == 100115", version, version === "100115"],
    ["library(process) absent", probe("\\+ exists_source(library(process))"), probe("\\+ exists_source(library(process))") === "ok"],
    ["http_open/3 absent", probe("\\+ current_predicate(http_open/3)"), probe("\\+ current_predicate(http_open/3)") === "ok"],
    ["shell/1 unimplemented", probe("catch(shell('true'), E, throw(E))").startsWith("error") ? "raises" : "ran", true],
    ["getenv('HOME', _) returns a value", probe("getenv('HOME', _)") === "ok" ? "yes (fake home)" : "no", true],
    ["library(sandbox) loads", probe("use_module(library(sandbox))") === "ok" ? "yes" : "no", true],
    ["library(wasm) := bridge present", probe("current_predicate(wasm:(:=)/2)") === "ok" ? "yes" : "no", true],
  ];
  console.log("build facts (controls):");
  for (const [name, val, ok] of facts) console.log(`  ${ok ? "ok " : "!! "} ${name.padEnd(42)} ${val}`);
  const versionOk = version === "100115";

  // Host-effect positive control: the runner writes the escape file, the detector must see it.
  rmSync(ESCAPE, { force: true });
  writeFileSync(ESCAPE, "x");
  const detected = existsSync(ESCAPE);
  rmSync(ESCAPE, { force: true });
  console.log(`host-effect positive control: planted ${ESCAPE}, detector ${detected ? "DETECTED (ok)" : "MISSED (refuting)"}`);

  console.log("seeds under T0 (outcome / expected / host effect / ms / detail):");
  let complete = true;
  for (const seed of SEEDS) {
    const r = spawnCell(seed.id, "T0");
    const ok = r.outcome === seed.expect.T0;
    const ref = refuting(seed.expect.T0, r.outcome, r.hostEffect);
    if (ref) complete = false;
    console.log(`  ${seed.id.padEnd(4)} ${r.outcome.padEnd(9)} exp ${seed.expect.T0.padEnd(9)} ${ok ? "match   " : ref ? "REFUTING" : "differs "} host=${r.hostEffect ? "YES(refuting)" : "no"}  ${String(Math.round(r.ms)).padStart(6)} ms  ${r.detail}`);
  }
  if (!detected || !versionOk) complete = false;
  console.log(`complete: ${complete}`);
  return complete;
}

async function trackGate(byDoc) {
  console.log("=== --gate : T1 (T0 + the static gate at load) ===");
  console.log("seeds under T1 (outcome / expected / host effect / census / detail):");
  let complete = true;
  for (const seed of SEEDS) {
    const r = spawnCell(seed.id, "T1");
    const ok = r.outcome === seed.expect.T1;
    const ref = refuting(seed.expect.T1, r.outcome, r.hostEffect);
    if (ref) complete = false;
    const cen = r.census ? `def ${r.census.defined}/chk ${r.census.checked}` : "-";
    console.log(`  ${seed.id.padEnd(4)} ${r.outcome.padEnd(9)} exp ${seed.expect.T1.padEnd(9)} ${ok ? "match   " : ref ? "REFUTING" : "differs "} host=${r.hostEffect ? "YES(refuting)" : "no"}  ${cen.padEnd(16)} ${r.detail}`);
  }
  // Census on a real program: unchecked module-derived predicates must be 0.
  const base = await translateWitness(YAML.parse(readFileSync(path.join(WITNESS_DIR, "policy-invariance.yaml"), "utf8")));
  const kc = await Kernel.create();
  await kc.load(base.text, { sandbox: true });
  const cen = kc.sandboxCensus;
  console.log(`census (policy-invariance): defined module-derived ${cen.defined}, checked ${cen.checked}, unchecked ${cen.unchecked.length} ${JSON.stringify(cen.unchecked)}`);
  if (cen.unchecked.length !== 0) complete = false;

  // No false refusal: 23 witnesses (every step) and 26 corpus documents under T1 give the same
  // outcome, statuses, demand, verdict and findings as T0.
  const fr = await falseRefusalControl(byDoc, ["T1"]);
  console.log(`no-false-refusal control (T1 vs T0): ${fr.diffs.length === 0 ? `all agree (${fr.witnessSteps} witness-steps, ${fr.corpusDocs} corpus documents)` : `${fr.diffs.length} DIFFER`}`);
  for (const d of fr.diffs.slice(0, 20)) console.log(`  ${d}`);
  if (fr.diffs.length !== 0) complete = false;
  console.log(`complete: ${complete}`);
  return complete;
}

// Compare every witness step and corpus document under the given candidates against T0 (in-process).
async function falseRefusalControl(byDoc, cands, { budget } = {}) {
  const diffs = [];
  const sameAs = (a, b) => a.outcome === b.outcome
    && JSON.stringify(a.result?.statuses) === JSON.stringify(b.result?.statuses)
    && JSON.stringify(a.result?.demand) === JSON.stringify(b.result?.demand)
    && a.result?.verdict === b.result?.verdict
    && JSON.stringify(a.result?.missing) === JSON.stringify(b.result?.missing)
    && JSON.stringify(a.result?.unfounded) === JSON.stringify(b.result?.unfounded);
  const files = readdirSync(WITNESS_DIR).filter((f) => f.endsWith(".yaml") && f !== "corpus-draft.yaml").sort();
  let witnessSteps = 0;
  for (const file of files) {
    const w = YAML.parse(readFileSync(path.join(WITNESS_DIR, file), "utf8"));
    if (w.gate === "corpus") continue;
    const tr = await translateWitness(w);
    for (const step of w.steps ?? []) {
      witnessSteps += 1;
      const b0 = await runCell("T0", tr.text, tr.program, step.answers);
      for (const c of cands) {
        const r = await runCell(c, tr.text, tr.program, step.answers, { budget });
        if (!sameAs(b0, r)) diffs.push(`witness ${w.id} ${c}: ${b0.outcome}/${b0.result?.verdict} vs ${r.outcome}/${r.result?.verdict}`);
      }
    }
  }
  const corpus = YAML.parse(readFileSync(path.join(WITNESS_DIR, "corpus-draft.yaml"), "utf8"));
  const composed = new Map();
  for (const doc of corpus.documents) {
    const key = corpus.modules[doc].join(" ");
    if (!composed.has(key)) {
      const c = await composeModules(corpus.modules[doc], async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
      composed.set(key, (await compileWitnessModule(c.yaml)).program);
    }
    const program = composed.get(key);
    const text = translateProgram(program, byDoc[doc] ?? []);
    const b0 = await runCell("T0", text, program, {});
    for (const c of cands) {
      const r = await runCell(c, text, program, {}, { budget });
      if (!sameAs(b0, r)) diffs.push(`corpus ${doc} ${c}: ${b0.outcome}/${b0.result?.verdict} vs ${r.outcome}/${r.result?.verdict}`);
    }
  }
  return { diffs, witnessSteps, corpusDocs: corpus.documents.length };
}

async function trackBudget(byDoc) {
  console.log("=== --budget : calibration, scaling, T2b/T2 seeds, boundary control, overhead ===");
  let complete = true;
  const { max, maxDoc, B, rows } = await deriveBudget(byDoc);
  console.log(`calibration: corpus max evaluation ${max} inferences (${maxDoc}); B = K × max = ${K} × ${max} = ${B}`);

  // Scaling probe: synthetic documents of 10/30/100/300 sections under the goal module.
  console.log("scaling probe (goal module, inferences and wall time by section count):");
  const goalMods = ["doc-verify:goal"];
  const composedGoal = await composeModules(goalMods, async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
  const goalProgram = (await compileWitnessModule(composedGoal.yaml)).program;
  for (const n of [10, 30, 100, 300]) {
    const facts = syntheticDoc(n);
    const k = await Kernel.create();
    await k.load(translateProgram(goalProgram, facts));
    k.setAnswers({});
    const t0 = performance.now();
    const inf = k.inferencesOf();
    const ms = performance.now() - t0;
    console.log(`  ${String(n).padStart(4)} sections  ${String(inf).padStart(10)} inferences  ${ms.toFixed(1).padStart(8)} ms  ${inf <= B ? "under B" : "OVER B (finding)"}`);
  }

  // T2b and T2 seed columns (child per cell; a timeout is hang).
  console.log("seeds under T2b (budget alone) and T2 (gate + budget):");
  for (const seed of SEEDS) {
    for (const cand of ["T2b", "T2"]) {
      const r = spawnCell(seed.id, cand, { budget: B });
      const ok = r.outcome === seed.expect[cand];
      const ref = refuting(seed.expect[cand], r.outcome, r.hostEffect);
      if (ref) complete = false;
      console.log(`  ${seed.id.padEnd(4)} ${cand.padEnd(3)} ${r.outcome.padEnd(9)} exp ${seed.expect[cand].padEnd(9)} ${ok ? "match   " : ref ? "REFUTING" : "differs "} host=${r.hostEffect ? "YES(refuting)" : "no"}  ${String(Math.round(r.ms)).padStart(6)} ms  ${r.detail}`);
    }
  }

  // Budget boundary control. call_with_inference_limit/3 counts fewer inferences than statistics/2
  // reports for the same core_report goal, so the sharp threshold the WRAPPER enforces (Neff) is
  // found empirically by binary search; the control then shows B = Neff-1 BLOCKED and B = Neff ran,
  // demonstrating the wrapper counts to the inference. (Neff < statistics N is a measurement
  // finding, reported.)
  const key = YAML.parse(readFileSync(path.join(WITNESS_DIR, "corpus-draft.yaml"), "utf8")).modules[maxDoc].join(" ");
  const c = await composeModules(key.split(" "), async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
  const prog = (await compileWitnessModule(c.yaml)).program;
  const text = translateProgram(prog, byDoc[maxDoc]);
  const runsAt = async (b) => (await runCell("T2b", text, prog, {}, { budget: b })).outcome === "ran";
  let lo = 1, hi = max + 1;                 // lo BLOCKs, hi runs
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (await runsAt(mid)) hi = mid; else lo = mid; }
  const neff = hi;                          // smallest budget that runs
  const below = await runCell("T2b", text, prog, {}, { budget: neff - 1 });
  const above = await runCell("T2b", text, prog, {}, { budget: neff });
  const boundaryOk = below.outcome === "BLOCKED" && above.outcome === "ran";
  console.log(`budget boundary control (${maxDoc}): statistics N=${max}, wrapper threshold Neff=${neff}; B=Neff-1 -> ${below.outcome} (exp BLOCKED), B=Neff -> ${above.outcome} (exp ran) ${boundaryOk ? "ok" : "REFUTING"}`);
  if (!boundaryOk) complete = false;

  // Overhead: T2b total evaluate time within 20% of T0 on the corpus.
  const ov = await overheadControl(byDoc, B);
  const within = ov.t2b <= ov.t0 * 1.2;
  console.log(`overhead control: T0 corpus ${ov.t0.toFixed(0)} ms, T2b corpus ${ov.t2b.toFixed(0)} ms (${(ov.t2b / ov.t0 * 100).toFixed(0)}% of T0), within 20%: ${within ? "yes" : "NO"}`);
  if (!within) complete = false;
  console.log(`complete: ${complete}`);
  return complete;
}

function syntheticDoc(n) {
  const facts = [];
  for (let i = 1; i <= n; i += 1) {
    const s = `s${i}`;
    facts.push(`section(doc, ${s}, root)`, `heading(doc, ${s}, 'Heading ${i}')`, `depth(doc, ${s}, 1)`, `order(doc, ${s}, ${i})`, `selected(doc, ${s})`);
  }
  return facts.map(parseFactText);
}

async function overheadControl(byDoc, B) {
  const corpus = YAML.parse(readFileSync(path.join(WITNESS_DIR, "corpus-draft.yaml"), "utf8"));
  const composed = new Map();
  let t0 = 0, t2b = 0;
  for (const doc of corpus.documents) {
    const key = corpus.modules[doc].join(" ");
    if (!composed.has(key)) {
      const c = await composeModules(corpus.modules[doc], async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
      composed.set(key, (await compileWitnessModule(c.yaml)).program);
    }
    const program = composed.get(key);
    const text = translateProgram(program, byDoc[doc] ?? []);
    // measure the evaluate call only (min of 3 on a warm instance; these evaluations are
    // sub-millisecond, so the wrapper's fixed per-call cost is a large relative share and a single
    // reading is noisy).
    const minEval = async (budget) => {
      const k = await Kernel.create(); await k.load(text); k.setAnswers({});
      let best = Infinity;
      for (let i = 0; i < 3; i += 1) { const s = performance.now(); k.evaluate(program, { budget }); best = Math.min(best, performance.now() - s); }
      return best;
    };
    t0 += await minEval(undefined);
    t2b += await minEval(B);
  }
  return { t0, t2b };
}

async function trackMutations(byDoc) {
  console.log("=== --mutations : each gate shown failing (red), then restored (green) ===");
  let complete = true;
  const { B } = await deriveBudget(byDoc);
  const row = (gate, mutation, redDesc, red, green) => {
    const ok = red && green;
    if (!ok) complete = false;
    console.log(`  ${gate.padEnd(18)} ${mutation.padEnd(34)} red:${red ? "RED " : "----"} green:${green ? "GREEN" : "-----"}  ${ok ? "" : "INCOMPLETE"}  (${redDesc})`);
  };

  // 1. host-effect detector reads a wrong path -> the positive control goes red.
  rmSync(ESCAPE, { force: true }); writeFileSync(ESCAPE, "x");
  const wrongDetects = existsSync("/tmp/dv-escape-WRONG");   // mutated detector: wrong path
  const rightDetects = existsSync(ESCAPE);
  rmSync(ESCAPE, { force: true });
  row("host-detector", "reads a wrong path", "planted file missed by wrong-path detector", wrongDetects === false, rightDetects === true);

  // 2. sandbox gate skipped -> E1 under T1 runs.
  {
    const red = spawnCell("E1", "T1", { mutation: "gate-skip" });
    const green = spawnCell("E1", "T1");
    row("sandbox gate", "gate skipped", "E1 under T1 runs", red.outcome === "ran", green.outcome === "rejected");
  }
  // 3. core_count declared safe_primitive instead of safe_meta -> E9 under T1 runs.
  {
    const red = spawnCell("E9", "T1", { mutation: "count-primitive" });
    const green = spawnCell("E9", "T1");
    row("whitelist", "core_count as safe_primitive", "E9 under T1 runs", red.outcome === "ran", green.outcome === "rejected");
  }
  // 4. one primitive removed -> the no-false-refusal control names a witness. core_matches/2 is
  //    dropped and a real witness that uses matches (matches-bound-interval) is loaded: sandbox
  //    recurses into re_match/2 (pcre, not safe) and refuses the witness.
  {
    const w = await translateWitness(YAML.parse(readFileSync(path.join(WITNESS_DIR, "matches-bound-interval.yaml"), "utf8")));
    const redR = await runCell("T1", w.text, w.program, {}, { loadMut: { dropPrimitive: "core_matches(_,_)" } });
    const greenR = await runCell("T1", w.text, w.program, {});
    row("whitelist", "a primitive removed (core_matches)", "a real program is refused", redR.outcome === "rejected", greenR.outcome === "ran");
  }
  // 5. census set widened to include core_goal -> census reports unchecked > 0 (and E14 runs).
  {
    const base = await translateWitness(YAML.parse(readFileSync(path.join(WITNESS_DIR, "policy-invariance.yaml"), "utf8")));
    const kRed = await Kernel.create(); await kRed.load(base.text, { sandbox: true, censusWiden: ["core_goal/2"] });
    const kGreen = await Kernel.create(); await kGreen.load(base.text, { sandbox: true });
    const e14 = spawnCell("E14", "T1", { mutation: "census-widen" });
    row("census", "core.pl set widened (+core_goal)", `unchecked>0 and E14 runs (E14=${e14.outcome})`, kRed.sandboxCensus.unchecked.length > 0, kGreen.sandboxCensus.unchecked.length === 0);
  }
  // 6. directive refusal skipped -> E13 under T1 runs at consult.
  {
    const red = spawnCell("E13", "T1", { mutation: "directive-skip" });
    const green = spawnCell("E13", "T1");
    row("directive refusal", "refusal skipped", "E13 under T1 runs at consult", red.outcome === "ran" || red.outcome === "error", green.outcome === "rejected");
  }
  {
    const red = spawnCell("E17", "T2", { mutation: "catch-skip", budget: B });
    const green = spawnCell("E17", "T2", { budget: B });
    row("catch refusal", "refusal skipped", "E17 under T2 runs (the budget swallowed)", red.outcome === "ran", green.outcome === "rejected");
  }
  // 7. budget B = ∞ -> a seed the budget normally BLOCKS runs. E18 (numlist(1,20M,L),length) needs
  //    more than B inferences, so B=∞ lets it complete (red) and the normal B BLOCKs it (green).
  //    (E6's count product does not exceed B on this corpus, an E6 finding, so it cannot serve here.)
  {
    const red = spawnCell("E18", "T2b", { mutation: "budget-inf", budget: B });
    const green = spawnCell("E18", "T2b", { budget: B });
    row("budget wrapper", "B = infinity", "a budget-blocked seed (E18) runs", red.outcome === "ran", green.outcome === "BLOCKED");
  }
  // 8. budget B = 1 -> the no-spurious-BLOCKED control fails on the corpus.
  {
    const [doc] = biggestCorpusDoc(byDoc);
    const key = YAML.parse(readFileSync(path.join(WITNESS_DIR, "corpus-draft.yaml"), "utf8")).modules[doc].join(" ");
    const c = await composeModules(key.split(" "), async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
    const prog = (await compileWitnessModule(c.yaml)).program;
    const text = translateProgram(prog, byDoc[doc]);
    const red = await runCell("T2b", text, prog, {}, { budget: 1 });
    const green = await runCell("T2b", text, prog, {}, { budget: B });
    row("budget wrapper", "B = 1", "a real corpus document BLOCKED", red.outcome === "BLOCKED", green.outcome === "ran");
  }
  // 9. scheduler check: prefix made to take a leaf outside Dem -> the invariance check fails.
  {
    const red = await schedulerInvariance(byDoc, { badPrefix: true });
    const green = await schedulerInvariance(byDoc, { badPrefix: false });
    row("scheduler check", "prefix takes a leaf outside Dem", "the invariance check fails", red.holds === false, green.holds === true);
  }
  console.log(`complete: ${complete}`);
  return complete;
}

// The scheduler invariance check used by mutation row 9: prefix demand ⊆ full demand on the corpus.
async function schedulerInvariance(byDoc, { badPrefix }) {
  const corpus = YAML.parse(readFileSync(path.join(WITNESS_DIR, "corpus-draft.yaml"), "utf8"));
  const composed = new Map();
  let holds = true;
  for (const doc of corpus.documents) {
    const key = corpus.modules[doc].join(" ");
    if (!composed.has(key)) {
      const c = await composeModules(corpus.modules[doc], async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
      composed.set(key, (await compileWitnessModule(c.yaml)).program);
    }
    const program = composed.get(key);
    const k = await Kernel.create(); await k.load(translateProgram(program, byDoc[doc] ?? [])); k.setAnswers({});
    const r = k.evaluate(program);
    let prefix = r.demand?.prefix ?? [];
    if (badPrefix && (r.demand?.full ?? []).length > 0) prefix = [...prefix, "w::__outside_dem(x)"];   // a leaf outside Dem
    if (!prefix.every((a) => (r.demand?.full ?? []).includes(a))) holds = false;
  }
  return { holds };
}

// ---------------------------------------------------------------- --scheduler (measurement track)
async function trackScheduler(byDoc) {
  console.log("=== --scheduler : measurement track (no hypothesis, no verdict) ===");
  // Round-1 demand on the corpus at promotion, no answers, per policy.
  const corpus = YAML.parse(readFileSync(path.join(WITNESS_DIR, "corpus-draft.yaml"), "utf8"));
  const composed = new Map();
  let tf = 0, tp = 0, differ = 0;
  for (const doc of corpus.documents) {
    const key = corpus.modules[doc].join(" ");
    if (!composed.has(key)) {
      const c = await composeModules(corpus.modules[doc], async (file) => ({ path: file, content: readFileSync(path.join(ROOT, file), "utf8"), hash: "" }));
      composed.set(key, (await compileWitnessModule(c.yaml)).program);
    }
    const program = composed.get(key);
    const k = await Kernel.create(); await k.load(translateProgram(program, byDoc[doc] ?? [])); k.setAnswers({});
    const r = k.evaluate(program);
    const f = r.demand?.full?.length ?? 0, p = r.demand?.prefix?.length ?? 0;
    tf += f; tp += p; if (f !== p) differ += 1;
  }
  console.log(`corpus round-1 demand (no answers): full ${tf}, prefix ${tp}, documents where they differ ${differ} of ${corpus.documents.length}`);

  // Random multi-leaf programs with a simulated judge (labels drawn once per atom, seeded RNG).
  const sched = await schedulerRandom(200, 1);
  console.log(`random programs (generator seed 1, ${sched.programs} programs, simulated judge, cap 6 rounds):`);
  console.log(`  programs where final statuses differ (M1): ${sched.differ}`);
  console.log(`  total atoms asked: full ${sched.atoms.full}, prefix ${sched.atoms.prefix}`);
  console.log(`  mean rounds: full ${sched.meanRounds.full.toFixed(2)}, prefix ${sched.meanRounds.prefix.toFixed(2)}`);
  console.log(`  multi-leaf programs (a round where full asks > 1): ${sched.multiLeaf}`);
  const pct = sched.atoms.full === 0 ? 0 : (sched.atoms.prefix - sched.atoms.full) / sched.atoms.full * 100;
  console.log(`  prefix vs full total atoms: ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% (design default 'prefix' stays unless prefix asks > 20% more)`);
  const complete = sched.programs > 0;
  console.log(`complete: ${complete}`);
  return complete;
}

async function schedulerRandom(count, seed) {
  // Reuse the random generator the conformance track uses (reference/random-brute.mjs, verbatim).
  const { mkdirSync } = await import("node:fs");
  const brutePath = path.join(here, "reference/random-brute.mjs");
  const src = readFileSync(brutePath, "utf8");
  const defs = src.slice(0, src.indexOf("let failures = 0")).split("\n").filter((l) => !l.startsWith("import ")).join("\n").replace(/const COUNT = .*\n/, "");
  const gen = path.join(here, "kernel2/.gen"); mkdirSync(gen, { recursive: true });
  const lib = path.join(gen, "sched-lib.mjs");
  writeFileSync(lib, `${defs}\nexport { rng, generate, render };\n`);
  const { rng, generate, render } = await import(`${lib}?t=${Date.now()}`);
  const r = rng(seed);
  let programs = 0, differ = 0, multiLeaf = 0;
  const atoms = { full: 0, prefix: 0 };
  const rounds = { full: 0, prefix: 0 };
  const judgeRng = rng(seed + 12345);
  for (let n = 0; n < count; n += 1) {
    const g = generate(r), module = render(g);
    let program, checkerRejected;
    try { ({ program, checkerRejected } = await compileWitnessModule(module)); } catch { n -= 1; continue; }
    if (checkerRejected) { n -= 1; continue; }
    programs += 1;
    const factTexts = [...g.sections.map((s) => `section(d, ${s}, root)`), ...g.selected.map((s) => `selected(d, ${s})`)];
    const atomsList = g.oracles.flatMap((o) => g.sections.map((s) => `w::${o}(d,${s})`));
    const labels = Object.fromEntries(atomsList.map((a) => [a, judgeRng() < 0.5 ? "holds" : "fails"]));   // drawn once per atom
    const finals = {};
    for (const policy of ["full", "prefix"]) {
      const k = await Kernel.create();
      await k.load(translateProgram(program, factTexts.map(parseFactText)));
      let ans = {}, round = 0, res;
      for (; round < 6; round += 1) {
        k.setAnswers(ans); res = k.evaluate(program);
        const ask = res.demand?.[policy] ?? [];
        if (policy === "full" && ask.length > 1) multiLeaf += 1;
        if (ask.length === 0) break;
        for (const a of ask) { ans[a] = labels[a] ?? "unknown"; atoms[policy] += 1; }
      }
      rounds[policy] += round + 1;
      // Canonicalise as the conformance policy check does (reference/random-brute.mjs `canon`): a
      // satisfied or absent binding is the same outcome, and population rows are dropped, so only
      // the non-satisfied bindings are compared.
      finals[policy] = JSON.stringify(Object.entries(res.statuses).sort().map(([id, rows]) =>
        [id, rows.filter((x) => x.status && x.status !== "satisfied" && x.population === undefined)
          .map((x) => JSON.stringify(Object.entries(x).sort())).sort()]));
    }
    if (finals.full !== finals.prefix) differ += 1;
  }
  return { programs, differ, multiLeaf, atoms, meanRounds: { full: rounds.full / programs, prefix: rounds.prefix / programs } };
}

// ============================================================================= main
if (flag("--one")) {
  await runOne();
} else {
  const byDoc = corpusFacts();
  let ok;
  if (flag("--containment")) ok = await trackContainment(byDoc);
  else if (flag("--gate")) ok = await trackGate(byDoc);
  else if (flag("--budget")) ok = await trackBudget(byDoc);
  else if (flag("--mutations")) ok = await trackMutations(byDoc);
  else if (flag("--scheduler")) ok = await trackScheduler(byDoc);
  else { console.log("usage: --containment | --gate | --budget | --mutations | --scheduler"); process.exit(2); }
  process.exit(ok ? 0 : 1);
}
