// C5 generator: plain-data AST + fast-check arbitrary (round-7-preregistration.md §Generator).
// No fc.chain / filter. Index-modulo references; optional features as optional fields.
//
// Shrinking (review finding 3, lead): the shrinker is fast-check's own, on the raw record below.
// Its move set is raw-space (integers toward 0, `fc.option` keep-masks toward "dropped"), which is
// not the minimality neighbourhood of minimal.mjs. To let it reach small programs every switch is
// encoded so that 0 means "off / absent / unanswered", and every pool element (section, oracle,
// rule, body literal, constraint, goal literal) carries a keep-mask that is generated "kept" with
// probability 1 - 1e-5 (so the generation distribution is the plan's) and shrinks to "dropped".
import fc from "fast-check";

export const HEADING_VOCAB = ["notes", "intro", "body", "summary", "appendix", "refs"];
export const SECTION_POOL = ["a", "b", "c", "e"];
export const WEIGHTS = {
  chooseOracle: 0.30,
  answerRate: 0.40,
  unknownOfAnswered: 0.15,
  negation: 0.30,          // of literals that can be negated (oracle/pred atoms, choose at 1/3 of that)
  in: 0.10, matches: 0.10, cmp: 0.10, count: 0.10, choose: 0.30, // per body/goal literal slot
  countUncorrelatedInGoals: 0.50, // rule-body counts are always over oracle atoms
  recursion: 0.20,
  negativeLoop: 0.15,
  loopReachable: 0.50,
  loopViaPredicate: 0.50,  // of reachable loops: behind a derived predicate instead of the goal
  nonempty: 0.25,
  oracleForall: 0.40,
  unboundMatches: 0.08,    // per constraint whose forall is section-only (expected: rejected)
  countBound: 0.10,        // of programs with a count (07:42 amendment)
  // count goals that share a variable bound by a sibling literal of the enclosing body
  // (and often a negation inside the count); catches aux capture that omits non-head body vars
  countSiblingVar: 0.18,
  countSiblingNeg: 0.55,   // of countSiblingVar programs: also negate inside the count goal
  // generator-coverage-audit gaps (worklog/kernel-trials/results/generator-coverage-audit.md)
  negLocal: 0.35,          // gap 1: negation with local/anonymous variables or a base-fact target
  negShared: 0.10,         // gap 1: a sibling-bound variable under a negated derived atom, in a goal
  negRefuse: 0.06,        // gaps 1/2: a form the checker must refuse (oracle-local, sibling-shared, nested count)
  countForall: 0.08,       // gap 2: a count in a constraint's forall
  countChoose: 0.35,       // gap 3: of choose programs, a count whose goal is a choose label
  countChoosePair: 0.50,   // of countChoose programs: a second count over another label
  chooseForall: 0.25,      // gap 3: of choose programs, a forall over a choose label
  // trigger floors (plan: >= 20 of 500): reserved slots that force the trigger's site
  chooseTriggerFloor: 0.45,
  countBoundaryFloor: 0.25,
  oddLoopFloor: 0.22,
};

const on = (v, w) => v >= Math.round(100 - w * 100); // 0..99, 0 = off; P(on) = w
const keep = () => fc.option(fc.constant(1), { freq: 100000, nil: null });
const keeps = (n) => fc.array(keep(), { minLength: n, maxLength: n });
const ints = (n, min, max) => fc.array(fc.integer({ min, max }), { minLength: n, maxLength: n });
const litCode = () => fc.tuple(
  fc.integer({ min: 0, max: 99 }), // kind code (0 = plain oracle atom)
  fc.integer({ min: 0, max: 7 }),  // name index
  fc.integer({ min: 0, max: 1 }),  // negation bit
  fc.integer({ min: 0, max: 5 }),  // extra (word, pattern, op, K)
);

/** Arm options: featuresOn (C5 / C5-shrink) or featuresOff (C5-features). */
export function programArbitrary({ featuresOn = true } = {}) {
  // fc.noBias: the plan's weights are the generation distribution (fast-check's default bias
  // over-draws 0 and max); shrinking is unaffected.
  return fc.noBias(fc.record({
    nSec: fc.integer({ min: 2, max: featuresOn ? 4 : 3 }),
    nOra: fc.integer({ min: 2, max: 3 }),
    nPred: fc.integer({ min: 1, max: 3 }),
    nRules: fc.integer({ min: 2, max: featuresOn ? 6 : 4 }),
    nCons: fc.integer({ min: 1, max: featuresOn ? 3 : 2 }),
    keepSec: keeps(4), keepOra: keeps(3), keepRule: keeps(6), keepBody: keeps(18),
    keepCons: keeps(3), keepGoal: keeps(6),
    // keep-masks of the literals the switches below insert (so the shrinker can delete them too)
    keepForced: keeps(11),
    selectedMask: fc.integer({ min: 0, max: 15 }),
    headingIdx: ints(4, 0, 5),
    depthVals: ints(4, 1, 4),
    litCodes: fc.array(litCode(), { minLength: 18, maxLength: 18 }),
    ruleBases: ints(6, 0, 1),
    ruleBodyLens: ints(6, 1, 3),
    consModes: ints(3, 0, 1),
    consNonempty: ints(3, 0, 3),
    consForallBits: ints(3, 0, 99),
    consGoalLens: ints(3, 1, 2),
    consGoalCodes: fc.array(litCode(), { minLength: 6, maxLength: 6 }),
    unboundOn: ints(3, 0, 99),
    chooseOn: fc.integer({ min: 0, max: 99 }),
    chooseLabels: fc.integer({ min: 2, max: 3 }),
    recursionOn: fc.integer({ min: 0, max: 99 }),
    loopOn: fc.integer({ min: 0, max: 99 }),
    loopOdd: fc.integer({ min: 0, max: 1 }),
    loopReachable: fc.integer({ min: 0, max: 99 }),
    loopVia: fc.integer({ min: 0, max: 99 }),
    forceChooseTrigger: fc.integer({ min: 0, max: 99 }),
    forceCountBoundary: fc.integer({ min: 0, max: 99 }),
    forceOddLoop: fc.integer({ min: 0, max: 99 }),
    countBound: fc.integer({ min: 0, max: 99 }),
    countBoundKind: fc.integer({ min: 0, max: 1 }),
    countSiblingVar: fc.integer({ min: 0, max: 99 }),
    countSiblingNeg: fc.integer({ min: 0, max: 99 }),
    negLocalOn: fc.integer({ min: 0, max: 99 }),
    negLocalKind: fc.integer({ min: 0, max: 99 }),
    negLocalSite: fc.integer({ min: 0, max: 99 }),
    negSharedOn: fc.integer({ min: 0, max: 99 }),
    negRefuseOn: fc.integer({ min: 0, max: 99 }),
    negRefuseKind: fc.integer({ min: 0, max: 99 }),
    countForallOn: fc.integer({ min: 0, max: 99 }),
    countChooseOn: fc.integer({ min: 0, max: 99 }),
    countChooseBits: fc.integer({ min: 0, max: 99 }),
    chooseForallOn: fc.integer({ min: 0, max: 99 }),
    answerBits: ints(16, 0, 99),
    totalMask: fc.integer({ min: 0, max: 0xffff }),
    midMask: fc.integer({ min: 0, max: 0xffff }),
    featuresOn: fc.constant(featuresOn),
  })).map((raw) => materialize(raw));
}

function materialize(raw) {
  const featuresOn = !!raw.featuresOn;
  let sections = SECTION_POOL.slice(0, raw.nSec).filter((_, i) => raw.keepSec[i] !== null);
  if (!sections.length) sections = [SECTION_POOL[0]];
  const nSec = sections.length;
  const parents = { a: "root", b: "a", c: "b", e: "c" };
  const selected = sections.filter((s) => (raw.selectedMask >> SECTION_POOL.indexOf(s)) & 1);
  const headings = Object.fromEntries(sections.map((s) => [s, HEADING_VOCAB[raw.headingIdx[SECTION_POOL.indexOf(s)] % 6]]));
  const depths = Object.fromEntries(sections.map((s) => [s, raw.depthVals[SECTION_POOL.indexOf(s)]]));
  let oracles = Array.from({ length: raw.nOra }, (_, i) => `o${i + 1}`).filter((_, i) => raw.keepOra[i] !== null);
  if (!oracles.length) oracles = ["o1"];
  // references use the raw name (o1..o<nOra>); a dropped oracle is remapped by normalize exactly
  // as the neighbourhood's "delete oracle" is, so raw-space and AST-space deletions agree
  const oraRef = (i) => `o${(i % raw.nOra) + 1}`;
  const chooseOn = featuresOn && on(raw.chooseOn, WEIGHTS.chooseOracle);
  const choose = chooseOn ? { name: "k", labels: ["x", "y", "z"].slice(0, raw.chooseLabels) } : null;
  const predNames = Array.from({ length: raw.nPred }, (_, i) => `p${i + 1}`);

  const forceChoose = featuresOn && !!choose && on(raw.forceChooseTrigger, WEIGHTS.chooseTriggerFloor);
  const forceCount = featuresOn && on(raw.forceCountBoundary, WEIGHTS.countBoundaryFloor);
  const forceOdd = featuresOn && on(raw.forceOddLoop, WEIGHTS.oddLoopFloor);
  const recursion = featuresOn && !forceOdd && on(raw.recursionOn, WEIGHTS.recursion);
  const loopOn = featuresOn && (forceOdd || on(raw.loopOn, WEIGHTS.negativeLoop));
  const loopOdd = forceOdd || raw.loopOdd === 1;
  const loopReachable = loopOn && (forceOdd || on(raw.loopReachable, WEIGHTS.loopReachable));
  const loopVia = loopReachable && on(raw.loopVia, WEIGHTS.loopViaPredicate);

  const takeLit = (code, { usablePreds, inGoal }) => {
    const [kc, ni, neg, ex] = code;
    const r = 99 - kc; // kc 0 (the shrink target) = a plain oracle atom
    if (!featuresOn) {
      const usePred = usablePreds.length && r < 40;
      return { kind: "atom", name: usePred ? usablePreds[ni % usablePreds.length] : oraRef(ni), neg: neg === 1 && r % 10 < 3 };
    }
    if (r < 30 && choose) return { kind: "choose", name: choose.name, label: choose.labels[ni % choose.labels.length], neg: neg === 1 && r < 10 };
    if (r >= 30 && r < 40) return { kind: "in", word: HEADING_VOCAB[ex % 6] };
    if (r >= 40 && r < 50) return { kind: "matches", pattern: pickPattern(ex), unbound: false };
    if (r >= 50 && r < 60) return { kind: "cmp", op: ["<", ">=", "=:="][ex % 3], K: 1 + (ex % 4) };
    if (r >= 60 && r < 70) {
      const K = 1 + (ex % raw.nSec);
      if (inGoal && predNames.length && ex % 2 === 1) return { kind: "count", over: "pred", target: predNames[ni % predNames.length], op: ">=", K };
      return { kind: "count", over: "oracle", target: oraRef(ni), op: ">=", K };
    }
    const usePred = usablePreds.length && r < 85;
    return { kind: "atom", name: usePred ? usablePreds[ni % usablePreds.length] : oraRef(ni), neg: neg === 1 && r % 10 < 3 };
  };

  // Rules: rule i heads predNames[i % nPred]; its body may use only predicates of a lower index
  // (stratified by construction; normalize keeps that under shrinking).
  const rules = [];
  for (let i = 0; i < Math.min(raw.nRules, 6); i++) {
    if (raw.keepRule[i] === null) continue;
    const hi = i % raw.nPred;
    const head = predNames[hi];
    const base = raw.ruleBases[i] === 0 ? "section" : "selected";
    const body = [];
    for (let j = 0; j < raw.ruleBodyLens[i]; j++) {
      if (raw.keepBody[i * 3 + j] === null) continue;
      body.push(takeLit(raw.litCodes[i * 3 + j], { usablePreds: predNames.slice(0, hi), inGoal: false }));
    }
    if (forceChoose && rules.length === 0) {
      // S3c's site: two labels of one choose atom in one rule body, same section variable
      const pair = [0, 1].filter((j) => raw.keepForced[j] !== null)
        .map((j) => ({ kind: "choose", name: choose.name, label: choose.labels[j], neg: false }));
      body.splice(0, Math.min(2, body.length), ...pair);
    }
    rules.push({ head, base, body });
  }
  if (recursion) {
    rules.push({ head: "anc", base: "child", body: [], special: "recursion-base" });
    rules.push({ head: "anc", base: "child", body: [], special: "recursion-step" });
  }
  if (loopOn) {
    if (loopOdd) rules.push({ head: "loop", base: "section", body: [], special: "odd-loop" });
    else {
      rules.push({ head: "loop", base: "section", body: [], special: "even-loop-a" });
      rules.push({ head: "loop2", base: "section", body: [], special: "even-loop-b" });
    }
  }

  const constraints = [];
  for (let i = 0; i < Math.min(raw.nCons, 3); i++) {
    if (raw.keepCons[i] === null) continue;
    const mode = raw.consModes[i] === 0 ? "require" : "forbid";
    const nonempty = raw.consNonempty[i] === 3; // 1 in 4
    const useOraForall = on(raw.consForallBits[i], WEIGHTS.oracleForall);
    const forall = useOraForall ? [{ kind: "atom", name: oraRef(raw.consForallBits[i]), neg: false }] : [];
    const goal = [];
    for (let j = 0; j < raw.consGoalLens[i]; j++) {
      if (raw.keepGoal[i * 2 + j] === null) continue;
      goal.push(takeLit(raw.consGoalCodes[i * 2 + j], { usablePreds: predNames, inGoal: true }));
    }
    if (featuresOn && !forall.length && on(raw.unboundOn[i], WEIGHTS.unboundMatches) && raw.keepForced[2] !== null) {
      // explicit unbound mode: a matches literal FIRST in the goal (so it is reached whenever the
      // section-only forall binds), its operand bound by nothing (expected: rejected)
      goal.unshift({ kind: "matches", pattern: pickPattern(raw.unboundOn[i] % 6), unbound: true });
    }
    constraints.push({ id: `c${i + 1}`, mode, nonempty, forall, goal });
  }
  if (!constraints.length) constraints.push({ id: "c1", mode: "require", nonempty: false, forall: [], goal: [{ kind: "atom", name: oracles[0], neg: false }] });

  if (recursion && raw.keepForced[3] !== null) constraints[constraints.length - 1].goal.push({ kind: "atom", name: "anc", neg: false });
  if (loopReachable && raw.keepForced[4] !== null) {
    const pRules = rules.filter((r) => !r.special);
    if (loopVia && pRules.length) {
      const host = pRules[pRules.length - 1];
      host.body.push({ kind: "atom", name: "loop", neg: false });
      constraints[0].goal = [{ kind: "atom", name: host.head, neg: false }];
    } else {
      constraints[0].goal = [{ kind: "atom", name: "loop", neg: false }];
    }
  }
  if (forceCount) {
    // K4's site: a constraint whose goal is one uncorrelated count with a boundary-prone K
    const c = constraints[constraints.length - 1];
    const lit = { kind: "count", over: "oracle", target: oracles[0], op: ">=", K: Math.max(1, Math.min(raw.nSec, 2)) };
    if (raw.keepForced[5] === null) { /* the shrinker dropped the forced count */ }
    else if (loopReachable && constraints.length === 1) c.goal.push(lit);
    else { c.goal = [lit]; c.forall = []; } // section-only forall: the count's exactness is checkable
  }
  for (const c of constraints) if (!c.goal.length) c.goal.push({ kind: "atom", name: oracles[0], neg: false });

  // count-bound mode (07:42 amendment): fixed 10% share of programs that already have a count
  {
    const groups = [...constraints.map((c) => c.goal), ...rules.map((r) => r.body)];
    const hasCount = groups.some((grp) => grp.some((l) => l.kind === "count" && l.over === "oracle"));
    if (featuresOn && hasCount && on(raw.countBound, WEIGHTS.countBound)) {
      for (const grp of groups) {
        const idx = grp.findIndex((l) => l.kind === "count" && l.over === "oracle" && !l.bind);
        if (idx < 0) continue;
        if (raw.countBoundKind === 0) grp.splice(idx + 1, 0, { ...grp[idx], bind: "shared" });
        else grp[idx] = { ...grp[idx], bind: "const" };
        break;
      }
    }
  }

  // countSiblingVar: depth-bind sibling then count(... depth(_,_,Ksib) ...); often with not inside.
  // Closes the a4985be gap where captured = inner ∩ head-only omitted sibling-bound vars.
  if (featuresOn && on(raw.countSiblingVar, WEIGHTS.countSiblingVar)) {
    const groups = [...constraints.map((c) => c.goal), ...rules.filter((r) => !r.special).map((r) => r.body)];
    const negInside = on(raw.countSiblingNeg, WEIGHTS.countSiblingNeg);
    const negTarget = oracles.length > 1 ? oracles[1] : oracles[0];
    let placed = false;
    for (const grp of groups) {
      const idx = grp.findIndex((l) => l.kind === "count" && l.over === "oracle" && !l.siblingVar);
      if (idx < 0) continue;
      const base = grp[idx];
      grp.splice(idx, 1,
        { kind: "depthBind", varName: "Ksib" },
        { ...base, siblingVar: "Ksib", ...(negInside ? { negInside: true, negTarget } : {}) },
      );
      placed = true;
      break;
    }
    if (!placed && constraints.length) {
      constraints[0].goal = [
        { kind: "depthBind", varName: "Ksib" },
        {
          kind: "count", over: "oracle", target: oracles[0], op: "=:=", K: Math.max(1, Math.min(raw.nSec, 2)),
          siblingVar: "Ksib",
          ...(negInside ? { negInside: true, negTarget } : {}),
        },
      ];
    }
  }

  // ---- generator-coverage-audit gaps ------------------------------------------------------------
  const plainRules = rules.filter((r) => !r.special);
  // gap 1: negation with local/anonymous variables or a base-fact target. The target is a raw
  // name, remapped by normalize to a stratified predicate (or an oracle / a base fact).
  if (featuresOn && on(raw.negLocalOn, WEIGHTS.negLocal) && raw.keepForced[6] !== null) {
    const k = raw.negLocalKind, k10 = Math.floor(k / 10);
    const variant = NEGX_VARIANTS[k % NEGX_VARIANTS.length];
    const lit = { kind: "negx", variant, target: predNames[k10 % predNames.length], anon: k10 % 2 === 1 };
    if (variant === "childNot" && k10 % 3 === 2) lit.target = oraRef(k);
    if (variant === "countLeaf") Object.assign(lit, { op: [">=", "<", "=:="][k10 % 3], K: 1 + (k10 % 2) });
    const site = raw.negLocalSite;
    if (site % 2 === 1 && plainRules.length) plainRules[site % plainRules.length].body.push(lit);
    else constraints[site % constraints.length].goal.push(lit);
  }
  // the sibling-shared form over a derived atom: `core.section(D, Z, S), not pK(D, Z)` -- Z is
  // bound by a sibling, so it is NOT local; lifting it (∃Z under the not) changes the meaning
  if (featuresOn && on(raw.negSharedOn, WEIGHTS.negShared) && raw.keepForced[10] !== null) {
    constraints[raw.negSharedOn % constraints.length].goal.push({ kind: "negx", variant: "childNot", target: predNames[raw.negSharedOn % predNames.length] });
  }
  // forms the checker must refuse (expected `checker-refuses`)
  if (featuresOn && on(raw.negRefuseOn, WEIGHTS.negRefuse) && raw.keepForced[7] !== null) {
    const variant = REFUSE_VARIANTS[raw.negRefuseKind % REFUSE_VARIANTS.length];
    const target = variant === "sharedUnsafe" ? predNames[raw.negRefuseKind % predNames.length] : oraRef(raw.negRefuseKind);
    constraints[constraints.length - 1].goal.push({ kind: "refuse", variant, target });
  }
  // gap 2: a count in a forall (over an oracle; the binding is the forall's S)
  if (featuresOn && on(raw.countForallOn, WEIGHTS.countForall) && raw.keepForced[8] !== null) {
    const c = constraints[raw.countForallOn % constraints.length];
    c.forall.push({ kind: "count", over: "oracle", target: oraRef(raw.countForallOn), op: ">=", K: 1 + (raw.countForallOn % 2) });
  }
  // gap 3: a count over a choose label; often a second one over another label (aux sharing)
  if (choose && on(raw.countChooseOn, WEIGHTS.countChoose) && raw.keepForced[9] !== null) {
    const b = raw.countChooseBits;
    const mk = (li) => ({ kind: "count", over: "choose", target: choose.name, label: choose.labels[li % choose.labels.length], op: [">=", "<"][b % 2], K: 1 + (Math.floor(b / 2) % 2) });
    const grp = b % 3 === 0 && plainRules.length ? plainRules[b % plainRules.length].body : constraints[b % constraints.length].goal;
    grp.push(mk(b));
    if (on(b, WEIGHTS.countChoosePair)) constraints[(b + 1) % constraints.length].goal.push(mk(b + 1));
  }
  // gap 3: a forall over a choose label
  if (choose && on(raw.chooseForallOn, WEIGHTS.chooseForall)) {
    const c = constraints[raw.chooseForallOn % constraints.length];
    c.forall.push({ kind: "choose", name: choose.name, label: choose.labels[raw.chooseForallOn % choose.labels.length], neg: false });
  }

  // atoms + answers; cap free <= 10
  const atoms = [];
  for (const o of oracles) for (const s of sections) atoms.push(`w::${o}(d,${s})`);
  if (choose) for (const s of sections) atoms.push(`w::${choose.name}(d,${s})`);
  const ans = {};
  let free = 0;
  const isChooseAtom = (a) => choose && a.includes(`::${choose.name}(`);
  // each atom's answer comes from a fixed slot (oracle number x pool section), so deleting a
  // section or an oracle does not move the other atoms' answers
  const slot = (a) => {
    const m = /^w::(\w+)\(d,(\w+)\)$/.exec(a);
    const si = SECTION_POOL.indexOf(m[2]);
    return m[1] === "k" ? 12 + si : (Number(m[1].slice(1)) - 1) * 4 + si;
  };
  for (let i = 0; i < atoms.length; i++) {
    const bit = raw.answerBits[slot(atoms[i])];
    let answered = on(bit, WEIGHTS.answerRate);
    if (!answered && free >= 10) answered = true; // the free-atom cap, enforced here
    if (!answered) { free += 1; continue; }
    if (featuresOn && bit >= 60 && (bit - 60) % 6 === 5) ans[atoms[i]] = "unknown";
    else if (isChooseAtom(atoms[i])) ans[atoms[i]] = choose.labels[bit % choose.labels.length];
    else ans[atoms[i]] = bit % 2 === 0 ? "holds" : "fails";
  }

  return normalize({
    sections, parents, selected, headings, depths,
    oracles, choose, preds: predNames, rules, constraints,
    featuresOn, atoms, ans,
    totalMask: raw.totalMask, midMask: raw.midMask,
  });
}

/** Gap-1 negation forms (generator-coverage-audit); renderRaw gives the text of each. */
export const NEGX_VARIANTS = ["anyPred", "selected", "child", "heading", "childNot", "countLeaf", "childNot", "anyPred"]; // the lifting-sensitive forms twice
/** Forms the checker must refuse, with the refusal it must give. */
export const REFUSE_VARIANTS = ["oracleLocal", "sharedUnsafe", "nestedCount"];
export const REFUSAL_REASON = {
  oracleLocal: /not over oracle \S+ needs every argument bound/,
  sharedUnsafe: /is unsafe; negation needs it bound/,
  nestedCount: /count does not nest/,
};

const predIndex = (name) => { const m = /^p(\d+)$/.exec(name); return m ? Number(m[1]) : null; };
const SPECIAL_HEADS = new Set(["anc", "loop", "loop2"]);

/**
 * Normalise an AST (also every shrink step and neighbour): remap every reference through the
 * current pools (index-modulo), keep rule bodies stratified (a rule for pK refers only to pJ with
 * J < K, or to anc/loop which depend on no pJ), drop facts and answers of removed sections and
 * oracles, dedupe literal-identical plain count literals, recompute the structural flags.
 */
export function normalize(g0) {
  const g = {
    ...g0,
    oracles: [...(g0.oracles ?? [])],
    rules: (g0.rules ?? []).map((r) => ({ ...r, body: (r.body ?? []).map((l) => ({ ...l })) })),
    constraints: (g0.constraints ?? []).map((c) => ({
      ...c,
      forall: (c.forall ?? []).map((l) => ({ ...l })),
      goal: (c.goal ?? []).map((l) => ({ ...l })),
    })),
    sections: [...(g0.sections ?? [])],
    selected: [...(g0.selected ?? [])],
    ans: { ...(g0.ans ?? {}) },
    choose: g0.choose ? { ...g0.choose, labels: [...g0.choose.labels] } : null,
  };
  const secSet = new Set(g.sections);
  g.selected = g.selected.filter((s) => secSet.has(s));
  const parents = {}, headings = {}, depths = {};
  for (const s of g.sections) {
    const p = g.parents?.[s];
    parents[s] = p && secSet.has(p) ? p : "root";
    headings[s] = g.headings?.[s] ?? "body";
    depths[s] = g.depths?.[s] ?? 1;
  }
  g.parents = parents; g.headings = headings; g.depths = depths;
  const ora = g.oracles;
  const heads = new Set(g.rules.map((r) => r.head));
  const pPool = [...heads].filter((h) => predIndex(h) !== null).sort((a, b) => predIndex(a) - predIndex(b));
  g.preds = [...pPool, ...[...SPECIAL_HEADS].filter((h) => heads.has(h))];

  const pick = (pool, name) => pool[Math.abs(predIndex(name) ?? hash(name)) % pool.length];
  // allowed predicate references for a literal in the body of a rule with head `head` (null: constraint)
  const allowed = (head) => {
    const k = head === null ? Infinity : predIndex(head);
    const ps = k === null ? [] : pPool.filter((p) => predIndex(p) < k); // special heads: no pJ
    return ps;
  };
  const remapLit = (l, head) => {
    if (!ora.length) return l;
    if (l.kind === "atom") {
      if (ora.includes(l.name)) return l;
      if (SPECIAL_HEADS.has(l.name)) {
        if (heads.has(l.name) && (head === null || predIndex(head) !== null)) return l;
        return { ...l, name: ora[Math.abs(hash(l.name)) % ora.length] };
      }
      const ok = allowed(head);
      if (ok.includes(l.name)) return l;
      if (predIndex(l.name) !== null && ok.length) return { ...l, name: pick(ok, l.name) };
      if (/^o\d+$/.test(l.name) || predIndex(l.name) !== null) return { ...l, name: ora[(Number(l.name.slice(1)) - 1) % ora.length] };
      return { ...l, name: ora[Math.abs(hash(l.name)) % ora.length] };
    }
    if (l.kind === "choose") {
      if (!g.choose) return { kind: "atom", name: ora[0], neg: !!l.neg };
      const labs = g.choose.labels;
      return { ...l, name: g.choose.name, label: labs.includes(l.label) ? l.label : labs[Math.abs(hash(l.label)) % labs.length] };
    }
    if (l.kind === "depthBind") return l;
    const oraOf = (t) => (ora.includes(t) ? t : ora[(Number(String(t).slice(1)) - 1 || 0) % ora.length]);
    if (l.kind === "negx") {
      const overPred = l.variant === "anyPred" || (l.variant === "childNot" && predIndex(l.target) !== null);
      if (l.variant === "childNot" && !overPred) return { ...l, target: oraOf(l.target) };
      if (!overPred) { const { target, ...rest } = l; return rest; } // a base-fact form: no target
      const ok = head === null ? pPool : allowed(head);
      if (ok.includes(l.target)) return l;
      if (ok.length) return { ...l, target: pick(ok, l.target) };
      // no stratified predicate to negate here: an oracle (childNot) or a base fact (anyPred)
      return l.variant === "childNot" ? { ...l, target: ora[0] } : { kind: "negx", variant: "selected", anon: !!l.anon };
    }
    if (l.kind === "refuse") {
      if (l.variant === "sharedUnsafe") return { ...l, target: pPool.includes(l.target) ? l.target : pPool.length ? pick(pPool, l.target) : null };
      return { ...l, target: oraOf(l.target) };
    }
    if (l.kind === "count") {
      if (l.over === "pred") {
        // correlated counts appear in constraint goals only
        if (head === null && pPool.includes(l.target)) return l;
        if (head === null && pPool.length) return { ...l, target: pick(pPool, l.target) };
        const { bind, ...rest } = l;
        return { ...rest, over: "oracle", target: ora[0] };
      }
      if (l.over === "choose") {
        if (!g.choose) { const { label, ...rest } = l; return { ...rest, over: "oracle", target: ora[0] }; }
        const labs = g.choose.labels;
        return { ...l, target: g.choose.name, label: labs.includes(l.label) ? l.label : labs[Math.abs(hash(l.label)) % labs.length] };
      }
      const target = oraOf(l.target);
      const negTarget = l.negTarget && ora.includes(l.negTarget) ? l.negTarget
        : l.negInside ? (ora.length > 1 ? ora[1] : ora[0]) : undefined;
      return {
        ...l,
        target,
        ...(l.negInside ? { negInside: true, negTarget } : {}),
      };
    }
    return l;
  };
  const dedupeCounts = (lits) => {
    const seen = new Set();
    return lits.filter((l, i) => {
      if (l.kind !== "count") return true;
      if (l.bind === "shared") {
        // a shared literal needs an anchor: an earlier count over the same oracle in the group
        return lits.slice(0, i).some((x) => x.kind === "count" && x.over === "oracle" && x.target === l.target && !x.bind);
      }
      if (l.bind) return true;
      const k = JSON.stringify(l);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  };
  for (const ru of g.rules) {
    if (ru.special) continue;
    ru.body = dedupeCounts(ru.body.map((l) => remapLit(l, ru.head)));
  }
  for (const c of g.constraints) {
    c.forall = c.forall.map((l) => remapLit(l, null));
    c.goal = dedupeCounts(c.goal.map((l) => remapLit(l, null)));
  }

  const atoms = [];
  for (const o of ora) for (const s of g.sections) atoms.push(`w::${o}(d,${s})`);
  if (g.choose) for (const s of g.sections) atoms.push(`w::${g.choose.name}(d,${s})`);
  const atomSet = new Set(atoms);
  const ans = {};
  for (const [a, v] of Object.entries(g.ans)) {
    if (!atomSet.has(a)) continue;
    if (g.choose && a.includes(`::${g.choose.name}(`) && v !== "unknown" && !g.choose.labels.includes(v)) continue;
    ans[a] = v;
  }
  g.atoms = atoms;
  g.ans = ans;
  const specs = new Set(g.rules.map((r) => r.special).filter(Boolean));
  g.loopOn = specs.has("odd-loop") || specs.has("even-loop-a") || specs.has("even-loop-b");
  g.loopOdd = specs.has("odd-loop");
  g.recursion = specs.has("recursion-base") || specs.has("recursion-step");
  g.loopReachable = g.loopOn && reaches(g, (n) => n === "loop" || n === "loop2");
  g.features = featureFlags(g);
  g.triggers = triggerFlags(g);
  return g;
}

/** Does some constraint reach a predicate satisfying `hit`, through rule bodies? */
export function reaches(g, hit) {
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return false;
    seen.add(name);
    if (hit(name)) return true;
    return g.rules.filter((r) => r.head === name && !r.special).some((r) => r.body.some((l) => refersTo(l, visit)));
  };
  return g.constraints.some((c) => [...c.forall, ...c.goal].some((l) => refersTo(l, visit)));
}

/** Does literal `l` refer to a predicate for which `visit` holds? */
function refersTo(l, visit) {
  if (l.kind === "atom") return visit(l.name);
  if (l.kind === "count" && l.over === "pred") return visit(l.target);
  if ((l.kind === "negx" || l.kind === "refuse") && l.target) return visit(l.target);
  return false;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return h;
}

/** Structural + rendered-text validity: every reference in the AST and the YAML resolves. */
export function isValid(g0) {
  const g = normalize(g0);
  if (!g.oracles?.length) return { ok: false, reason: "no-oracles" };
  if (!g.sections?.length) return { ok: false, reason: "no-sections" };
  if (!g.constraints?.length) return { ok: false, reason: "no-constraints" };
  if (g.constraints.some((c) => !c.goal.length)) return { ok: false, reason: "empty-goal" };
  const ora = new Set(g.oracles);
  const heads = new Set(g.rules.map((r) => r.head));
  const defined = new Set([...ora, ...heads]);
  const checkLit = (l, where, head) => {
    if (l.kind === "atom" && !defined.has(l.name)) return `${where}: dangling atom ${l.name}`;
    if (l.kind === "atom" && head && predIndex(head) !== null && predIndex(l.name) !== null && predIndex(l.name) >= predIndex(head)) return `${where}: unstratified ${l.name}`;
    if (l.kind === "choose") {
      if (!g.choose) return `${where}: choose literal without a choose oracle`;
      if (!g.choose.labels.includes(l.label)) return `${where}: dangling label ${l.label}`;
    }
    if (l.kind === "count" && l.over === "oracle" && !ora.has(l.target)) return `${where}: dangling count oracle ${l.target}`;
    if (l.kind === "count" && l.over === "choose" && (!g.choose || !g.choose.labels.includes(l.label))) return `${where}: bad choose count ${l.label}`;
    if ((l.kind === "negx" || l.kind === "refuse") && l.target && !defined.has(l.target)) return `${where}: dangling negated ${l.target}`;
    if (l.kind === "negx" && l.target && head && predIndex(head) !== null && predIndex(l.target) !== null && predIndex(l.target) >= predIndex(head)) return `${where}: unstratified ${l.target}`;
    if (l.kind === "count" && l.over === "pred" && (head !== null || !heads.has(l.target))) return `${where}: bad correlated count ${l.target}`;
    return null;
  };
  for (const [i, ru] of g.rules.entries()) {
    if (ru.special) continue;
    for (const l of ru.body) { const e = checkLit(l, `rule${i}`, ru.head); if (e) return { ok: false, reason: e }; }
  }
  for (const c of g.constraints) {
    for (const l of [...c.forall, ...c.goal]) { const e = checkLit(l, c.id, null); if (e) return { ok: false, reason: e }; }
  }
  for (const a of Object.keys(g.ans)) if (!g.atoms.includes(a)) return { ok: false, reason: `answer key not an atom: ${a}` };
  let module;
  try { ({ module } = renderRaw(g)); } catch (e) { return { ok: false, reason: `render: ${e.message}` }; }
  const declared = new Set([...g.oracles, ...heads]);
  if (g.choose) declared.add(g.choose.name);
  const builtins = new Set(["matches", "count"]);
  for (const m of module.matchAll(/(?<![\w.:])([A-Za-z_][\w]*)\s*\(/g)) {
    if (builtins.has(m[1])) continue;
    if (!declared.has(m[1])) return { ok: false, reason: `rendered dangling ${m[1]}` };
  }
  return { ok: true, g, module };
}

function pickPattern(ex) {
  const word = HEADING_VOCAB[ex % 6];
  const kinds = [word, `^${word}`, `${word}$`, `${word}|notes`, `^${word}|body$`];
  return kinds[ex % kinds.length];
}

const allLits = (g) => [...g.rules.flatMap((r) => r.body), ...g.constraints.flatMap((c) => [...c.forall, ...c.goal])];

export function featureFlags(g) {
  const lits = allLits(g);
  return {
    choose: lits.some((l) => l.kind === "choose"),
    count: lits.some((l) => l.kind === "count"),
    matches: lits.some((l) => l.kind === "matches" && !l.unbound),
    in: lits.some((l) => l.kind === "in"),
    cmp: lits.some((l) => l.kind === "cmp"),
    recursion: !!g.recursion && reaches(g, (n) => n === "anc"),
    negativeLoop: !!g.loopOn,
    unknown: Object.values(g.ans).includes("unknown"),
    // printed, not in the plan's named-feature list
    countBound: lits.some((l) => l.kind === "count" && !!l.bind),
    countCorrelated: lits.some((l) => l.kind === "count" && l.over === "pred"),
    countSiblingVar: lits.some((l) => l.kind === "count" && !!l.siblingVar),
    unboundMatches: lits.some((l) => l.kind === "matches" && l.unbound),
    loopReachable: !!g.loopReachable,
    // generator-coverage-audit gaps (each has a floor in run-property.mjs)
    negLocal: lits.some((l) => l.kind === "negx"),
    negLocalPred: lits.some((l) => l.kind === "negx" && (l.variant === "anyPred" || l.variant === "childNot") && predIndex(l.target) !== null),
    negBaseFact: lits.some((l) => l.kind === "negx" && ["selected", "child", "heading", "countLeaf"].includes(l.variant)),
    negSiblingShared: lits.some((l) => l.kind === "negx" && l.variant === "childNot"),
    refuseNegation: lits.some((l) => l.kind === "refuse" && l.variant !== "nestedCount"),
    refuseNestedCount: lits.some((l) => l.kind === "refuse" && l.variant === "nestedCount"),
    countForall: g.constraints.some((c) => c.forall.some((l) => l.kind === "count")),
    countChoose: lits.some((l) => l.kind === "count" && l.over === "choose"),
    chooseForall: g.constraints.some((c) => c.forall.some((l) => l.kind === "choose")),
  };
}

/** Interval [c, p] of an oracle count under `ans`. */
export function oracleInterval(g, ans, oracle) {
  let c = 0, p = 0;
  for (const s of g.sections) {
    const v = ans[`w::${oracle}(d,${s})`];
    if (v === "holds") { c += 1; p += 1; } else if (v === undefined || v === "unknown") p += 1;
  }
  return [c, p];
}

export function triggerFlags(g) {
  const choosePair = !!g.choose && [...g.rules.map((r) => r.body), ...g.constraints.map((c) => c.goal)].some((grp) => {
    const labs = grp.filter((l) => l.kind === "choose").map((l) => l.label);
    return new Set(labs).size >= 2 && g.sections.some((s) => {
      const v = g.ans[`w::${g.choose.name}(d,${s})`];
      return v === undefined || v === "unknown";
    });
  });
  // a boundary count: c < K <= p under ans, for an uncorrelated count
  const countBoundary = allLits(g).some((l) => {
    if (l.kind !== "count" || l.over !== "oracle") return false;
    const [c, p] = oracleInterval(g, g.ans, l.target);
    return c < l.K && l.K <= p;
  });
  const oddReachable = !!(g.loopOn && g.loopOdd && g.loopReachable);
  return { choosePair, countBoundary, oddReachable };
}

/** Render AST -> module YAML + fact lines. Always normalises first. */
export function render(g0) {
  return renderRaw(normalize(g0));
}

function renderRaw(g) {
  let seq = 0;
  // one group = one rule body or one constraint goal; `shared` count literals reuse the result
  // variable of the anchor (the latest plain count over the same oracle in the group)
  const countText = (l, v, anchors) => {
    const c = `C${seq}`, n = `N${seq}`;
    seq += 1;
    const atom = l.over === "pred" ? `${l.target}(D, ${c})` : `${l.target}(D, ${c})`;
    let goal;
    if (l.over === "choose") {
      goal = `(core.section(D, ${c}, _), ${l.target}(D, ${c}, ${l.label}))`;
    } else if (l.siblingVar) {
      const neg = l.negInside ? `, not ${l.negTarget ?? l.target}(D, ${c})` : "";
      goal = `(core.section(D, ${c}, _), core.depth(D, ${c}, ${l.siblingVar})${neg})`;
    } else {
      goal = `(core.section(D, ${c}, _), ${atom})`;
    }
    if (l.bind === "const") return `count(${c}, ${goal}, ${l.K})`;
    const res = l.bind === "shared" ? anchors.get(l.target) : n;
    if (!l.bind && l.over === "oracle") anchors.set(l.target, n);
    return `count(${c}, ${goal}, ${res}), ${res} ${l.op} ${l.K}`;
  };
  const litText = (l, v, anchors) => {
    switch (l.kind) {
      case "atom": return `${l.neg ? "not " : ""}${l.name}(D, ${v})`;
      case "choose": return `${l.neg ? "not " : ""}${l.name}(D, ${v}, ${l.label})`;
      case "in": { const h = `H${seq++}`; return `core.heading(D, ${v}, ${h}), ${h} in [${l.word}]`; }
      case "matches": {
        const h = `H${seq++}`;
        return l.unbound ? `matches(${h}, '${l.pattern}')` : `core.heading(D, ${v}, ${h}), matches(${h}, '${l.pattern}')`;
      }
      case "cmp": { const d = `Dep${seq++}`; return `core.depth(D, ${v}, ${d}), ${d} ${l.op} ${l.K}`; }
      case "depthBind": return `core.depth(D, ${v}, ${l.varName})`;
      case "count": return countText(l, v, anchors);
      case "negx": {
        const z = `Z${seq++}`;
        switch (l.variant) {
          case "anyPred": return `not ${l.target}(D, ${l.anon ? "_" : z})`;
          case "selected": return `not core.selected(D, ${l.anon ? "_" : v})`;
          case "child": return `not core.section(D, ${z}, ${v})`;
          case "heading": return `not core.heading(D, ${v}, ${z})`;
          case "childNot": return `core.section(D, ${z}, ${v}), not ${l.target}(D, ${z})`;
          case "countLeaf": {
            const c = `C${seq}`, n = `N${seq}`;
            seq += 1;
            return `count(${c}, (core.section(D, ${c}, _), not core.section(D, ${z}, ${c})), ${n}), ${n} ${l.op} ${l.K}`;
          }
          default: throw new Error(`unknown negx variant ${l.variant}`);
        }
      }
      case "refuse": {
        const z = `Z${seq++}`;
        switch (l.variant) {
          case "oracleLocal": return `not ${l.target}(D, ${z})`;
          case "sharedUnsafe": return `not ${l.target ? `${l.target}(D, ${z})` : `core.selected(D, ${z})`}, core.section(D, ${z}, ${v})`;
          case "nestedCount": {
            const c = `C${seq}`, n = `N${seq}`, c2 = `C${seq + 1}`, m = `N${seq + 1}`;
            seq += 2;
            return `count(${c}, (core.section(D, ${c}, _), count(${c2}, (core.section(D, ${c2}, ${c}), ${l.target}(D, ${c2})), ${m}), ${m} >= 1), ${n}), ${n} >= 1`;
          }
          default: throw new Error(`unknown refuse variant ${l.variant}`);
        }
      }
      default: throw new Error(`unknown literal kind ${l.kind}`);
    }
  };
  const lines = ["schema_version: 2", "kind: verification-module", "module: w", "rounds: 9", "imports: {core: doc-verify:core}", "oracles:"];
  for (const o of g.oracles) lines.push(`  ${o}(D, S):`, "    ask: q", "    evidence: core.own(D, S)");
  if (g.choose) lines.push(`  ${g.choose.name}(D, S, L):`, "    ask: q", "    evidence: core.own(D, S)", `    choose: [${g.choose.labels.join(", ")}]`);
  lines.push(g.rules.length ? "rules:" : "rules: {}");
  g.rules.forEach((ru, i) => {
    switch (ru.special) {
      case "recursion-base": lines.push("  anc(D, S): core.section(D, S, P), core.section(D, P, _)"); return;
      case "recursion-step": lines.push("  anc(D, T): core.section(D, T, U), anc(D, U)"); return;
      case "odd-loop": lines.push("  loop(D, S): core.section(D, S, _), not loop(D, S)"); return;
      case "even-loop-a": lines.push("  loop(D, S): core.section(D, S, _), not loop2(D, S)"); return;
      case "even-loop-b": lines.push("  loop2(D, T): core.section(D, T, _), not loop(D, T)"); return;
      default: break;
    }
    const v = `S${i}`;
    const parts = [ru.base === "selected" ? `core.selected(D, ${v})` : `core.section(D, ${v}, _)`];
    const anchors = new Map();
    for (const l of ru.body) parts.push(litText(l, v, anchors));
    lines.push(`  ${ru.head}(D, ${v}): ${parts.join(", ")}`);
  });
  lines.push("constraints:");
  for (const c of g.constraints) {
    const forallParts = ["core.section(D, S, _)", ...c.forall.map((l) => litText(l, "S", new Map()))];
    const anchors = new Map();
    const goalParts = c.goal.map((l) => litText(l, "S", anchors));
    lines.push(`  ${c.id}:`, `    forall: "${forallParts.join(", ")}"`, `    ${c.mode}: "${goalParts.join(", ")}"`, "    severity: error");
    if (c.nonempty) lines.push("    population: nonempty");
  }
  const facts = [];
  for (const s of g.sections) {
    facts.push(`section(d, ${s}, ${g.parents[s] ?? "root"})`, `heading(d, ${s}, ${g.headings[s]})`, `depth(d, ${s}, ${g.depths[s]})`);
  }
  for (const s of g.selected) facts.push(`selected(d, ${s})`);
  return { module: lines.join("\n") + "\n", facts };
}

/** Size used for the plan's witness bounds: rules + oracles + choose + constraints + sections + answers. */
export function atomSize(g) {
  return g.rules.length + g.oracles.length + (g.choose ? 1 : 0) + g.constraints.length + g.sections.length + Object.keys(g.ans).length;
}

export function freeAtoms(g) {
  return g.atoms.filter((a) => g.ans[a] === undefined);
}

/** The count-bound-free twin of a program: shared literals removed, const results made `N =:= K`. */
export function unboundTwin(g) {
  const fix = (lits) => lits.filter((l) => !(l.kind === "count" && l.bind === "shared"))
    .map((l) => (l.kind === "count" && l.bind === "const" ? { ...l, bind: undefined, op: "=:=" } : l))
    .map((l) => { if (l.kind === "count" && "bind" in l && l.bind === undefined) { const { bind, ...r } = l; return r; } return l; });
  return normalize({
    ...g,
    rules: g.rules.map((r) => ({ ...r, body: fix(r.body) })),
    constraints: g.constraints.map((c) => ({ ...c, goal: fix(c.goal) })),
  });
}
