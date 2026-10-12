// random.mjs - `run-conformance.mjs --s3 --random N`: S3 against brute-force enumeration (round 4b,
// the primary predicate). reference/random-brute.mjs's generator, renderer, two-valued evaluator and
// completion enumerator are reused VERBATIM (the text before its main loop, imports dropped, written
// to a temporary module; the source file is not edited), and its random stream is consumed call for
// call (ans, the total extension, the mid extension), so program #n here is program #n there.
//
// Per program:
//   equal  S3's rows (every binding, satisfied included, and population rows) and S3's
//          status-derived verdict equal enumeration's: over every total extension of `ans`
//          (`unknown` answers free), a binding is satisfied if every completion drops or satisfies it,
//          violated if every completion has it violated, else undetermined; a nonempty population
//          is violated if empty in every completion, undetermined if in some; the verdict is §5 over
//          those statuses (all constraints are `error`, so NO-GO iff a violated row, PASS iff all satisfied).
//   D1     after labelling Dem(S3) in every way, a binding left undetermined must stay undetermined
//          under every labelling of the remaining never-asked atoms (it rests on `unknown` atoms only);
//          the after-states are evaluated by enumeration.
//   D2     fixing one never-asked atom outside Dem(S3), either way, changes no S3 status.
// Also counted: bindings the reference (Kleene, = S1 on this track) leaves undetermined that
// enumeration decides, and how many of them S3 decides the same way.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadProgram, evaluateWitnessStep } from "../reference/reference.mjs";
import { parseFact } from "../reference/terms.mjs";
import { prepareS3Program, rowSig } from "./subject-clingo.mjs";

async function bruteLib(brutePath) {
  const src = readFileSync(brutePath, "utf8");
  const defs = src.slice(0, src.indexOf("let failures = 0")).split("\n").filter((l) => !l.startsWith("import ")).join("\n").replace(/const COUNT = .*\n/, "");
  const file = path.join(mkdtempSync(path.join(tmpdir(), "s3-brute-")), "brute-lib.mjs");
  writeFileSync(file, `// GENERATED from reference/random-brute.mjs by kernel3/random.mjs\n${defs}\nexport { rng, generate, render, twoValued, canon, completions };\n`);
  return import(file);
}

const rowKey = (r) => JSON.stringify(Object.keys(r).filter((k) => k !== "status").sort().map((k) => [k, String(r[k])]));
const fullCanon = (st) => JSON.stringify(Object.keys(st).sort().map((c) => [c, st[c].map((r) => `${rowKey(r)}=${r.status}`).sort()]));

/** Enumeration's statuses and verdict over a list of two-valued results. */
function enumerate(g, all) {
  const statuses = {};
  for (const c of g.constraints) {
    const rows = [];
    for (const s of g.sections) {
      const at = all.map((x) => x.statuses[c.id].find((r) => r.S === s));
      if (at.every((r) => !r)) continue;
      const status = at.every((r) => !r || r.status === "satisfied") ? "satisfied" : at.every((r) => r?.status === "violated") ? "violated" : "undetermined";
      rows.push({ D: "d", S: s, status });
    }
    const empty = all.map((x) => x.statuses[c.id].some((r) => r.population === "empty"));
    if (empty.every(Boolean)) rows.push({ population: "empty", status: "violated" });
    else if (empty.some(Boolean)) rows.push({ population: "undetermined", status: "undetermined" });
    statuses[c.id] = rows;
  }
  const flat = Object.values(statuses).flat();
  const verdict = flat.some((r) => r.status === "violated") ? "NO-GO" : flat.some((r) => r.status === "undetermined") ? "NEEDS-REVIEW" : "PASS";
  return { statuses, verdict };
}

export async function runRandomS3(brutePath, count, { seed = 1, defect, checks = true, log = console.log } = {}) {
  const { rng, generate, render, twoValued, completions } = await bruteLib(brutePath);
  const r = rng(seed);
  let programs = 0, unequal = 0, d1 = 0, d2 = 0, kleeneU = 0, kleeneURefined = 0, demNotSub = 0, solves = 0, steps = 0;
  const firsts = { equal: undefined, D1: undefined, D2: undefined };
  const t0 = performance.now();
  let stepMs = 0;
  for (let n = 0; n < count; n += 1) {
    const g = generate(r), module = render(g);
    const { program, rejected } = await loadProgram(module);
    if (rejected) { n -= 1; continue; }
    programs += 1;
    const facts = [...g.sections.map((s) => parseFact(`section(d, ${s}, root)`)), ...g.selected.map((s) => parseFact(`selected(d, ${s})`))];
    const atoms = g.oracles.flatMap((o) => g.sections.map((s) => `w::${o}(d,${s})`));
    const ans = Object.fromEntries(atoms.flatMap((a) => { const x = r(); return x < 0.5 ? [] : [[a, x < 0.55 ? "unknown" : x < 0.78 ? "holds" : "fails"]]; }));
    const all = completions(atoms, ans).map((c) => twoValued(g, c));
    // consume the stream exactly as random-brute.mjs does (total, mid)
    const total = completions(atoms, ans)[Math.floor(r() * all.length)];
    Object.fromEntries(Object.entries(total).filter(([a]) => ans[a] !== undefined && ans[a] !== "unknown" || r() < 0.5));

    const prepared = await prepareS3Program(program, facts, { defect });
    const t = performance.now();
    const got = prepared.rejected ? { rejected: prepared.rejected } : prepared.step(ans);
    stepMs += performance.now() - t; steps += 1; solves += got.solves ?? 0;
    const exp = enumerate(g, all);
    const problems = [];
    if (got.rejected) problems.push(`rejected: ${got.rejected}`);
    else {
      if (fullCanon(got.statuses) !== fullCanon(exp.statuses)) problems.push(`statuses: enumeration ${fullCanon(exp.statuses)} S3 ${fullCanon(got.statuses)}`);
      if (got.verdict !== exp.verdict) problems.push(`verdict: enumeration ${exp.verdict} S3 ${got.verdict}`);
    }
    if (problems.length) { unequal += 1; firsts.equal ??= { n, module, ans, problems }; }
    if (got.rejected || !checks) continue;

    // Kleene conservatism, and how S3 treats it
    const ref = evaluateWitnessStep(program, facts, new Map(Object.entries(ans)));
    for (const c of g.constraints) for (const row of ref.statuses[c.id]) {
      if (row.status !== "undetermined" || !row.S) continue;
      const e = exp.statuses[c.id].find((x) => x.S === row.S);
      if (!e || e.status !== "undetermined") {
        kleeneU += 1;
        const s = got.statuses[c.id].find((x) => x.S === row.S);
        if ((s?.status ?? "satisfied") === (e?.status ?? "satisfied")) kleeneURefined += 1;
      }
    }
    if (!got.demand.full.every((a) => ref.demand.full.includes(a))) demNotSub += 1;

    // D1
    const dem = got.demand.full;
    const rest = atoms.filter((a) => ans[a] === undefined && !dem.includes(a));
    let d1bad;
    for (const lab of completions(dem, Object.fromEntries(dem.map((a) => [a, undefined])))) {
      const state = { ...ans, ...lab };
      const after = enumerate(g, completions(atoms, state).map((c) => twoValued(g, c)));
      const open = Object.entries(after.statuses).flatMap(([id, rows]) => rows.filter((x) => x.status === "undetermined").map((x) => [id, x]));
      if (!open.length) continue;
      for (const restLab of completions(rest, Object.fromEntries(rest.map((a) => [a, undefined])))) {
        const later = enumerate(g, completions(atoms, { ...state, ...restLab }).map((c) => twoValued(g, c)));
        const decided = open.find(([id, x]) => { const y = later.statuses[id].find((z) => rowKey(z) === rowKey(x)); return !y || y.status !== "undetermined"; });
        if (decided) { d1bad = `labelling Dem ${JSON.stringify(lab)} leaves ${decided[0]} ${rowKey(decided[1])} undetermined, decided by ${JSON.stringify(restLab)}`; break; }
      }
      if (d1bad) break;
    }
    if (d1bad) { d1 += 1; firsts.D1 ??= { n, module, ans, problems: [d1bad] }; }

    // D2
    const sig = rowSig(got.statuses);
    let d2bad;
    for (const a of atoms.filter((x) => ans[x] === undefined && !dem.includes(x))) {
      for (const label of ["holds", "fails"]) {
        const x = prepared.step({ ...ans, [a]: label }, { demand: false });
        solves += x.solves ?? 0;
        if (rowSig(x.statuses) !== sig) { d2bad = `fixing ${a}=${label} outside Dem ${JSON.stringify(dem)} changes a status`; break; }
      }
      if (d2bad) break;
    }
    if (d2bad) { d2 += 1; firsts.D2 ??= { n, module, ans, problems: [d2bad] }; }
  }
  const ms = performance.now() - t0;
  log(`random S3${defect ? ` [defect ${defect}]` : ""}: programs ${programs}, seed ${seed}, unequal to enumeration ${unequal}` +
    (checks ? `, D1 counterexamples ${d1}, D2 counterexamples ${d2}; Kleene-undetermined bindings that enumeration decides ${kleeneU}, of them S3 equal to enumeration ${kleeneURefined}; programs with Dem(S3) not a subset of the reference's full ${demNotSub}` : "") +
    `; S3 base step mean ${(stepMs / Math.max(steps, 1)).toFixed(1)} ms, clingo solves ${solves}, total ${ms.toFixed(0)} ms`);
  for (const [k, f] of Object.entries(firsts)) if (f) log(`first ${k} counterexample (program #${f.n}):\n--- module\n${f.module}--- ans\n${JSON.stringify(f.ans)}\n--- problems\n${f.problems.slice(0, 5).join("\n")}`);
  return { S3: unequal + d1 + d2 === 0 ? "pass" : "FAIL", programs, unequal, d1, d2, complete: programs === count };
}
