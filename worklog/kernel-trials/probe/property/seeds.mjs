// Seeded defects for round 7. S1 seeds are in-memory core.pl text patches (never edit committed file).
// S3 seeds use subject-clingo `defect:` options.

/** Apply named S1 core.pl patch. Returns patched text. */
export function applyCorePatch(coreText, seed) {
  switch (seed) {
    case "K1":
      // require violated under a u forall (round 2 mutA)
      if (!coreText.includes("core_status(require, t, f, violated)")) {
        throw new Error("K1: expected site core_status(require, t, f, violated) not found");
      }
      return coreText.replace(
        "core_status(require, t, f, violated)  :- !.",
        "core_status(require, _, f, violated)  :- !.",
      );
    case "K2": {
      // forall-only demand (round 2 mutB): full demand walks only the forall
      const from = `core_binding_leaf(full, Id, Vals, _, A) :-
    (   core_goal_leaf(core_forall(Id, Vals), full, A)
    ;   core_goal_leaf(core_goal(Id, Vals), full, A)
    ).`;
      const to = `core_binding_leaf(full, Id, Vals, _, A) :-
    core_goal_leaf(core_forall(Id, Vals), full, A).`;
      if (!coreText.includes("core_binding_leaf(full, Id, Vals, _, A)")) {
        throw new Error("K2: expected site core_binding_leaf(full, ...) not found");
      }
      return coreText.replace(from, to);
    }
    case "K3'":
    case "K3p":
      // answered choose leaves other labels u (mutate core_label)
      return patchK3(coreText);
    case "K4-low":
      // upper bound one too low (avoid P0: already used in findall above)
      if (!coreText.includes("length(Cs, C), length(Ps, P),")) {
        throw new Error("K4-low: count site not found");
      }
      return coreText.replace(
        "length(Cs, C), length(Ps, P),",
        "length(Cs, C), length(Ps, PLen), P is max(C, PLen - 1),",
      );
    case "K4-high":
      if (!coreText.includes("length(Cs, C), length(Ps, P),")) {
        throw new Error("K4-high: count site not found");
      }
      return coreText.replace(
        "length(Cs, C), length(Ps, P),",
        "length(Cs, C), length(Ps, PLen), P is PLen + 1,",
      );
    default:
      throw new Error(`unknown S1 seed ${seed}`);
  }
}

function patchK3(coreText) {
  // Plan: answered choose → other labels u (choose-scoped via core_oracle_decl Kind=choose).
  if (!coreText.includes("core_label(A, L) :-")) {
    throw new Error("K3': expected site core_label(A, L) not found");
  }
  if (coreText.includes("% K3' choose-scoped")) return coreText;
  const fromLabel =
    "core_label(A, L) :-\n" +
    "    core_ground_or_throw(A, nonground_oracle),\n" +
    "    (   core_answered(A, L), L \\== unknown\n" +
    "    ;   \\+ core_has_label(A), core_u(lab(A, L))\n" +
    "    ).";
  const toLabel =
    "% K3' choose-scoped\n" +
    "core_label(A, L) :-\n" +
    "    core_ground_or_throw(A, nonground_oracle),\n" +
    "    (   core_answered(A, L), L \\== unknown\n" +
    "    ;   \\+ core_has_label(A), core_u(lab(A, L))\n" +
    "    ;   core_answered(A, L2), L2 \\== unknown, L2 \\== L,\n" +
    "        A =.. [F|_], core_oracle_decl(F, _, _, _, choose),\n" +
    "        core_u(lab(A, L))\n" +
    "    ).";
  if (!coreText.includes(fromLabel)) {
    throw new Error("K3': core_label site text did not match (core.pl drift)");
  }
  let out = coreText.replace(fromLabel, toLabel);
  const fromNot =
    "core_not_label(A, L) :-\n" +
    "    core_ground_or_throw(A, nonground_negation),\n" +
    "    (   core_answered(A, L2), L2 \\== unknown, L2 \\== L\n" +
    "    ;   \\+ core_has_label(A), core_u(lab(A, L))\n" +
    "    ).";
  const toNot =
    "core_not_label(A, L) :-\n" +
    "    core_ground_or_throw(A, nonground_negation),\n" +
    "    (   core_answered(A, L2), L2 \\== unknown, L2 \\== L,\n" +
    "        (   A =.. [F|_], core_oracle_decl(F, _, _, _, choose)\n" +
    "        ->  core_u(lab(A, L))\n" +
    "        ;   true\n" +
    "        )\n" +
    "    ;   \\+ core_has_label(A), core_u(lab(A, L))\n" +
    "    ).";
  if (!out.includes(fromNot)) {
    throw new Error("K3': core_not_label site text did not match (core.pl drift)");
  }
  return out.replace(fromNot, toNot);
}

// Every patch must change the text: a no-op replacement (site drift) throws (finding 17).
export function corePatcher(seed) {
  return (text) => {
    const out = seed === "K3'" || seed === "K3p" ? patchK3(text) : applyCorePatch(text, seed);
    if (out === text) throw new Error(`${seed}: patch did not change core.pl (site drift)`);
    return out;
  };
}

export const S1_SEEDS = [
  { id: "K1", subject: "S1", kind: "control", property: "sound" },
  { id: "K2", subject: "S1", kind: "control", property: "D1" },
  { id: "K3'", subject: "S1", kind: "axis", property: "sound" },
  { id: "K4-low", subject: "S1", kind: "axis", property: "sound" },
  { id: "K4-high", subject: "S1", kind: "axis", property: "count-exact" },
];

export const S3_SEEDS = [
  { id: "S3a", subject: "S3", defect: "ignore-body", kind: "control", property: "exact" },
  { id: "S3b", subject: "S3", defect: "unsat-vacuous", kind: "axis", property: "odd-loop" },
  { id: "S3c", subject: "S3", defect: "no-exclusivity", kind: "axis", property: "exact" },
];

/** The problem kinds a predicted property covers (the plan's seed table: K3' "cover/sound"). */
export function seedKinds(property) {
  if (property === "sound") return ["sound", "cover"];
  if (property === "odd-loop") return ["loop-stable"];
  return [property];
}
export function propMatch(property, problem) {
  return seedKinds(property).some((k) => problem.startsWith(`${k}:`));
}

/** Oracle names a literal list reaches (directly, through counts, or through rule bodies). */
function leafNames(g, lits, seen = new Set()) {
  const out = new Set();
  for (const l of lits) {
    if (l.kind === "atom" && g.oracles.includes(l.name)) out.add(l.name);
    else if (l.kind === "choose") out.add(l.name);
    else if (l.kind === "count" && l.over === "oracle") out.add(l.target);
    else {
      const name = l.kind === "atom" ? l.name : l.kind === "count" ? l.target : null;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      for (const r of g.rules.filter((x) => x.head === name && !x.special)) for (const n of leafNames(g, r.body, seen)) out.add(n);
    }
  }
  return out;
}
const openAtom = (g, name, s) => {
  const v = g.ans[`w::${name}(d,${s})`];
  return v === undefined || v === "unknown";
};
const unanswered = (g, name, s) => g.ans[`w::${name}(d,${s})`] === undefined;

/**
 * Trigger: the program exercises the seed's site AND the seed can change the outcome there
 * (review finding 12). Each is a syntactic necessary condition, stated per seed.
 */
export function seedTriggered(seedId, g) {
  const lits = [...g.rules.flatMap((r) => r.body), ...g.constraints.flatMap((c) => c.goal)];
  const plainCounts = lits.filter((l) => l.kind === "count" && l.over === "oracle" && !l.bind);
  switch (seedId) {
    case "K1": // require violated under a u forall: a require whose forall has an open oracle atom
      return g.constraints.some((c) => c.mode === "require" && c.forall.some((l) => g.sections.some((s) => openAtom(g, l.name, s))));
    case "K2": // forall-only demand: a goal that reaches an unanswered leaf
      return g.constraints.some((c) => [...leafNames(g, c.goal)].some((o) => g.sections.some((s) => unanswered(g, o, s))));
    case "K3'": // an answered choose atom, and a literal on another label of it
      return !!g.choose && g.sections.some((s) => {
        const v = g.ans[`w::${g.choose.name}(d,${s})`];
        return v !== undefined && v !== "unknown" && lits.some((l) => l.kind === "choose" && l.label !== v);
      });
    case "K4-low": // [c, p-1]: changes N >= K exactly where c < K = p
      return plainCounts.some((l) => { const [c, p] = interval(g, l.target); return c < l.K && l.K === p; });
    case "K4-high": // [c, p+1]: changes N >= K exactly where K = p + 1
      return plainCounts.some((l) => { const [, p] = interval(g, l.target); return l.K === p + 1; });
    case "S3a": // ignore-body: a forall that is not t for some section
      return g.constraints.some((c) => c.forall.some((l) => g.sections.some((s) => g.ans[`w::${l.name}(d,${s})`] !== "holds")));
    case "S3b": // UNSAT read as vacuous: any odd loop makes the program UNSAT
      return !!(g.loopOn && g.loopOdd);
    case "S3c": // exclusivity: two labels of one open choose atom in one body or goal
      return g.triggers.choosePair;
    default: return false;
  }
}

function interval(g, oracle) {
  let c = 0, p = 0;
  for (const s of g.sections) {
    const v = g.ans[`w::${oracle}(d,${s})`];
    if (v === "holds") { c += 1; p += 1; } else if (v === undefined || v === "unknown") p += 1;
  }
  return [c, p];
}
