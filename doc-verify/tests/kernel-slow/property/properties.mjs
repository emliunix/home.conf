// Property checks for round 7 (plan §Subjects, oracles and comparisons).
//
// checkProgram(g, evaluate, { subject, only }) -> { problems, d1Weak, exemptN, d1Shape, stats }
//   problems are strings "<kind>: ..."; `only` (a kind) restricts the work to what that kind
//   needs (used by the shrinker and the minimality check, which re-run one kind many times).
//
// Kinds. S1 loop-free (C4's checks, copied): sound, cover, verdict, M2, M1, D1 (re-amended
// wording with exempt()/d1Weak), D2, policy; count-exact (uncorrelated counts). S1 loop programs:
// loop-wfs (exact against the well-founded model), loop-shape (resting bindings listed
// unfounded). S3 loop-free: exact (statuses and verdict against enumeration), D1, D2. S3 loop
// programs: loop-stable (exact against the stable models; UNSAT explicit). Both: matches-unbound
// (expected `rejected`), rejected (an unexpected rejection).
import {
  completions, twoValued, enumerateStatuses, canon, unboundMatches,
  wfs, restingOnLoop, statusVector, vectorDiff,
} from "./oracle.mjs";

export const EXPECTED_FAILURES = {
  // S3 x D1: pre-registered red (round 4b item 5): the single-flip class, shrunk witness <= 6
  "S3:D1": { maxAtoms: 6, shape: "joint" },
  // gate-ledger item 8: loop-resting demand precision (open; not a suite failure)
  "S1:loop-shape": { open: true },
  // count-bound (gate-ledger item 7) is fixed; no longer an expected red
};

const want = (only, kind) => !only || only === kind;

/**
 * Programs whose expected result is `rejected` (a static check, not a truth value), by kind:
 * matches-unbound (both subjects; the explicit unbound mode); count-const for S3 (the shared
 * design-04 checker refuses a constant count result; S1 runs the kernel past the checker, so for
 * S1 the constant form is evaluated and compared like any other program).
 */
export function expectedRejection(g, subject) {
  if (unboundMatches(g)) return "matches-unbound";
  const lits = [...g.rules.flatMap((r) => r.body), ...g.constraints.flatMap((c) => c.goal)];
  if (subject === "S3" && lits.some((l) => l.kind === "count" && l.bind === "const")) return "count-const";
  return null;
}

function pickCompletion(g, ans) {
  const all = completions(g.atoms, ans, g.choose);
  return all[g.totalMask % all.length];
}

function pickMid(g, ans, total) {
  const mid = {};
  Object.entries(total).forEach(([a, v], i) => {
    if ((ans[a] !== undefined && ans[a] !== "unknown") || ((g.midMask >> (i % 16)) & 1)) mid[a] = v;
  });
  return mid;
}

export function labelOptions(g, a) {
  return g.choose && a.includes(`::${g.choose.name}(`) ? g.choose.labels : ["holds", "fails"];
}

export function checkProgram(g, evaluate0, { subject, only = null } = {}) {
  const problems = [];
  const stats = { evals: 0 };
  const evaluate = (a) => { stats.evals += 1; return evaluate0(a); };
  const out = (extra = {}) => ({ problems, d1Weak: 0, exemptN: 0, d1Shape: null, stats, ...extra });

  const here = evaluate(g.ans);
  const expectRej = expectedRejection(g, subject);
  if (expectRej) {
    if (want(only, expectRej) && !here.rejected) problems.push(`${expectRej}: expected rejected, got ${here.verdict}`);
    return out();
  }
  if (here.rejected) {
    if (want(only, "rejected")) problems.push(`rejected: ${here.rejected}`);
    return out();
  }
  if (g.loopOn) return subject === "S1" ? loopsS1(g, here, only, out, problems) : loopsS3(g, here, only, out, problems);
  return subject === "S1" ? loopFreeS1(g, here, evaluate, only, out, problems) : loopFreeS3(g, here, evaluate, only, out, problems);
}

// ---- S1, loop-free ------------------------------------------------------------------------------

function loopFreeS1(g, here, evaluate, only, out, problems) {
  const ans = g.ans;
  const en = enumerateStatuses(g, ans);
  const all = en.all;
  const rowsOf = (res, c) => res.statuses?.[c.id] ?? [];
  const canonS1 = (st) => canon(Object.fromEntries(Object.entries(st).map(([k, rows]) => [k, rows.filter((x) => x.population !== "undetermined")])));
  let d1Weak = 0, exemptN = 0;

  if (want(only, "sound")) {
    for (const c of g.constraints) for (const row of rowsOf(here, c)) {
      const inAll = (pred) => all.every((x) => pred(x.statuses[c.id]));
      if (row.population === "empty" && !inAll((rows) => rows.some((x) => x.population === "empty"))) problems.push(`sound: ${c.id} empty population not empty in some completion`);
      if (!row.S) continue;
      const at = (rows) => rows.find((x) => x.S === row.S);
      if (row.status === "satisfied" && !inAll((rows) => !at(rows) || at(rows).status === "satisfied")) problems.push(`sound: ${c.id} ${row.S} satisfied but violated in some completion`);
      if (row.status === "violated" && !inAll((rows) => at(rows)?.status === "violated")) problems.push(`sound: ${c.id} ${row.S} violated but not in every completion`);
    }
  }
  if (want(only, "cover")) {
    const seen = new Set();
    for (const c of g.constraints) for (const x of all) for (const row of x.statuses[c.id]) {
      const k = `${c.id}/${row.S}`;
      if (row.S && !seen.has(k) && !rowsOf(here, c).some((y) => y.S === row.S)) { seen.add(k); problems.push(`cover: ${c.id} ${row.S} is a binding in a completion but not under ans`); }
    }
  }
  if (want(only, "verdict") && here.verdict !== "NEEDS-REVIEW" && !all.every((x) => x.verdict === here.verdict)) {
    problems.push(`verdict: ${here.verdict} under ans, not in every completion`);
  }

  const total = pickCompletion(g, ans);
  let atTotal;
  if (want(only, "M2") || want(only, "policy")) atTotal = evaluate(total);
  if (want(only, "M2")) {
    const two = twoValued(g, total);
    if (canonS1(atTotal.statuses ?? {}) !== canon(two.statuses) || atTotal.verdict !== two.verdict || (atTotal.demand?.full?.length ?? 0) > 0) {
      problems.push(`M2: total ans gives ${canonS1(atTotal.statuses ?? {})} ${atTotal.verdict}, two-valued ${canon(two.statuses)} ${two.verdict}`);
    }
  }
  if (want(only, "M1")) {
    const mid = pickMid(g, ans, total);
    const atMid = evaluate(mid);
    for (const c of g.constraints) for (const row of rowsOf(here, c)) {
      if (row.status === "undetermined") continue;
      if (row.status === "satisfied" && !rowsOf(atMid, c).some((y) => y.S === row.S)) continue;
      if (!rowsOf(atMid, c).some((y) => y.S === row.S && y.population === row.population && y.status === row.status)) problems.push(`M1: ${c.id} ${JSON.stringify(row)} changed under mid ${JSON.stringify(mid)}`);
    }
  }

  const dem = here.demand?.full ?? [];
  if (want(only, "D1")) {
    // copied from kernel2/random.mjs (re-amended §6): exempt = unresolvable or unfounded; every
    // labelling of Dem(full) is tried (no cap; DECISION in the report), choose atoms by label.
    const exempt = (res) => new Set([
      ...Object.entries(res.unresolvable ?? {}).flatMap(([id, rows]) => rows.map((x) => `${id}/${x.S}`)),
      ...Object.entries(res.unfounded ?? {}).flatMap(([id, rows]) => rows.map((x) => `${id}/${x.S}`)),
    ]);
    const prefix = here.demand?.prefix ?? [];
    if (!prefix.every((a) => dem.includes(a))) problems.push(`D1: prefix ${prefix} not a subset of full ${dem}`);
    if ((dem.length > 0) !== (prefix.length > 0)) problems.push(`D1: prefix ${prefix} empty while full ${dem} is not`);
    const skip = exempt(here);
    exemptN = skip.size;
    for (const lab of completions(dem, {}, g.choose)) {
      const after = evaluate({ ...ans, ...lab });
      const left = Object.entries(after.statuses ?? {}).flatMap(([id, rows]) => rows.filter((x) => x.status === "undetermined" && x.S && !skip.has(`${id}/${x.S}`)).map((x) => `${id}/${x.S}`));
      const after2 = exempt(after);
      if (left.length && left.every((k) => after2.has(k))) { d1Weak = 1; break; }
      if (left.length) { problems.push(`D1: answering Dem ${JSON.stringify(lab)} leaves a resolvable binding undetermined`); break; }
    }
  }
  if (want(only, "D2")) {
    for (const a of g.atoms.filter((x) => !dem.includes(x) && ans[x] === undefined)) {
      for (const label of labelOptions(g, a)) {
        if (canonS1(evaluate({ ...ans, [a]: label }).statuses ?? {}) !== canonS1(here.statuses ?? {})) problems.push(`D2: answering ${a}=${label} outside Dem changes a status`);
      }
    }
  }
  if (want(only, "policy")) {
    const finals = ["full", "prefix"].map((policy) => {
      const state = { ...ans };
      for (let round = 0; round < 20; round++) {
        const d = evaluate(state).demand?.[policy] ?? [];
        if (!d.length) break;
        for (const a of d) state[a] = total[a];
      }
      return canonS1(evaluate(state).statuses ?? {});
    });
    if (finals[0] !== finals[1]) problems.push(`policy: full ${finals[0]} prefix ${finals[1]}`);
    else if (!Object.values(ans).includes("unknown") && finals[0] !== canonS1(atTotal.statuses ?? {})) problems.push(`policy: rounds end ${finals[0]}, total ${canonS1(atTotal.statuses ?? {})}`);
  }
  if (want(only, "count-exact")) {
    // exactness only where model §3 asserts it: the goal is one uncorrelated, unbound count over
    // oracle atoms and the forall is decided under ans
    for (const c of g.constraints) {
      if (c.goal.length !== 1 || c.goal[0].kind !== "count" || c.goal[0].over !== "oracle" || c.goal[0].bind) continue;
      const decided = g.sections.every((s) => c.forall.every((l) => {
        const v = ans[`w::${l.name}(d,${s})`];
        return v === "holds" || v === "fails";
      }));
      if (!decided) continue;
      const sub = { constraints: [c], sections: g.sections };
      const d = vectorDiff(statusVector({ [c.id]: rowsOf(here, c) }, sub), statusVector({ [c.id]: en.statuses[c.id] }, sub));
      if (d.length) problems.push(`count-exact: ${c.id} subject/enumeration ${d.join(", ")}`);
    }
  }
  return out({ d1Weak, exemptN });
}

// ---- S1, loops ------------------------------------------------------------------------------------

function loopsS1(g, here, only, out, problems) {
  const w = wfs(g, g.ans);
  if (want(only, "loop-wfs")) {
    const d = vectorDiff(statusVector(here.statuses, g), statusVector(w.statuses, g));
    if (d.length) problems.push(`loop-wfs: subject/WFS ${d.join(", ")}`);
    if (here.verdict !== w.verdict) problems.push(`loop-wfs: verdict subject ${here.verdict} WFS ${w.verdict}`);
  }
  if (want(only, "loop-shape")) {
    // a binding that rests on a loop is undetermined and listed unfounded (or unresolvable)
    const listed = new Set([
      ...Object.entries(here.unfounded ?? {}).flatMap(([id, rows]) => rows.map((x) => `${id}/${x.S}`)),
      ...Object.entries(here.unresolvable ?? {}).flatMap(([id, rows]) => rows.map((x) => `${id}/${x.S}`)),
    ]);
    for (const k of restingOnLoop(g, g.ans)) {
      const [id, S] = k.split("/");
      const st = (here.statuses?.[id] ?? []).find((x) => x.S === S)?.status;
      if (st !== "undetermined") problems.push(`loop-shape: ${k} rests on a loop, subject ${st ?? "absent"}`);
      else if (!listed.has(k)) problems.push(`loop-shape: ${k} rests on a loop, not listed unfounded`);
    }
  }
  return out();
}

// ---- S3, loop-free ------------------------------------------------------------------------------

/** Status of one row key over a set of completions' two-valued results. */
function rowOver(models, key) {
  const [id, s] = key.split("/");
  if (s === "population") {
    const empty = models.map((x) => x.statuses[id].some((r) => r.population === "empty"));
    return empty.every(Boolean) ? "violated" : empty.some(Boolean) ? "undetermined" : "none";
  }
  const at = models.map((x) => x.statuses[id].find((r) => r.S === s));
  return at.every((r) => !r || r.status === "satisfied") ? "satisfied"
    : at.every((r) => r?.status === "violated") ? "violated" : "undetermined";
}

function loopFreeS3(g, here, evaluate, only, out, problems) {
  const ans = g.ans;
  const en = enumerateStatuses(g, ans);
  let d1Shape = null;
  if (want(only, "exact")) {
    const d = vectorDiff(statusVector(here.statuses, g), statusVector(en.statuses, g));
    if (d.length) problems.push(`exact: S3/enumeration ${d.join(", ")}`);
    if (here.verdict !== en.verdict) problems.push(`exact: verdict S3 ${here.verdict} enumeration ${en.verdict}`);
  }
  const dem = here.demand?.full ?? [];
  if (want(only, "D1")) {
    // every labelling of Dem must decide every binding that answering the remaining unasked atoms
    // could decide (asked-unknown atoms stay free: what rests on them is exempt)
    const rest = g.atoms.filter((a) => ans[a] === undefined && !dem.includes(a));
    const keys = Object.keys(statusVector({}, g));
    const byDem = new Map();
    for (const m of en.all) {
      const k = dem.map((a) => m.comp[a]).join(",");
      if (!byDem.has(k)) byDem.set(k, []);
      byDem.get(k).push(m);
    }
    outer: for (const [labKey, ms] of byDem) {
      const open = keys.filter((k) => rowOver(ms, k) === "undetermined");
      if (!open.length) continue;
      const byRest = new Map();
      for (const m of ms) {
        const k = rest.map((a) => m.comp[a]).join(",");
        if (!byRest.has(k)) byRest.set(k, []);
        byRest.get(k).push(m);
      }
      for (const key of open) {
        const decidable = [...byRest.values()].some((sub) => rowOver(sub, key) !== "undetermined");
        if (!decidable) continue;
        // round 4b's class (gate ledger item 5): the single-flip demand misses atoms that decide a
        // binding only jointly: no non-Dem atom, answered alone at `ans`, changes any status
        const at0 = Object.fromEntries(keys.map((k) => [k, rowOver(en.all, k)]));
        const alone = rest.some((a) => labelOptions(g, a).some((lab) => {
          const sub = en.all.filter((m) => m.comp[a] === lab);
          return keys.some((k) => rowOver(sub, k) !== at0[k]);
        }));
        d1Shape = alone ? "single-atom-relevant" : "joint";
        problems.push(`D1: Dem labelling ${dem.map((a, i) => `${a}=${labKey.split(",")[i]}`).join(" ")} leaves ${key} undetermined; answering non-Dem atoms decides it (${d1Shape})`);
        break outer;
      }
    }
  }
  if (want(only, "D2")) {
    const v0 = statusVector(here.statuses, g);
    for (const a of g.atoms.filter((x) => !dem.includes(x) && ans[x] === undefined)) {
      for (const label of labelOptions(g, a)) {
        const d = vectorDiff(statusVector(evaluate({ ...ans, [a]: label }).statuses, g), v0);
        if (d.length) problems.push(`D2: answering ${a}=${label} outside Dem changes ${d.join(", ")}`);
      }
    }
  }
  return out({ d1Shape });
}

// ---- S3, loops ----------------------------------------------------------------------------------

function loopsS3(g, here, only, out, problems) {
  if (!want(only, "loop-stable")) return out();
  const en = enumerateStatuses(g, g.ans);
  if (en.unsat) {
    // no answer set: UNSAT reported explicitly, every row undetermined, NEEDS-REVIEW, never PASS
    if (!here.unsat) problems.push(`loop-stable: stable models UNSAT, S3 not unsat (verdict ${here.verdict})`);
    if (here.verdict !== "NEEDS-REVIEW") problems.push(`loop-stable: UNSAT but verdict ${here.verdict}`);
    const decided = Object.values(here.statuses ?? {}).flat().filter((r) => r.status !== "undetermined");
    if (decided.length) problems.push(`loop-stable: UNSAT but ${decided.length} decided rows`);
    return out();
  }
  if (here.unsat) problems.push(`loop-stable: S3 UNSAT, stable models exist`);
  const d = vectorDiff(statusVector(here.statuses, g), statusVector(en.statuses, g));
  if (d.length) problems.push(`loop-stable: S3/stable-models ${d.join(", ")}`);
  if (here.verdict !== en.verdict) problems.push(`loop-stable: verdict S3 ${here.verdict} stable-models ${en.verdict}`);
  return out();
}

export function propertyOf(problem) {
  return problem.split(":")[0];
}

