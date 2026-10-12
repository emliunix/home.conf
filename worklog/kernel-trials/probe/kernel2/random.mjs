// random.mjs - `run-conformance.mjs --random N`: witness class C4 (brute force) for S1.
// reference/random-brute.mjs is a script with no exports. Its generator, renderer, two-valued
// evaluator and completion enumerator are reused VERBATIM: the text before its main loop
// (`let failures = 0`) is copied, its imports dropped, and the definitions exported from a
// generated module under kernel2/.gen/ (the source file is not edited). The checks below are the
// same as random-brute.mjs's, with S1 in place of the reference evaluator.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { compileWitnessModule, translateProgram, parseFactText } from "./translate.mjs";
import { Kernel } from "./kernel.mjs";

export async function runRandom(brutePath, count, { countMode, seed = 1 }) {
  const src = readFileSync(brutePath, "utf8");
  const defs = src.slice(0, src.indexOf("let failures = 0"))
    .split("\n").filter((l) => !l.startsWith("import ")).join("\n")
    .replace(/const COUNT = .*\n/, "");
  const gen = path.join(import.meta.dirname, ".gen");
  mkdirSync(gen, { recursive: true });
  const lib = path.join(gen, "brute-lib.mjs");
  writeFileSync(lib, `// GENERATED from reference/random-brute.mjs by kernel2/random.mjs; do not edit.\n${defs}\nexport { rng, generate, render, twoValued, canon, completions };\n`);
  const { rng, generate, render, twoValued, canon, completions } = await import(`${lib}?t=${Date.now()}`);

  const r = rng(seed);
  let failures = 0, programs = 0, conservative = 0, d1Weak = 0, first;
  const t0 = performance.now();
  for (let n = 0; n < count; n += 1) {
    const g = generate(r), module = render(g);
    let program, checkerRejected;
    try { ({ program, checkerRejected } = await compileWitnessModule(module)); } catch { n -= 1; continue; }
    if (checkerRejected) { n -= 1; continue; } // as random-brute.mjs: regenerate what the checker refuses
    programs += 1;
    const factTexts = [...g.sections.map((s) => `section(d, ${s}, root)`), ...g.selected.map((s) => `selected(d, ${s})`)];
    const kernel = await Kernel.create();
    kernel.load(translateProgram(program, factTexts.map(parseFactText)), { countMode });
    const atoms = g.oracles.flatMap((o) => g.sections.map((s) => `w::${o}(d,${s})`));
    const ans = Object.fromEntries(atoms.flatMap((a) => { const x = r(); return x < 0.5 ? [] : [[a, x < 0.55 ? "unknown" : x < 0.78 ? "holds" : "fails"]]; }));
    const ref = (a) => { kernel.setAnswers(a); return kernel.evaluate(program); };
    const problems = [], here = ref(ans), all = completions(atoms, ans).map((c) => twoValued(g, c));
    const rowsOf = (res, c) => res.statuses[c.id];
    for (const c of g.constraints) for (const row of rowsOf(here, c)) {
      const inAll = (pred) => all.every((x) => pred(x.statuses[c.id]));
      if (row.population === "empty" && !inAll((rows) => rows.some((x) => x.population === "empty"))) problems.push(`sound: ${c.id} empty population not empty in some completion`);
      if (!row.S) continue;
      const at = (rows) => rows.find((x) => x.S === row.S);
      if (row.status === "satisfied" && !inAll((rows) => !at(rows) || at(rows).status === "satisfied")) problems.push(`sound: ${c.id} ${row.S} satisfied but violated in some completion`);
      if (row.status === "violated" && !inAll((rows) => at(rows)?.status === "violated")) problems.push(`sound: ${c.id} ${row.S} violated but not in every completion`);
      if (row.status === "undetermined" && (inAll((rows) => !at(rows) || at(rows).status === "satisfied") || inAll((rows) => at(rows)?.status === "violated"))) conservative += 1;
    }
    for (const c of g.constraints) for (const x of all) for (const row of x.statuses[c.id]) if (row.S && !rowsOf(here, c).some((y) => y.S === row.S)) problems.push(`cover: ${c.id} ${row.S} is a binding in a completion but not under ans`);
    if (here.verdict !== "NEEDS-REVIEW" && !all.every((x) => x.verdict === here.verdict)) problems.push(`verdict: ${here.verdict} under ans, not in every completion`);
    const total = completions(atoms, ans)[Math.floor(r() * all.length)], atTotal = ref(total), two = twoValued(g, total);
    const canonS1 = (st) => canon(Object.fromEntries(Object.entries(st).map(([k, rows]) => [k, rows.filter((x) => x.population !== "undetermined")])));
    if (canonS1(atTotal.statuses) !== canon(two.statuses) || atTotal.verdict !== two.verdict || atTotal.demand.full.length) problems.push(`M2: total ans ${JSON.stringify(total)} gives ${canonS1(atTotal.statuses)} ${atTotal.verdict}, two-valued ${canon(two.statuses)} ${two.verdict}`);
    const mid = Object.fromEntries(Object.entries(total).filter(([a]) => ans[a] !== undefined && ans[a] !== "unknown" || r() < 0.5)), atMid = ref(mid);
    for (const c of g.constraints) for (const row of rowsOf(here, c)) if (row.status !== "undetermined" && !(row.status === "satisfied" && !rowsOf(atMid, c).some((y) => y.S === row.S)) && !rowsOf(atMid, c).some((y) => y.S === row.S && y.population === row.population && y.status === row.status)) problems.push(`M1: ${c.id} ${JSON.stringify(row)} changed under ${JSON.stringify(mid)}`);
    const dem = here.demand.full;
    // Re-amended §1/§6: an atom answered `unknown` is asked and never demanded again. Adapted from
    // random-brute.mjs: D2 ranges over UNASKED atoms only; prefix empty while full is not is a
    // counterexample.
    // D1 restricted to RESOLVABLE bindings (re-amended §6): a binding S1 reports as unresolvable
    // (support empty after subtracting asked atoms) or unfounded may stay undetermined.
    const exempt = (res) => new Set(Object.entries({ ...(res.unresolvable ?? {}) }).flatMap(([id, rows]) => rows.map((x) => `${id}/${x.S}`))
      .concat(Object.entries(res.unfounded ?? {}).flatMap(([id, rows]) => rows.map((x) => `${id}/${x.S}`))));
    if (!here.demand.prefix.every((a) => dem.includes(a))) problems.push(`D1: prefix ${here.demand.prefix} not a subset of full ${dem}`);
    if ((dem.length > 0) !== (here.demand.prefix.length > 0)) problems.push(`D1: prefix ${here.demand.prefix} empty while full ${dem} is not`);
    const skip = exempt(here);
    for (const lab of completions(dem, Object.fromEntries(dem.map((a) => [a, undefined])))) {
      const after = ref({ ...ans, ...lab });
      const left = Object.entries(after.statuses).flatMap(([id, rows]) => rows.filter((x) => x.status === "undetermined" && x.S && !skip.has(`${id}/${x.S}`)));
      // D1 as the re-amended text states it (resolvable at `ans` -> decided after Dem) fails when a
      // binding's support mixes demandable and asked-unknown atoms: answering the demandable ones
      // leaves it undetermined and NOW unresolvable. Counted separately (d1Weak) when every
      // remaining binding is unresolvable/unfounded AFTER answering; a counterexample otherwise.
      const after2 = exempt(after);
      if (left.length && left.every(() => true) && Object.entries(after.statuses).flatMap(([id, rows]) => rows.filter((x) => x.status === "undetermined" && x.S && !skip.has(`${id}/${x.S}`) && !after2.has(`${id}/${x.S}`))).length === 0) { d1Weak += 1; break; }
      if (left.length) { problems.push(`D1: answering Dem ${JSON.stringify(lab)} leaves a resolvable binding undetermined`); break; }
    }
    for (const a of atoms.filter((x) => !dem.includes(x) && ans[x] === undefined)) for (const label of ["holds", "fails"]) {
      if (canonS1(ref({ ...ans, [a]: label }).statuses) !== canonS1(here.statuses)) problems.push(`D2: answering ${a}=${label} outside Dem changes a status`);
    }
    const finals = ["full", "prefix"].map((policy) => {
      let state = { ...ans };
      for (let round = 0; round < 20; round += 1) { const d = ref(state).demand[policy]; if (!d.length) break; for (const a of d) state[a] = total[a]; }
      return canonS1(ref(state).statuses);
    });
    if (finals[0] !== finals[1]) problems.push(`policy: full ${finals[0]} prefix ${finals[1]}`);
    else if (!Object.values(ans).includes("unknown") && finals[0] !== canonS1(atTotal.statuses)) problems.push(`policy: rounds end ${finals[0]}, total ${canonS1(atTotal.statuses)}`);
    if (problems.length) { failures += 1; first ??= { n, module, facts: factTexts, ans, problems }; }
  }
  const ms = performance.now() - t0;
  console.log(`random (C4) S1: programs ${programs}, seed ${seed}, counterexamples ${failures}, conservative undetermined ${conservative}, resolvable-at-ans but unresolvable-after-Dem (model D1 gap) ${d1Weak}, ${ms.toFixed(0)} ms`);
  if (first) console.log(`first counterexample (program #${first.n}):\n--- module\n${first.module}--- facts\n${first.facts.join("\n")}\n--- ans\n${JSON.stringify(first.ans)}\n--- problems\n${first.problems.slice(0, 10).join("\n")}`);
  return { S1: failures === 0 ? "pass" : "FAIL", counterexamples: failures, programs, d1Weak };
}
