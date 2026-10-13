// subject-clingo.mjs - subject S3 (kernel-trials round 4b): clingo (clingo-wasm 0.6.0, clingo 5.8.1)
// with every unasked oracle atom a free external, statuses from cautious and brave consequences.
//
// Shares no code with the WFS kernel (kernel2/): the module is parsed by the reference's
// `loadProgram` (doc-verify's compileModule + the reference's §8 static check) and facts by the
// reference's `parseFact`. A module the design-04 checker refuses ONLY for unstratified negation
// (which ASP handles) is resolved by `syntaxResolve` below, written here, after the reference's
// static check passes.
//
// Translation (round-4b-preregistration.md, Candidate; review amendments 1-8):
//   - every constant (atom, string, list, non-integer number) goes through ONE table to `c<i>`;
//     integers stay integers; predicates through one table to `p<i>_<name>`; reversed on output.
//   - facts as ASP facts; rules as ASP rules; `not` as default negation; `cmp` as an ASP
//     comparison; `count(V, G, N)` as `N = #count { V : G }`; `present/3` refused.
//   - `in` / `matches` pre-evaluated over the domain constants into facts `in<k>(I, L)` / `m<k>(X)`,
//     only when every variable operand is bound by a base-fact literal of the same conjunction (or
//     is a choose oracle's label variable, whose values are the declared labels); an operand bound
//     only by a derived predicate or a count is refused (amendment 6).
//   - oracle atoms: candidate instances come from a positive RELAXED copy of the program (`r_`
//     predicates; negation, comparisons and oracle atoms read as possibly true; a count result
//     ranges over the domain), `rdom<o>(Inputs)`. Two-label: `#external o(I) : rdom(I). [free]`;
//     `holds` -> fact, `fails` -> integrity constraint. Choose: one external per label plus an
//     exactly-one constraint per candidate; an answered label is forced. An `unknown` answer (or
//     a label the oracle does not declare) leaves the atom FREE and it is never demanded (§6
//     `asked`; amendment 3).
//   - constraint c (amendment 1, model §4 per answer set):
//       bind(Vs) :- forall.   g(Vs) :- bind(Vs), goal.
//       require: bad(Vs) :- bind(Vs), not g(Vs).      forbid: bad(Vs) :- g(Vs).
//     binding = brave bind; violated iff bad cautious (B true and G wrong in every answer set);
//     satisfied iff bad not brave (B false or G right in every answer set); else undetermined.
//     nonempty: pop :- bind(Vs). cautious -> no row; not brave -> {population: empty, violated};
//     else {population: undetermined, undetermined}.
//   - verdict from statuses as model §5 / reference.mjs (amendment 2). `joint`: the per-answer-set
//     verdict (nogo / review atoms) when every answer set agrees, else `mixed`; printed, not compared.
//   - UNSAT: never vacuous (amendment 4): `{unsat: true}`, every binding (from the solve without the
//     answers) undetermined, verdict NEEDS-REVIEW.
//   - demand.full (amendment 5): an unasked candidate e is demanded iff some label v with e := v
//     changes some binding's status (absent = satisfied) against the unfixed solve. `prefix: []`.
//     Skipped when no row is undetermined (fixing only removes answer sets; decided cannot move).
//
// Seeded defects (amendment 8), `prepareS3Program(program, facts, { defect })`:
//   "ignore-body"    status from the goal alone over the relaxed forall domain (B ignored);
//   "unsat-vacuous"  UNSAT read as "no binding": every constraint satisfied, PASS;
//   "no-exclusivity" choose labels independent (the exactly-one constraint dropped).
import { loadProgram, staticCheck } from "./reference/reference.mjs";
import { parseFact, parseTerm, normalizeAtom, key, plain, listItems, num } from "./reference/terms.mjs";
import { loadModule } from "../../dist/engine/module.js";

const VENDOR = new URL("../../../node_modules/clingo-wasm/dist/", import.meta.url);
let runSync;
/** The in-thread runner (dist/run.js); the package's default Node entry runs clingo in a worker and is async only. */
async function clingoInit() {
  if (!runSync) {
    const { init } = await import(new URL("run.js", VENDOR).href);
    runSync = await init({ singleThreaded: true });
  }
}

export let clingoVersion;
export const stats = { solves: 0, solveMs: 0 };

function solve(text, mode) {
  const t = performance.now();
  const r = runSync(text, 0, [`--enum-mode=${mode}`]);
  stats.solves += 1; stats.solveMs += performance.now() - t;
  clingoVersion ??= r.Solver;
  if (r.Result === "ERROR") throw new Error(`clingo: ${r.Error}`);
  if (r.Result === "UNSATISFIABLE") return null;
  const ws = r.Call?.[0]?.Witnesses ?? [];
  return new Set(ws.length ? ws[ws.length - 1].Value : []);
}

/** Parses the module (reference parser) and prepares S3; returns { rejected } or { step(answers) }. */
export async function prepareS3(moduleYaml, factTexts, opts = {}) {
  const loaded = await loadS3Program(moduleYaml);
  if (loaded.rejected) return { rejected: loaded.rejected };
  return prepareS3Program(loaded.program, (factTexts ?? []).map(parseFact), opts);
}

/** loadProgram, except that a refusal for unstratified negation alone is resolved syntactically. */
export async function loadS3Program(moduleYaml) {
  const { program, rejected } = await loadProgram(moduleYaml);
  if (!rejected) return { program };
  const msg = rejected.join("; ");
  const parts = msg.replace(/^parser\/checker: /, "").split(/;\s*/);
  if (!msg.startsWith("parser/checker:") || !parts.every((p) => /in the same stratum/.test(p))) return { rejected: msg };
  const parsed = await loadModule(moduleYaml);
  if (staticCheck(parsed).length) return { rejected: msg };
  return { program: syntaxResolve(parsed), note: `checker refused (${msg}); resolved syntactically for S3` };
}

export async function prepareS3Program(program, facts, opts = {}) {
  await clingoInit();
  const variants = new Map();
  const tr = (o) => {
    const k = JSON.stringify(o);
    if (!variants.has(k)) variants.set(k, translate(program, facts, o));
    return variants.get(k);
  };
  let base;
  try { base = tr({ defect: opts.defect }); } catch (e) {
    if (e instanceof Unsupported) return { rejected: e.message };
    throw e;
  }
  const hasCount = (lits) => lits.some((l) => l.kind === "count");
  return {
    text: base.text,
    hasChoose: program.oracles.some((o) => o.inputs.length < o.arity),
    usesCount: (id) => program.rules.some((r) => hasCount(r.body)) || program.constraints.some((c) => c.id === id && hasCount([...c.forall, ...c.goal])),
    step: (answers, o = {}) => evaluate(program, base, answers ?? {}, { ...o, defect: opts.defect }),
    /** Statuses under a variant: { noExclusivity } and/or { dropAnswers } (cause tagging, amendment 7). */
    variant: (answers, { noExclusivity = false, dropAnswers = false } = {}) =>
      evaluate(program, tr({ defect: opts.defect, noExclusivity }), dropAnswers ? {} : answers ?? {}, { demand: false, defect: opts.defect }),
  };
}

// ---- syntax-only resolution (unstratified modules) ---------------------------------------------
const COMPARISONS = new Set(["<", ">", "=<", ">=", "=:=", "=\\="]);
function syntaxResolve(parsed) {
  const mod = parsed.source.module, q = (n) => `${mod}::${n}`;
  const conj = (t) => t.kind === "compound" && t.functor === "," && t.args.length === 2 ? [...conj(t.args[0]), ...conj(t.args[1])] : [t];
  const lit = (t) => {
    if (t.kind === "atom" && t.name === "true") return [];
    if (t.kind === "atom") return [{ kind: "pos", predicate: q(t.name), args: [] }];
    if ((t.functor === "not" || t.functor === "\\+") && t.args.length === 1) {
      const [x] = lit(t.args[0]);
      return [x.kind === "matches" ? { ...x, negated: !x.negated } : { kind: "neg", predicate: x.predicate, args: x.args }];
    }
    if (t.functor === "matches" && t.args.length === 2) { const p = t.args[1].kind === "atom" ? t.args[1].name : t.args[1].value; return [{ kind: "matches", item: t.args[0], pattern: p, regex: new RegExp(p, "u"), negated: false }]; }
    if (t.functor === "in" && t.args.length === 2) return [{ kind: "in", item: t.args[0], list: t.args[1] }];
    if (COMPARISONS.has(t.functor) && t.args.length === 2) return [{ kind: "cmp", op: t.functor, left: t.args[0], right: t.args[1] }];
    if (t.functor === "present" && t.args.length === 3) return [{ kind: "present" }];
    if (t.functor === "count" && t.args.length === 3) return [{ kind: "count", variable: t.args[0], goal: conj(t.args[1]).flatMap(lit), result: t.args[2] }];
    if (t.functor === ":" && t.args.length === 2) { const [a, c] = t.args; return [{ kind: "pos", predicate: `${a.name}::${c.kind === "atom" ? c.name : c.functor}`, args: c.kind === "atom" ? [] : c.args }]; }
    return [{ kind: "pos", predicate: q(t.functor), args: t.args }];
  };
  const body = (t) => conj(t).flatMap(lit);
  return {
    module: mod, warningThreshold: parsed.source.warning_threshold ?? 0,
    oracles: parsed.oracles.map((o) => {
      const params = o.head.args.map((a) => a.name), choose = o.source.choose !== undefined;
      return { predicate: q(o.head.functor), arity: params.length, inputs: (choose ? params.slice(0, -1) : params).map((_, i) => i), labels: o.source.choose ?? ["holds", "fails"] };
    }),
    rules: parsed.rules.map((r) => ({ predicate: q(r.head.kind === "atom" ? r.head.name : r.head.functor), head: r.head.kind === "atom" ? [] : r.head.args, body: body(r.body) })),
    constraints: parsed.constraints.map((c) => ({ id: c.id, forall: body(c.forall), goal: body(c.goal), mode: c.mode, severity: c.source.severity, weight: c.source.weight ?? 1, nonempty: c.source.population === "nonempty", profiles: c.source.profiles })),
  };
}

// ---- translation --------------------------------------------------------------------------------
export class Unsupported extends Error {}
const groundTerm = (t) => t.kind !== "var" && (t.kind !== "compound" || t.args.every(groundTerm));
const atomText = (p, args) => args.length ? `${p}(${args.join(",")})` : p;
const varsOf = (t, out = new Set()) => { if (t.kind === "var" && t.name !== "_") out.add(t.name); if (t.kind === "compound") t.args.forEach((a) => varsOf(a, out)); return out; };

function translate(program, facts, { defect, noExclusivity = defect === "no-exclusivity" } = {}) {
  // constants -> c<i>; compound terms (lists included) -> f<j>(args), j indexing functor/arity; both reversible
  const consts = new Map(), back = new Map(), functors = new Map(), backF = new Map();
  const F = (t) => {
    const k = `${t.functor}/${t.args.length}`;
    if (!functors.has(k)) { const f = `f${functors.size}`; functors.set(k, f); backF.set(f, t.functor); }
    return functors.get(k);
  };
  const C = (t) => {
    if (t.kind === "number" && Number.isInteger(t.value)) return String(t.value);
    if (t.kind === "compound") return `${F(t)}(${t.args.map(C).join(",")})`;
    const k = key(t);
    if (!consts.has(k)) { const c = `c${consts.size}`; consts.set(k, c); back.set(c, t); }
    return consts.get(k);
  };
  const preds = new Map();
  const P = (name) => {
    if (!preds.has(name)) preds.set(name, `p${preds.size}_${name.replace(/[^A-Za-z0-9]/g, "_").toLowerCase()}`);
    return preds.get(name);
  };
  const V = (name) => name === "_" ? "_" : `V_${name}`;
  const T = (t) => {
    if (t.kind === "var") return V(t.name);
    if (t.kind === "compound") return `${F(t)}(${t.args.map(T).join(",")})`;
    return C(t);
  };

  const oracles = new Map(program.oracles.map((o, i) => [o.predicate, { o, i, choose: o.inputs.length < o.arity }]));
  const labelIndex = (o) => [...Array(o.arity).keys()].find((i) => !o.inputs.includes(i));
  const derived = new Set(program.rules.map((r) => r.predicate));
  const isBase = (p) => !derived.has(p) && !oracles.has(p);

  const literalsOf = (lits) => lits.flatMap((l) => l.kind === "count" ? [l, ...literalsOf(l.goal)] : [l]);
  const allLits = [...program.rules.flatMap((r) => literalsOf(r.body)), ...program.constraints.flatMap((c) => literalsOf([...c.forall, ...c.goal]))];
  if (allLits.some((l) => l.kind === "present")) throw new Unsupported("present/3 is out of scope for S3");

  // amendment 6: in/matches operands must be fact-bound (or a choose label variable)
  const checkBuiltins = (conj, outer, where) => {
    const all = [...outer, ...conj];
    const factBound = new Set();
    for (const l of all) {
      if (l.kind !== "pos") continue;
      if (isBase(l.predicate)) l.args.forEach((a) => varsOf(a, factBound));
      const o = oracles.get(l.predicate);
      if (o?.choose) varsOf(l.args[labelIndex(o.o)], factBound);
    }
    for (const l of conj) {
      if (l.kind === "count") { checkBuiltins(l.goal, all.filter((x) => x !== l), where); continue; }
      const ops = l.kind === "in" ? [l.item, l.list] : l.kind === "matches" ? [l.item] : [];
      for (const op of ops) for (const v of varsOf(op)) if (!factBound.has(v)) {
        throw new Unsupported(`S3: ${l.kind} operand ${v} in ${where} is not bound by a base fact (derived or count operand); pre-evaluation refused`);
      }
    }
  };
  for (const r of program.rules) checkBuiltins(r.body, [], `rule ${r.predicate}`);
  for (const c of program.constraints) checkBuiltins([...c.forall, ...c.goal], [], `constraint ${c.id}`);

  // the constant domain: fact arguments and list items, module constants, labels, small integers
  const domain = new Map();
  const addDom = (t) => { if (!groundTerm(t)) return; domain.set(key(t), t); for (const x of listItems(t) ?? []) addDom(x); };
  for (const f of facts) f.args.forEach(addDom);
  const termsOf = (l) => l.kind === "pos" || l.kind === "neg" ? l.args : l.kind === "in" ? [l.item, l.list] : l.kind === "matches" ? [l.item] : l.kind === "cmp" ? [l.left, l.right] : l.kind === "count" ? [l.variable, l.result] : [];
  for (const l of allLits) termsOf(l).forEach(addDom);
  for (const r of program.rules) r.head.forEach(addDom);
  for (const { o, choose } of oracles.values()) if (choose) o.labels.forEach((x) => addDom({ kind: "atom", name: x }));
  const maxCount = domain.size + 1;
  for (let n = 0; n <= maxCount; n += 1) domain.set(String(n), num(n));
  const domainTerms = [...domain.values()];

  const ins = new Map(), mats = new Map();
  const lit = (l) => {
    switch (l.kind) {
      case "pos": case "neg": {
        const o = oracles.get(l.predicate);
        return `${l.kind === "neg" ? "not " : ""}${atomText(o ? `o${o.i}` : P(l.predicate), l.args.map(T))}`;
      }
      case "in": { if (!ins.has(l)) ins.set(l, ins.size); return `in${ins.get(l)}(${T(l.item)},${T(l.list)})`; }
      case "matches": { if (!mats.has(l)) mats.set(l, mats.size); return `${l.negated ? "not " : ""}m${mats.get(l)}(${T(l.item)})`; }
      case "cmp": return `${T(l.left)} ${{ "=<": "<=", "=:=": "=", "=\\=": "!=" }[l.op] ?? l.op} ${T(l.right)}`;
      case "count": {
        if (l.goal.some((g) => g.kind === "count")) throw new Unsupported("S3: nested count");
        return `${T(l.result)} = #count { ${T(l.variable)} : ${l.goal.map(lit).join(", ")} }`;
      }
    }
    throw new Unsupported(`S3: literal kind ${l.kind}`);
  };

  // relaxed reading: positive atoms only (possibly true)
  const rlit = (l) => {
    switch (l.kind) {
      case "pos": {
        const o = oracles.get(l.predicate);
        if (o) return o.choose ? [`label${o.i}(${T(l.args[labelIndex(o.o)])})`] : [];
        return [atomText(derived.has(l.predicate) ? `r_${P(l.predicate)}` : P(l.predicate), l.args.map(T))];
      }
      case "in": lit(l); return [`in${ins.get(l)}(${T(l.item)},${T(l.list)})`];
      case "matches": lit(l); return l.negated ? [] : [`m${mats.get(l)}(${T(l.item)})`];
      case "count": return l.result.kind === "var" ? [`cdom(${T(l.result)})`] : [];
      default: return []; // neg, cmp: possibly true
    }
  };
  const guard = (head, headVars, rl) => {
    const bound = new Set(rl.flatMap((a) => [...a.matchAll(/V_[A-Za-z0-9_]+/g)].map((m) => m[0])));
    const extra = [...headVars].map(V).filter((v) => !bound.has(v)).map((v) => `cdom(${v})`);
    const body = [...rl, ...extra];
    return body.length ? `${head} :- ${body.join(", ")}.` : `${head}.`;
  };
  const relaxed = domainTerms.map((t) => `cdom(${C(t)}).`);
  const occurrences = (conj, outer = []) => {
    conj.forEach((l, i) => {
      const others = [...outer, ...conj.filter((_, j) => j !== i)];
      if ((l.kind === "pos" || l.kind === "neg") && oracles.has(l.predicate)) {
        const o = oracles.get(l.predicate), inputs = o.o.inputs.map((k) => l.args[k]);
        const rl = others.flatMap(rlit);
        relaxed.push(guard(atomText(`rdom${o.i}`, inputs.map(T)), new Set(inputs.flatMap((t) => [...varsOf(t)])), rl));
      }
      if (l.kind === "count") occurrences(l.goal, others);
    });
  };

  const ruleText = program.rules.map((r) => { const b = r.body.map(lit); return `${atomText(P(r.predicate), r.head.map(T))}${b.length ? ` :- ${b.join(", ")}` : ""}.`; });
  const consText = [], shows = [], meta = [];
  const nogoBody = [], warnIds = [];
  program.constraints.forEach((c, k) => {
    const vars = [...new Set(c.forall.flatMap((l) => l.kind === "count" ? [...varsOf(l.result)] : termsOf(l).flatMap((t) => [...varsOf(t)])))];
    const vs = vars.map(V), b = atomText(`bind${k}`, vs), g = atomText(`g${k}`, vs), bad = atomText(`bad${k}`, vs);
    const forall = c.forall.map(lit), goal = c.goal.map(lit);
    consText.push(forall.length ? `${b} :- ${forall.join(", ")}.` : `${b}.`);
    // rb: the relaxed forall (every binding any answer set could have); used for UNSAT rows and defect (a)
    const rb = atomText(`rb${k}`, vs);
    relaxed.push(guard(rb, new Set(vars), c.forall.flatMap(rlit)));
    if (defect === "ignore-body") {
      // the goal alone, over the relaxed forall domain: B is never consulted
      consText.push(`${g} :- ${[rb, ...goal].join(", ")}.`);
      consText.push(c.mode === "require" ? `${bad} :- ${b}, not ${g}.` : `${bad} :- ${b}, ${g}.`);
      consText.push(c.mode === "require" ? `gbad${k}(${vs.join(",")}) :- ${rb}, not ${g}.` : `gbad${k}(${vs.join(",")}) :- ${g}.`);
      shows.push(`#show gbad${k}/${vs.length}.`);
    } else {
      consText.push(`${g} :- ${[b, ...goal].join(", ")}.`);
      consText.push(c.mode === "require" ? `${bad} :- ${b}, not ${g}.` : `${bad} :- ${g}.`);
    }
    if (c.nonempty) { consText.push(`pop${k} :- ${b}.`); shows.push(`#show pop${k}/0.`); }
    shows.push(`#show bind${k}/${vs.length}.`, `#show bad${k}/${vs.length}.`);
    // per-answer-set verdict atoms (joint verdict)
    const viol = [`viol${k} :- ${bad}.`, ...(c.nonempty ? [`viol${k} :- not pop${k}.`] : [])];
    consText.push(...viol);
    if (c.severity === "error") nogoBody.push(`nogo :- viol${k}.`);
    if (c.severity === "warning") warnIds.push({ k, w: c.weight });
    meta.push({ c, vars, k });
  });
  consText.push(...nogoBody);
  const total = warnIds.reduce((n, x) => n + x.w, 0);
  if (total > 0) {
    consText.push(...warnIds.map(({ k }) => `wok${k} :- not viol${k}.`));
    const T1000 = Math.round(program.warningThreshold * total * 1000);
    consText.push(`review :- not nogo, S = #sum { ${warnIds.map(({ k, w }) => `${Math.round(w * 1000)},${k} : wok${k}`).join("; ")} }, S < ${T1000}.`);
  }
  shows.push("#show nogo/0.", "#show review/0.");

  for (const r of program.rules) {
    relaxed.push(guard(atomText(`r_${P(r.predicate)}`, r.head.map(T)), new Set(r.head.flatMap((t) => [...varsOf(t)])), r.body.flatMap(rlit)));
    occurrences(r.body);
  }
  // B and G are separate conjunctions: a forall atom's guard is the forall alone (B is evaluated
  // whatever G is); a goal atom's guard may use the forall too (g requires bind).
  for (const c of program.constraints) { occurrences(c.forall); occurrences(c.goal, c.forall); }

  // pre-evaluated builtins
  const lines = [];
  const lists = domainTerms.filter((t) => listItems(t) !== undefined);
  for (const [l, k] of ins) {
    for (const L of groundTerm(l.list) ? [l.list] : lists) for (const x of listItems(L) ?? []) lines.push(`in${k}(${C(x)},${C(L)}).`);
  }
  for (const [l, k] of mats) for (const t of domainTerms) {
    const text = t.kind === "atom" ? t.name : t.kind === "number" ? String(t.value) : t.kind === "string" ? t.value : null;
    if (text !== null && l.regex.test(text)) lines.push(`m${k}(${C(t)}).`);
  }
  for (const f of facts) {
    if (oracles.has(f.pred) || derived.has(f.pred)) throw new Unsupported(`S3: fact for a non-base predicate ${f.pred}`);
    lines.push(`${atomText(P(f.pred), f.args.map(C))}.`);
  }

  const externals = [];
  const fullArgs = (o, ins, label) => { const a = []; o.inputs.forEach((p, j) => { a[p] = ins[j]; }); if (label !== undefined) a[labelIndex(o)] = label; return a; };
  for (const { o, i, choose } of oracles.values()) {
    const xs = o.inputs.map((_, j) => `X${j}`);
    if (choose) {
      for (const lab of o.labels) externals.push(`label${i}(${C({ kind: "atom", name: lab })}).`);
      externals.push(`#external ${atomText(`o${i}`, fullArgs(o, xs, "L"))} : ${atomText(`rdom${i}`, xs)}, label${i}(L). [free]`);
      if (!noExclusivity) externals.push(`:- ${atomText(`rdom${i}`, xs)}, not 1 { ${atomText(`o${i}`, fullArgs(o, xs, "L"))} : label${i}(L) } 1.`);
    } else {
      externals.push(`#external ${atomText(`o${i}`, xs)} : ${atomText(`rdom${i}`, xs)}. [free]`);
    }
    shows.push(`#show rdom${i}/${o.inputs.length}.`);
  }

  const text = ["% S3 translation (kernel3/subject-clingo.mjs)", ...lines, ...relaxed, ...externals, ...ruleText, ...consText, ...shows].join("\n") + "\n";
  const relaxedText = [...lines, ...relaxed, ...meta.map(({ vars, k }) => `#show rb${k}/${vars.length}.`)].join("\n") + "\n";
  return { text, relaxedText, C, back, backF, oracles, labelIndex, fullArgs, meta };
}

// ---- evaluation -------------------------------------------------------------------------------------
/** A clingo output atom/term `name(arg,...)` (nested functions allowed) -> { name, args: [subtrees], text }. */
function parseAtom(s) {
  let i = 0;
  const term = () => {
    const start = i;
    while (i < s.length && !"(),".includes(s[i])) i += 1;
    const name = s.slice(start, i), args = [];
    if (s[i] === "(") { i += 1; for (;;) { args.push(term()); if (s[i] === ",") { i += 1; continue; } i += 1; break; } }
    return { name, args, text: s.slice(start, i) };
  };
  return term();
}
const rowSig = (statuses) => JSON.stringify(Object.keys(statuses).sort().map((id) => [id, statuses[id].filter((x) => x.status !== "satisfied").map((x) => JSON.stringify(Object.keys(x).sort().map((k) => [k, String(x[k])]))).sort()]));

function evaluate(program, tr, answers, { demand = true, defect } = {}) {
  const { C, back, backF, oracles, meta } = tr;
  const s0 = stats.solves;
  const toTerm = (n) => n.args.length ? { kind: "compound", functor: backF.get(n.name), args: n.args.map(toTerm) } : /^-?\d+$/.test(n.name) ? num(Number(n.name)) : back.get(n.name);
  const ans = new Map(Object.entries(answers).map(([k, v]) => [normalizeAtom(k), String(v)]));
  const fixLine = (o, i, inputs, label) => {
    const choose = o.inputs.length < o.arity;
    if (!choose) return label === "holds" ? `${atomText(`o${i}`, inputs)}.` : label === "fails" ? `:- ${atomText(`o${i}`, inputs)}.` : "";
    if (!o.labels.includes(label)) return ""; // `unknown` / undeclared: free
    return `:- ${atomText(`rdom${i}`, inputs)}, not ${atomText(`o${i}`, tr.fullArgs(o, inputs, C({ kind: "atom", name: label })))}.`;
  };
  const fixes = [];
  for (const [k, label] of ans) {
    const open = k.indexOf("("), entry = oracles.get(open < 0 ? k : k.slice(0, open));
    if (!entry) continue;
    fixes.push(fixLine(entry.o, entry.i, (open < 0 ? [] : parseTerm(`x${k.slice(open)}`).args).map(C), label));
  }
  const base = tr.text + fixes.join("\n") + "\n";

  const read = (cautious, brave) => {
    const statuses = {}, states = [];
    for (const { c, vars, k } of meta) {
      const rows = [], st = [];
      for (const a of brave) {
        const { name, args } = parseAtom(a);
        if (name !== `bind${k}`) continue;
        const bad = atomText(defect === "ignore-body" ? `gbad${k}` : `bad${k}`, args.map((x) => x.text));
        const status = cautious.has(bad) ? "violated" : !brave.has(bad) ? "satisfied" : "undetermined";
        rows.push({ ...Object.fromEntries(vars.map((v, j) => [v, plain(toTerm(args[j]))])), status }); st.push(status);
      }
      if (c.nonempty && !cautious.has(`pop${k}`)) {
        const status = brave.has(`pop${k}`) ? "undetermined" : "violated";
        rows.push({ population: status === "violated" ? "empty" : "undetermined", status }); st.push(status);
      }
      statuses[c.id] = rows; states.push({ c, states: st });
    }
    const errors = states.filter((s) => s.c.severity === "error"), warnings = states.filter((s) => s.c.severity === "warning");
    const total = warnings.reduce((n, s) => n + s.c.weight, 0);
    const sat = warnings.filter((s) => s.states.every((x) => x === "satisfied")).reduce((n, s) => n + s.c.weight, 0);
    const verdict = errors.some((s) => s.states.includes("violated")) ? "NO-GO"
      : errors.some((s) => s.states.includes("undetermined")) || (total > 0 && sat / total < program.warningThreshold) ? "NEEDS-REVIEW" : "PASS";
    const joint = cautious.has("nogo") ? "NO-GO" : cautious.has("review") ? "NEEDS-REVIEW" : !brave.has("nogo") && !brave.has("review") ? "PASS" : "mixed";
    const rdom = [...cautious].map(parseAtom).filter((a) => /^rdom\d+$/.test(a.name));
    return { statuses, verdict, joint, rdom };
  };
  const run = (text) => { const c = solve(text, "cautious"); return c ? read(c, solve(text, "brave")) : null; };

  const here = run(base);
  if (!here) {
    if (defect === "unsat-vacuous") return { unsat: true, statuses: Object.fromEntries(program.constraints.map((c) => [c.id, []])), demand: { full: [], prefix: [] }, verdict: "PASS", joint: "PASS", externals: 0, solves: stats.solves - s0 };
    // rows: the relaxed forall instances (an over-approximation of the bindings), all undetermined
    const rel = solve(tr.relaxedText, "cautious") ?? new Set();
    const statuses = {};
    for (const { c, vars, k } of meta) {
      statuses[c.id] = [...rel].map(parseAtom).filter((a) => a.name === `rb${k}`).map((a) => ({ ...Object.fromEntries(vars.map((v, j) => [v, plain(toTerm(a.args[j]))])), status: "undetermined" }));
      if (c.nonempty) statuses[c.id].push({ population: "undetermined", status: "undetermined" });
    }
    return { unsat: true, statuses, demand: { full: [], prefix: [] }, verdict: "NEEDS-REVIEW", joint: "unsat", externals: 0, solves: stats.solves - s0 };
  }
  const full = [];
  const byIndex = new Map([...oracles.values()].map((e) => [e.i, e]));
  const candidates = here.rdom.map((a) => {
    const { o, i } = byIndex.get(Number(a.name.slice(4)));
    const inputs = a.args.map((x) => x.text), inputTerms = a.args;
    const atomKey = inputs.length ? `${o.predicate}(${inputTerms.map((x) => key(toTerm(x))).join(",")})` : o.predicate;
    return { o, i, inputs, atomKey };
  });
  const free = candidates.filter((x) => !ans.has(normalizeAtom(x.atomKey)));
  const freeUnknown = candidates.filter((x) => ans.has(normalizeAtom(x.atomKey)) && !fixLine(x.o, x.i, x.inputs, ans.get(normalizeAtom(x.atomKey))));
  if (demand && Object.values(here.statuses).flat().some((x) => x.status === "undetermined")) {
    const sig = rowSig(here.statuses);
    for (const { o, i, inputs, atomKey } of free) {
      for (const label of o.inputs.length < o.arity ? o.labels : ["holds", "fails"]) {
        const r = run(`${base}${fixLine(o, i, inputs, label)}\n`);
        if (!r || rowSig(r.statuses) !== sig) { full.push(atomKey); break; }
      }
    }
  }
  return { statuses: here.statuses, demand: { full: full.sort(), prefix: [] }, verdict: here.verdict, joint: here.joint,
    externals: free.length, unknownFree: freeUnknown.length, solves: stats.solves - s0 };
}
export { rowSig };
