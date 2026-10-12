// Round 1 probe runner: SWI-Prolog WFS as a verification kernel, under swipl-wasm in Node.
// Usage: node worklog/kernel-trials/probe/run-probes.mjs
// Prints one `K<n> complete: true|false` line per condition plus evidence; exits 1 if any fails.
//
// Loading mechanism that worked: require("swipl-wasm/dist/swipl-node.js") (CommonJS, via
// createRequire), then swipl.FS.writeFile("/x.pl", text) into the Emscripten FS and
// consult('/x.pl'). One fresh WASM instance per condition so the programs cannot interfere.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const require = createRequire(import.meta.url);
const SWIPL = require("./vendor/node_modules/swipl-wasm/dist/swipl-node.js");
const pl = (f) => readFileSync(path.join(here, "prolog", f), "utf8");
const ms = (t) => `${t.toFixed(1)} ms`;

async function instance() {
  const t0 = performance.now();
  const swipl = await SWIPL({ arguments: ["-q"] });
  const startup = performance.now() - t0;
  console.log(`  (instance startup ${ms(startup)})`);
  return { swipl, startup };
}
function load(swipl, name, text) {
  swipl.FS.writeFile(`/${name}`, text);
  const t0 = performance.now();
  const r = swipl.prolog.query(`consult('/${name}')`).once();
  if (!r || r.success === false || r.$tag === "error") throw new Error(`consult ${name} failed: ${JSON.stringify(r)}`);
  return performance.now() - t0;
}
// q(goal-with-variable-R) -> the ~q-printed value of R, "<false>" on failure, "<error ...>" on exception.
function q(swipl, goal) {
  try {
    const r = swipl.prolog.query(`(${goal}) -> format(atom(Out), '~q', [R]) ; Out = '<false>'`).once();
    if (r && r.Out !== undefined) return String(r.Out);
    return `<error ${JSON.stringify(r)}>`;
  } catch (e) { return `<error ${e}>`; }
}
const run = (swipl, goal) => q(swipl, `(${goal}), R = ok`);
const results = {};
const tProcess = performance.now();
function check(k, label, ok, observed) {
  console.log(`  [${ok ? "ok" : "FAIL"}] ${label}: ${observed}`);
  (results[k] ??= []).push(ok);
}

// ---------------------------------------------------------------- K1
{
  console.log("== K1 undefined + delays (k1-delays.pl)");
  const { swipl } = await instance();
  load(swipl, "k1.pl", pl("k1-delays.pl"));
  const reset = () => run(swipl, "retractall(answered(_,_)), abolish_all_tables");
  console.log("  encoding of an unanswered atom:", q(swipl, "with_output_to(string(R), (listing(u/1), listing(oracle/1)))").replace(/\\n/g, " ").replace(/\s+/g, " "));

  reset();
  const tvOk = q(swipl, "tv(ok(a), R)");
  check("K1", "no answers: ok(a)", tvOk === "undefined", tvOk);
  const tvV = q(swipl, "tv(violated(c1), R)");
  check("K1", "no answers: violated(c1)", tvV === "undefined", tvV);
  const cdOk = q(swipl, "call_delays(ok(a), R)");
  const cdV = q(swipl, "call_delays(violated(c1), R)");
  console.log(`  call_delays(ok(a), D):          D = ${cdOk}`);
  console.log(`  call_delays(violated(c1), D):   D = ${cdV}`);
  console.log(`  call_residual_program(violated(c1), P): P = ${q(swipl, "call_residual_program(violated(c1), R)")}`);
  // Informational (the amendment moved the demand set to the residual-program walk): does
  // call_delays/2 alone name the oracle atom for the negated, tabled form?
  console.log(`  [info] call_delays(violated(c1)) names o1(a) directly: ${/o1\(a\)/.test(cdV)}`);
  const fullV = q(swipl, "demand(violated(c1), full, R)");
  const preV = q(swipl, "demand(violated(c1), prefix, R)");
  console.log(`  demand walk (full residual leaves) violated(c1): ${fullV}`);
  check("K1", "demand walk (prefix) violated(c1) = [o1(a)], excludes o2(a)", preV === "[o1(a)]", preV);
  const preOk = q(swipl, "demand(ok(a), prefix, R)");
  console.log(`  demand walk (full) ok(a): ${q(swipl, "demand(ok(a), full, R)")}`);
  check("K1", "demand walk (prefix) ok(a) = [o1(a)]", preOk === "[o1(a)]", preOk);
  const ok2 = q(swipl, "tv(ok2(a), T), demand(ok2(a), full, S), R = [T, S]");
  console.log(`  naive findall over call_delays(ok2(a), D): ${q(swipl, "findall(D, call_delays(ok2(a), D), R)")}`);
  check("K1", "disjunct already true: ok2(a) true, demands nothing", ok2 === "[true,[]]", ok2);
  console.log(`  u/1 subgoals tabled so far: ${q(swipl, "tabled_leaves(R)")}`);

  reset(); run(swipl, "assertz(answered(o1(a), holds))");
  const h1 = q(swipl, "tv(ok(a), T), demand(ok(a), prefix, S), R = T-S");
  check("K1", "o1(a) holds: ok(a) still undefined, demand moves to [o2(a)]", h1 === "undefined-[o2(a)]", h1);
  run(swipl, "abolish_all_tables, assertz(answered(o2(a), holds))");
  const h2 = q(swipl, "call_delays(ok(a), D), tv(violated(c1), V), R = D-V");
  check("K1", "o1,o2 hold: call_delays(ok(a),D) D == true; violated(c1) false", h2 === "true-false", h2);

  reset(); run(swipl, "assertz(answered(o1(a), fails))");
  const f1 = q(swipl, "tv(ok(a), T), call_delays(violated(c1), D), R = T-D");
  check("K1", "o1(a) fails: ok(a) false; violated(c1) true with D == true", f1 === "false-true", f1);

  reset(); run(swipl, "assertz(answered(o1(a), unknown))");
  const u1 = q(swipl, "tv(ok(a), T), demand(ok(a), prefix, S), R = T-S");
  check("K1", "o1(a) unknown: ok(a) undefined, still demands o1(a)", u1 === "undefined-[o1(a)]", u1);

  reset();
  const c0 = q(swipl, "tv(is_x(a), X), tv(not_y(a), Y), demand(is_x(a), full, DX), demand(not_y(a), full, DY), R = [X, Y, DX, DY]");
  check("K1", "choose unanswered: is_x(a), not_y(a) undefined; demand label x / label y", c0 === "[undefined,undefined,[label(k(a),x)],[label(k(a),y)]]", c0);
  reset(); run(swipl, "assertz(answered(k(a), x))");
  const c1 = q(swipl, "tv(is_x(a), X), tv(not_y(a), Y), R = [X, Y]");
  check("K1", "choose answered x: is_x(a) true, not_y(a) true", c1 === "[true,true]", c1);
  reset(); run(swipl, "assertz(answered(k(a), y))");
  const c2 = q(swipl, "tv(is_x(a), X), tv(not_y(a), Y), R = [X, Y]");
  check("K1", "choose answered y: is_x(a) false, not_y(a) false", c2 === "[false,false]", c2);

  reset();
  console.log(`  (d) tnot(ok_t(_)) non-ground, conditional answers exist: ${q(swipl, "nonground(ok_t(_), R)")}`);
  console.log(`  (d) tnot(has_fact(_)) non-ground, fact(a) exists:         ${q(swipl, "nonground(has_fact(_), R)")}`);
  console.log(`  K1 complete: ${results.K1.every(Boolean)}`);
}

// ---------------------------------------------------------------- K2
{
  console.log("== K2 incremental tabling (k2-incremental.pl)");
  const { swipl } = await instance();
  load(swipl, "k2.pl", pl("k2-incremental.pl"));
  const tvs = (s) => q(swipl, `tv(ok_${s}(a), A), tv(violated_${s}(c1), V), rtv(ok_${s}(a), RA), R = [A, V, RA]`);
  const i0 = tvs("i"), s0 = tvs("s"), t0 = tvs("t");
  const ib0 = q(swipl, "tv(ok_i(b), A), tv(violated_i(c2), V), R = [A, V]");
  check("K2", "round 1 (incremental): ok_i(a), violated_i(c1) undefined", i0 === "[undefined,undefined,undefined]", i0);
  check("K2", "round 1 (incremental): ok_i(b), violated_i(c2) undefined", ib0 === "[undefined,undefined]", ib0);
  console.log(`  round 1 control (plain tables): ${s0}`);
  run(swipl, "assertz(answered_i(o(a), holds)), assertz(answered_i(o(b), fails)), assertz(answered_s(o(a), holds)), assertz(answered_t(o(a), holds))");
  const T = performance.now();
  const i1 = tvs("i");
  const ib1 = q(swipl, "tv(ok_i(b), A), tv(violated_i(c2), V), R = [A, V]");
  const reeval = performance.now() - T;
  check("K2", "after assertz, no abolish: ok_i(a) undefined->true, violated_i(c1) ->false", i1 === "[true,false,true]", i1);
  check("K2", "after assertz, no abolish: ok_i(b) undefined->false, violated_i(c2) ->true", ib1 === "[false,true]", ib1);
  const s1 = tvs("s");
  check("K2", "negative control (no incremental): stale tables persist (still undefined)", s1 === "[undefined,undefined,undefined]", s1);
  const s2 = q(swipl, "abolish_all_tables, tv(ok_s(a), A), R = A");
  console.log(`  negative control after abolish_all_tables: ok_s(a) = ${s2}`);
  const t1 = tvs("t");
  console.log(`  variant with tabled oracle wrapper [tv(ok), tv(violated), rtv(ok)], same instance: before ${t0}, after ${t1}`);
  console.log(`  re-query time after assertz (incremental re-evaluation): ${ms(reeval)}`);
  // The tabled-oracle variant in a fresh instance, touching only *_t (the isolated sequence).
  const { swipl: s2w } = await instance();
  load(s2w, "k2.pl", pl("k2-incremental.pl"));
  const tA = q(s2w, "tv(ok_t(a), A), R = A");
  run(s2w, "assertz(answered_t(o(a), holds))");
  const tB = q(s2w, "call_delays(ok_t(a), D), call_residual_program(ok_t(a), P), tv(violated_t(c1), V), R = [D, P, V]");
  console.log(`  [info] tabled-oracle variant isolated: before tv(ok_t(a)) = ${tA}; after assertz [call_delays D, residual program, tv(violated_t(c1))] = ${tB}`);
  console.log(`  K2 complete: ${results.K2.every(Boolean)}`);
}

// ---------------------------------------------------------------- K3
{
  console.log("== K3 proof tree and missing literal (k3-proof.pl)");
  const { swipl } = await instance();
  load(swipl, "k3.pl", pl("k3-proof.pl"));
  const rows = [
    ["artifact-has-goal", "d1", /^node\(goal_section\(d1,goal\),\[node\(top\(d1,goal\),\[fact\(section\(d1,goal,root\)\),fact\(depth\(d1,goal,2\)\)\]\),fact\(heading\(d1,goal,'Goal'\)\)\]\)$/],
    ["artifact-has-goal", "d2", /^missing\(goal_section\(d2,_\w*\)\)$/],
    ["goal-has-purpose", "d1", /oracle\(purpose\(d1,goal\),goal\)\]\)$/],
    ["goal-has-purpose", "d2", /^missing\(heading\(d2,intro,'Goal'\)\)$/],
    ["goal-has-purpose", "d3", /^missing\(purpose\(d3,goal,goal\)\)$/],
  ];
  for (const [c, d, re] of rows) {
    const r = q(swipl, `check('${c}', ${d}, R)`);
    check("K3", `${c} ${d}`, re.test(r), r);
  }
  console.log(`  K3 complete: ${results.K3.every(Boolean)}`);
}

// ---------------------------------------------------------------- K4
{
  console.log("== K4 corpus scale (corpus-facts.pl + k4-corpus-rules.pl)");
  const { swipl, startup } = await instance();
  console.log(`  version: ${q(swipl, "current_prolog_flag(version, R)")}  (${q(swipl, "current_prolog_flag(version_git, R)")})`);
  console.log(`  flags: ${q(swipl, "findall(F=V, (current_prolog_flag(F, V), sub_atom(F, _, _, _, Sub), memberchk(Sub, [table, tabl, incr, wfs, answer, subgoal, unknown])), L0), sort(L0, R)")}`);
  const facts = pl("corpus-facts.pl");
  const tFacts = load(swipl, "corpus-facts.pl", facts);
  const tRules = load(swipl, "k4-corpus-rules.pl", pl("k4-corpus-rules.pl"));
  console.log(`  facts: ${q(swipl, "aggregate_all(count, (member(P, [section/3, heading/3, depth/3, order/3, meta/3, selected/2, child/3, descendant/3, nests/3, ref/4, resolves/2, dangling/4]), P = N/A, functor(G, N, A), call(G)), R)")} clauses, documents: ${q(swipl, "aggregate_all(count, meta(_, kind, _), R)")}`);
  let t = performance.now();
  const all = q(swipl, "evaluate_all(all, R)");
  const tEvalCold = performance.now() - t;
  t = performance.now();
  const design = q(swipl, "evaluate_all(design, R)");
  const tEvalWarm = performance.now() - t;
  t = performance.now();
  run(swipl, "abolish_all_tables, evaluate_all(all, _)");
  const tRound = performance.now() - t;
  const fmt = (s) => s.replace(/^\[|\]$/g, "").split(/,(?=')/).map((x) => `    ${x}`).join("\n");
  console.log("  per constraint, scope all documents (name-profile-counts(satisfied,violated,undefined)):\n" + fmt(all));
  console.log("  per constraint, scope = documents governed by these modules (kind design):\n" + fmt(design));
  console.log(`  violated bindings (design scope): ${q(swipl, "findall(N-F, violation(design, N, F), R)")}`);
  const total = startup + tFacts + tRules + tEvalCold;
  console.log(`  startup ${ms(startup)}; consult facts ${ms(tFacts)}; consult rules ${ms(tRules)}; evaluate all constraints (cold tables) ${ms(tEvalCold)}; second pass, design scope (warm) ${ms(tEvalWarm)}; abolish_all_tables + full re-evaluation ${ms(tRound)}; total ${ms(total)}`);
  check("K4", "evaluation < 1000 ms", tEvalCold < 1000, ms(tEvalCold));
  check("K4", "total (startup + consult + evaluation) < 2000 ms", total < 2000, ms(total));
  check("K4", "promotion constraints come back undefined (no oracle answers)", /'design-problem-resolved'-promotion-counts\(0,0,4\)/.test(all) && /'design-verification-falsifies'-promotion-counts\(0,0,3\)/.test(all), "see rows above");
  console.log(`  degraded-pass path (re-evaluation per round < 500 ms): ${ms(tRound)}`);
  console.log(`  K4 complete: ${results.K4.every(Boolean)}`);
}

console.log(`== process wall time ${ms(performance.now() - tProcess)} (the first instance pays the WASM compile; later instances reuse it)`);
console.log("== summary");
for (const k of ["K1", "K2", "K3", "K4"]) console.log(`${k} complete: ${results[k].every(Boolean)}`);
process.exit(Object.values(results).every((r) => r.every(Boolean)) ? 0 : 1);
