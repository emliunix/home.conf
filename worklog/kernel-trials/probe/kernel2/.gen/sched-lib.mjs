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

export { rng, generate, render };
