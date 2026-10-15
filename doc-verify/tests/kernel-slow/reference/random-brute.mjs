// node reference/random-brute.mjs [count=500] [seed=1]
// Witness class C4: random small stratified programs (2-3 two-label oracles, 2-4 non-recursive
// rules over section/selected facts, optional `not`, 1-2 constraints), checked against brute force
// over EVERY total extension of a random partial `ans`, evaluated by an independent two-valued
// evaluator written here (it shares no code with reference.mjs). Checks, per program:
//   sound    a satisfied/violated binding (and an empty population) holds in every completion (§4);
//   cover    every section whose forall holds in some completion is a binding;
//   verdict  PASS / NO-GO under ans is PASS / NO-GO in every completion (§5, PASS is final);
//   M2       under a total ans: no undetermined row, statuses and verdict equal the two-valued ones;
//   M1       decided rows keep their status under an extension of ans;
//   D1       every labelling of Dem(full) decides every binding; prefix ⊆ full, non-empty with it;
//   D2       labelling any one atom outside Dem changes no status;
//   policy   full and prefix rounds against a fixed judge end in the same statuses.
// Prints the first counterexample program verbatim; exits 1 if any.
import { evaluateWitnessStep, loadProgram } from "./reference.mjs";
import { parseFact } from "./terms.mjs";

const COUNT = Number(process.argv[2] ?? 500), SEED = Number(process.argv[3] ?? 1);
function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function generate(r) {
  const pick = (xs) => xs[Math.floor(r() * xs.length)], int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const sections = int(2, 3) === 2 ? ["a", "b"] : ["a", "b", "c"];
  const oracles = Array.from({ length: sections.length === 3 ? 2 : int(2, 3) }, (_, i) => `o${i + 1}`);
  const selected = sections.filter(() => r() < 0.5);
  const preds = Array.from({ length: int(1, 3) }, (_, i) => `p${i + 1}`);
  const lit = (maxPred) => { // an oracle or an earlier predicate, maybe negated
    const usable = preds.slice(0, maxPred);
    const name = usable.length && r() < 0.4 ? pick(usable) : pick(oracles);
    return { name, neg: r() < 0.3 };
  };
  const rules = [];
  for (const [i, p] of preds.entries()) rules.push({ head: p, base: pick(["section", "section", "selected"]), body: Array.from({ length: int(1, 3) }, () => lit(i)) });
  while (rules.length < int(2, 4)) { const i = int(0, preds.length - 1); rules.push({ head: preds[i], base: "section", body: Array.from({ length: int(1, 2) }, () => lit(i)) }); }
  const constraints = Array.from({ length: int(1, 2) }, (_, i) => ({
    id: `c${i + 1}`, mode: pick(["require", "forbid"]), nonempty: r() < 0.25,
    forall: r() < 0.4 ? [lit(preds.length)] : [], goal: Array.from({ length: int(1, 2) }, () => lit(preds.length)),
  }));
  return { sections, oracles, selected, preds, rules, constraints };
}

function render(g) {
  const L = (l, v) => `${l.neg ? "not " : ""}${l.name}(D, ${v})`;
  const base = (b, v) => b === "section" ? `core.section(D, ${v}, _)` : `core.selected(D, ${v})`;
  const lines = ["schema_version: 2", "kind: verification-module", "module: w", "rounds: 9", "imports: {core: doc-verify:core}", "oracles:"];
  for (const o of g.oracles) lines.push(`  ${o}(D, S):`, "    ask: q", "    evidence: core.own(D, S)");
  lines.push("rules:");
  g.rules.forEach((ru, i) => { const v = `S${i}`; lines.push(`  ${ru.head}(D, ${v}): ${[base(ru.base, v), ...ru.body.map((l) => L(l, v))].join(", ")}`); });
  lines.push("constraints:");
  for (const c of g.constraints) {
    lines.push(`  ${c.id}:`, `    forall: "${[base("section", "S"), ...c.forall.map((l) => L(l, "S"))].join(", ")}"`, `    ${c.mode}: "${c.goal.map((l) => L(l, "S")).join(", ")}"`, "    severity: error");
    if (c.nonempty) lines.push("    population: nonempty");
  }
  return lines.join("\n") + "\n";
}

// Independent two-valued evaluation of one completion (atom key -> "holds"/"fails").
function twoValued(g, comp) {
  const memo = new Map();
  const val = (l, s) => { const v = g.oracles.includes(l.name) ? comp[`w::${l.name}(d,${s})`] === "holds" : pred(l.name, s); return l.neg ? !v : v; };
  const pred = (p, s) => {
    const k = `${p}/${s}`;
    if (!memo.has(k)) memo.set(k, g.rules.some((ru) => ru.head === p && (ru.base === "section" || g.selected.includes(s)) && ru.body.every((l) => val(l, s))));
    return memo.get(k);
  };
  const statuses = {};
  for (const c of g.constraints) {
    const rows = g.sections.filter((s) => c.forall.every((l) => val(l, s))).map((s) => {
      const goal = c.goal.every((l) => val(l, s));
      return { D: "d", S: s, status: (c.mode === "require") === goal ? "satisfied" : "violated" };
    });
    if (c.nonempty && rows.length === 0) rows.push({ population: "empty", status: "violated" });
    statuses[c.id] = rows;
  }
  const verdict = Object.values(statuses).flat().some((x) => x.status === "violated") ? "NO-GO" : "PASS";
  return { statuses, verdict };
}

// A satisfied binding and an absent one are the same outcome (§4: "every completion either drops the
// binding or satisfies it"), so status sets are compared on their non-satisfied rows.
const canon = (st) => JSON.stringify(Object.keys(st).sort().map((c) => [c, st[c].filter((r) => r.status !== "satisfied").map((r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]))).sort()]));
const completions = (atoms, base) => {
  const free = atoms.filter((a) => base[a] === undefined || base[a] === "unknown");
  return Array.from({ length: 2 ** free.length }, (_, m) => ({ ...base, ...Object.fromEntries(free.map((a, i) => [a, m & (1 << i) ? "holds" : "fails"])) }));
};

const cover = { dem: 0, undetermined: 0, population: 0, notDerivedU: 0, unresolvableAfterDem: 0 };
const kinds = {};
let failures = 0, first, conservative = 0, programs = 0;
const r = rng(SEED);
for (let n = 0; n < COUNT; n += 1) {
  const g = generate(r), module = render(g);
  const { program, rejected } = await loadProgram(module);
  if (rejected) { n -= 1; continue; } // regenerate: the checker's own refusals are not this gate's subject
  programs += 1;
  const facts = [...g.sections.map((s) => parseFact(`section(d, ${s}, root)`)), ...g.selected.map((s) => parseFact(`selected(d, ${s})`))];
  const atoms = g.oracles.flatMap((o) => g.sections.map((s) => `w::${o}(d,${s})`));
  const ans = Object.fromEntries(atoms.flatMap((a) => { const x = r(); return x < 0.5 ? [] : [[a, x < 0.55 ? "unknown" : x < 0.78 ? "holds" : "fails"]]; }));
  const ref = (a) => evaluateWitnessStep(program, facts, new Map(Object.entries(a)));
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
  if (canon(atTotal.statuses) !== canon(two.statuses) || atTotal.verdict !== two.verdict || atTotal.demand.full.length) problems.push(`M2: total ans ${JSON.stringify(total)} gives ${canon(atTotal.statuses)} ${atTotal.verdict}, two-valued ${canon(two.statuses)} ${two.verdict}`);
  const mid = Object.fromEntries(Object.entries(total).filter(([a]) => ans[a] !== undefined && ans[a] !== "unknown" || r() < 0.5)), atMid = ref(mid);
  for (const c of g.constraints) for (const row of rowsOf(here, c)) if (row.status !== "undetermined" && !(row.status === "satisfied" && !rowsOf(atMid, c).some((y) => y.S === row.S)) && !rowsOf(atMid, c).some((y) => y.S === row.S && y.population === row.population && y.status === row.status)) problems.push(`M1: ${c.id} ${JSON.stringify(row)} changed under ${JSON.stringify(mid)}`);
  const dem = here.demand.full;
  if (!here.demand.prefix.every((a) => dem.includes(a))) problems.push(`D1: prefix ${here.demand.prefix} not a subset of full ${dem}`);
  // §6 asks a policy for a non-empty subset of a non-empty Dem; prefix minus asked(ans) can be empty.
  if (dem.length > 0 && here.demand.prefix.length === 0) problems.push(`prefix-stall: prefix is empty while full is ${dem}`);
  // D1 (§6, final wording): after labelling every atom of Dem, a binding may stay undetermined only
  // if, in the NEW state, its support minus asked(ans) is empty (unresolvable); no loops are generated.
  const unknowns = atoms.filter((a) => ans[a] === "unknown");
  let unresolvedAfter = false;
  for (const lab of completions(dem, Object.fromEntries(dem.map((a) => [a, undefined])))) {
    const after = ref({ ...ans, ...lab }), ok = new Set(after.unresolvable.map((x) => `${x.constraint}/${x.S}`));
    for (const [c, rows] of Object.entries(after.statuses)) for (const x of rows) {
      if (x.status !== "undetermined" || !x.S) continue;
      if (ok.has(`${c}/${x.S}`)) unresolvedAfter = true;
      else problems.push(`D1: answering Dem ${JSON.stringify(lab)} leaves ${c}/${x.S} undetermined with a demandable support`);
    }
  }
  cover.unresolvableAfterDem += unresolvedAfter;
  // D2 over never-asked atoms: an asked-unknown atom is outside Dem by §1, yet a label for it is new information.
  for (const a of atoms.filter((x) => !dem.includes(x) && ans[x] === undefined)) for (const label of ["holds", "fails"]) {
    if (canon(ref({ ...ans, [a]: label }).statuses) !== canon(here.statuses)) problems.push(`D2: answering ${a}=${label} outside Dem changes a status`);
  }
  const stalled = [];
  const finals = ["full", "prefix"].map((policy) => {
    let state = { ...ans };
    for (let round = 0; round < 20; round += 1) { const d = ref(state).demand[policy]; if (!d.length) { if (ref(state).demand.full.length) stalled.push(policy); break; } for (const a of d) state[a] = total[a]; }
    return canon(ref(state).statuses);
  });
  if (finals[0] !== finals[1] || (!unknowns.length && finals[0] !== canon(atTotal.statuses))) problems.push(`policy${stalled.length ? "-after-stall" : ""}: full ${finals[0]} prefix ${finals[1]} total ${canon(atTotal.statuses)}`);
  // Coverage the seat asked for.
  cover.dem += dem.length > 0;
  cover.undetermined += Object.values(here.statuses).flat().some((x) => x.status === "undetermined");
  cover.population += Object.values(here.statuses).flat().some((x) => x.population);
  const negDerived = [...g.rules.map((ru) => ru.body), ...g.constraints.map((c) => [...c.forall, ...c.goal])].flat().filter((l) => l.neg && g.preds.includes(l.name));
  cover.notDerivedU += negDerived.some((l) => [...(here.values.get(`w::${l.name}`)?.values() ?? [])].some((e) => e.val === 1));
  for (const x of problems) kinds[x.split(":")[0]] = (kinds[x.split(":")[0]] ?? 0) + 1;
  if (problems.length) { failures += 1; first ??= { n, module, facts: [...g.sections.map((s) => `section(d, ${s}, root)`), ...g.selected.map((s) => `selected(d, ${s})`)], ans, problems }; }
}
console.log(`programs ${programs}, seed ${SEED}, counterexamples ${failures}, undetermined bindings that enumeration decides (Kleene conservatism, not a failure) ${conservative}`);
if (failures) console.log(`problem kinds: ${JSON.stringify(kinds)}`);
console.log(`coverage: of ${programs} programs, non-empty Dem ${cover.dem}, an undetermined binding ${cover.undetermined}, a nonempty population row ${cover.population}, a \`not\` over a derived u atom ${cover.notDerivedU}, unresolvable after Dem ${cover.unresolvableAfterDem}`);
if (first) {
  console.log(`\nfirst counterexample (program #${first.n}):\n--- module\n${first.module}--- facts\n${first.facts.join("\n")}\n--- ans\n${JSON.stringify(first.ans)}\n--- problems\n${first.problems.slice(0, 10).join("\n")}`);
  process.exit(1);
}
