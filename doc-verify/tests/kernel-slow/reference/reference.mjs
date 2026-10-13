// Naive reference evaluator for docs/doc-verify-model.md, stratified fragment (kernel-trials
// round 2). Derived from the model alone; doc-verify's evaluate.ts is neither read nor imported.
// The module parser (compileModule) is reused for syntax only. Clarity over speed throughout.
import { readFileSync } from "node:fs";
import YAML from "../../../../node_modules/yaml/dist/index.js";
import { compileModule } from "../../../dist/engine/index.js";
import { loadModule } from "../../../dist/engine/module.js";
import { atom, num, list, listItems, key, plain, parseFact, normalizeAtom } from "./terms.mjs";

// §2 truth values, ordered by truth for Kleene conjunction (min) and disjunction (max).
export const F = 0, U = 1, T = 2;

// ---- substitution and matching (syntax plumbing) -------------------------------------------
const subst = (t, th) => t.kind === "var" ? (t.name !== "_" && th.has(t.name) ? th.get(t.name) : t)
  : t.kind === "compound" ? { ...t, args: t.args.map((a) => subst(a, th)) } : t;
function unify(p, g, th) { // p may hold variables, g is ground
  if (p.kind === "var") {
    if (p.name === "_") return th;
    if (th.has(p.name)) return key(th.get(p.name)) === key(g) ? th : null;
    return new Map(th).set(p.name, g);
  }
  if (p.kind === "compound") {
    if (g.kind !== "compound" || g.functor !== p.functor || g.args.length !== p.args.length) return null;
    for (let i = 0; i < p.args.length && th; i += 1) th = unify(p.args[i], g.args[i], th);
    return th;
  }
  return key(p) === key(g) ? th : null;
}
const ground = (t) => t.kind !== "var" && (t.kind !== "compound" || t.args.every(ground));
const unifyAll = (ps, gs, th) => ps.reduce((acc, p, i) => acc && unify(p, gs[i], acc), th);
const range = (t) => t.kind === "interval" ? [t.lo, t.hi] : t.kind === "number" ? [t.value, t.value] : null;
const CMP = { "<": (a, b) => a < b, ">": (a, b) => a > b, "=<": (a, b) => a <= b, ">=": (a, b) => a >= b, "=:=": (a, b) => a === b, "=\\=": (a, b) => a !== b };

export function writeLiteral(l, th) {
  const w = (t) => key(subst(t, th));
  switch (l.kind) {
    case "pos": return `${l.predicate}(${l.args.map(w).join(",")})`;
    case "neg": return `not ${l.predicate}(${l.args.map(w).join(",")})`;
    case "in": return `${w(l.item)} in ${w(l.list)}`;
    case "matches": return `${l.negated ? "not " : ""}matches(${w(l.item)},${key(atom(l.pattern))})`;
    case "cmp": return `${w(l.left)}${l.op}${w(l.right)}`;
    case "count": return `count(${w(l.variable)},(${l.goal.map((g) => writeLiteral(g, th)).join(",")}),${w(l.result)})`;
    case "present": return `present(${w(l.document)},${w(l.candidates)},${w(l.present)})`;
  }
}

/** Evaluates one document dump under one answer state. Returns statuses, demand, verdict, missing. */
export function evaluateWitnessStep(program, facts, answers) {
  const oracles = new Map(program.oracles.map((o) => [o.predicate, o]));
  const rulesOf = new Map();
  for (const r of program.rules) rulesOf.set(r.predicate, [...(rulesOf.get(r.predicate) ?? []), r]);
  const factsOf = new Map();
  for (const f of facts) factsOf.set(f.pred, [...(factsOf.get(f.pred) ?? []), f.args]);
  const ans = new Map([...answers].map(([k, v]) => [normalizeAtom(k), v]));
  const final = new Map(); // derived predicate -> Map(atom key -> {args, val}); only t and u stored
  let current = null;      // during a stratum's fixpoint: {preds, table} read as the bound under construction

  // §1/§2 leaf valuation of label atom o(i, l): t if ans = l, f if another label, u if unanswered/unknown.
  const atomKey = (o, inputs) => `${o.predicate}(${inputs.map(key).join(",")})`;
  const leaf = (o, inputs, label) => {
    const a = ans.get(atomKey(o, inputs));
    return a === undefined || a === "unknown" ? U : a === label ? T : F;
  };
  const isChoose = (o) => o.inputs.length < o.arity;

  // The value of a ground atom (used by `not`, whose argument is ground; §8's static check).
  function valueOf(pred, args) {
    const o = oracles.get(pred);
    if (o) {
      const why = { oracle: atomKey(o, o.inputs.map((i) => args[i])) };
      return [leaf(o, o.inputs.map((i) => args[i]), isChoose(o) ? args[o.arity - 1].name : "holds"), why];
    }
    if (rulesOf.has(pred)) {
      const table = current?.preds.has(pred) ? current.table.get(pred) : final.get(pred);
      return [table?.get(key({ kind: "compound", functor: pred, args }))?.val ?? F, { atom: pred, args }];
    }
    return [(factsOf.get(pred) ?? []).some((g) => key(list(g)) === key(list(args))) ? T : F, null];
  }

  // Every way one literal holds under th, as [th', value, why]; why names what a u value rests on.
  function* literal(l, th) {
    switch (l.kind) {
      case "pos": {
        const o = oracles.get(l.predicate);
        if (o) { // a choose oracle with an unbound label ranges over its label atoms (§1)
          const inputs = o.inputs.map((i) => subst(l.args[i], th));
          for (const label of isChoose(o) ? o.labels : ["holds"]) {
            const th2 = isChoose(o) ? unify(l.args[o.arity - 1], atom(label), th) : th;
            if (th2) yield [th2, leaf(o, inputs, label), { oracle: atomKey(o, inputs) }];
          }
        } else if (rulesOf.has(l.predicate)) {
          const table = current?.preds.has(l.predicate) ? current.table.get(l.predicate) : final.get(l.predicate);
          for (const { args, val } of table?.values() ?? []) {
            const th2 = unifyAll(l.args, args, th);
            if (th2) yield [th2, val, { atom: l.predicate, args }];
          }
        } else {
          for (const args of factsOf.get(l.predicate) ?? []) {
            const th2 = unifyAll(l.args, args, th);
            if (th2) yield [th2, T, null];
          }
        }
        return;
      }
      case "neg": { // Kleene negation of a lower-stratum (or leaf) value
        const [v, why] = valueOf(l.predicate, l.args.map((a) => subst(a, th)));
        yield [th, T - v, why];
        return;
      }
      case "in": case "cmp": { // §3: on an interval, t if it holds for every value, f for none, u otherwise
        const pairs = [];
        if (l.kind === "in") {
          const item = subst(l.item, th), r = range(item), items = listItems(subst(l.list, th)).map(key);
          if (!r) { yield [th, items.includes(key(item)) ? T : F, null]; return; }
          for (let a = r[0]; a <= r[1]; a += 1) pairs.push(items.includes(String(a)));
          yield [th, pairs.every(Boolean) ? T : pairs.some(Boolean) ? U : F, intervals([item])]; return;
        }
        const left = subst(l.left, th), right = subst(l.right, th), [a0, a1] = range(left), [b0, b1] = range(right);
        for (let a = a0; a <= a1; a += 1) for (let b = b0; b <= b1; b += 1) pairs.push(CMP[l.op](a, b));
        yield [th, pairs.every(Boolean) ? T : pairs.some(Boolean) ? U : F, intervals([left, right])];
        return;
      }
      case "matches": { // §3: t/f on a bound atomic X, u on an interval; a list is not text
        const item = subst(l.item, th);
        if (item.kind === "interval") { yield [th, U, intervals([item])]; return; }
        const text = item.kind === "atom" ? item.name : item.kind === "number" ? String(item.value) : item.kind === "string" ? item.value : null;
        const hit = text !== null && l.regex.test(text);
        yield [th, hit !== l.negated ? T : F, null];
        return;
      }
      case "count": { // §3 aggregate: [c, p], c = #V with G = t, p = #V with G != f
        const best = new Map();
        for (const s of solve(l.goal, th)) {
          const v = key(subst(l.variable, s.th)), b = best.get(v) ?? { val: F, trails: [] };
          b.val = Math.max(b.val, s.val);
          if (s.val === U) b.trails.push(s.trail);
          best.set(v, b);
        }
        const c = [...best.values()].filter((b) => b.val === T).length, p = best.size;
        const residual = [...best.values()].filter((b) => b.val === U).flatMap((b) => b.trails);
        const n = c === p ? num(c) : { kind: "interval", lo: c, hi: p, residual };
        const th2 = unify(l.result, n, th);
        if (th2) yield [th2, T, null];
        return;
      }
      case "present": { // derived over node facts: the candidates D has, in document order
        const d = subst(l.document, th);
        const sections = (factsOf.get("core::section") ?? []).filter((g) => key(g[0]) === key(d)).map((g) => key(g[1]));
        const order = (c) => (factsOf.get("core::order") ?? []).find((g) => key(g[0]) === key(d) && key(g[1]) === key(c))?.[2].value ?? 0;
        const present = listItems(l.candidates).filter((c) => sections.includes(key(c))).sort((a, b) => order(a) - order(b));
        const th2 = present.length > 0 ? unify(l.present, list(present), th) : null;
        if (th2) yield [th2, T, null];
        return;
      }
    }
  }
  const intervals = (ts) => ts.some((t) => t.kind === "interval") ? { intervals: ts.filter((t) => t.kind === "interval") } : null;

  // A conjunction left to right; Kleene min; derivations with value f are dropped. The trail
  // records each u literal (in source order) with what it rests on, for §6 and §7.
  function* solve(lits, th, i = 0, val = T, trail = []) {
    if (i === lits.length) { yield { th, val, trail }; return; }
    for (const [th2, v, why] of literal(lits[i], th)) {
      if (v === F) continue;
      yield* solve(lits, th2, i + 1, Math.min(val, v), v === U ? [...trail, { lit: lits[i], th: th2, why }] : trail);
    }
  }
  const best = (sols) => sols.reduce((m, s) => Math.max(m, s.val), F);

  // §3 for stratified programs: strata by the usual rule (pos >=, not/count >), then per stratum
  // two fixpoints. Certain bound: a body counts when it is t (unknown leaves read false, `not`
  // reads the possible bound of lower strata). Possible bound: a body counts when it is not f.
  const derived = [...rulesOf.keys()], level = new Map(derived.map((p) => [p, 0]));
  const deps = (lits, strict) => lits.flatMap((l) => l.kind === "count" ? deps(l.goal, true)
    : (l.kind === "pos" || l.kind === "neg") && rulesOf.has(l.predicate) ? [[l.predicate, strict || l.kind === "neg"]] : []);
  for (let changed = true, rounds = 0; changed; rounds += 1) {
    if (rounds > derived.length + 1) throw new Error("program is not stratified (round 3 territory)");
    changed = false;
    for (const r of program.rules) for (const [q, strict] of deps(r.body, false)) {
      const need = level.get(q) + (strict ? 1 : 0);
      if (level.get(r.predicate) < need) { level.set(r.predicate, need); changed = true; }
    }
  }
  for (const lv of [...new Set(level.values())].sort((a, b) => a - b)) {
    const preds = new Set(derived.filter((p) => level.get(p) === lv));
    const fixpoint = (accept) => {
      current = { preds, table: new Map([...preds].map((p) => [p, new Map()])) };
      for (let changed = true; changed;) {
        changed = false;
        for (const p of preds) for (const r of rulesOf.get(p)) for (const s of solve(r.body, new Map())) {
          if (!accept(s.val)) continue;
          const args = r.head.map((h) => subst(h, s.th));
          if (args.some((a) => a.kind === "interval")) throw new Error(`${p}: an undecided count reaches a rule head`);
          const k = key({ kind: "compound", functor: p, args }), table = current.table.get(p);
          if (!table.has(k)) { table.set(k, { args, val: T }); changed = true; }
        }
      }
      const { table } = current; current = null; return table;
    };
    const certain = fixpoint((v) => v === T), possible = fixpoint((v) => v !== F);
    for (const p of preds) final.set(p, new Map([...possible.get(p)].map(([k, e]) => [k, { args: e.args, val: certain.get(p).has(k) ? T : U }])));
  }

  // §6 residual derivations: of a u derived atom, its rule instances whose body is u; of an
  // interval, the derivations of its u tuples. An oracle leaf is where the walk stops.
  const residualMemo = new Map();
  function residual(why) {
    if (why.intervals) return why.intervals.flatMap((iv) => iv.residual);
    const k = key({ kind: "compound", functor: why.atom, args: why.args });
    if (residualMemo.has(k)) return residualMemo.get(k) ?? []; // cycle guard
    residualMemo.set(k, undefined);
    const out = [];
    for (const r of rulesOf.get(why.atom) ?? []) {
      const th = unifyAll(r.head, why.args, new Map());
      if (th) for (const s of solve(r.body, th)) if (s.val === U) out.push(s.trail);
    }
    residualMemo.set(k, out);
    return out;
  }
  const full = (trail, out) => { for (const e of trail) e.why.oracle ? out.add(e.why.oracle) : residual(e.why).forEach((t) => full(t, out)); };
  // prefix (§6 re-amended): per residual derivation, the first leaf in source order that is not
  // asked; asked leaves are skipped with fall-through, so prefix is empty exactly when full is.
  const prefix = (trail, out) => {
    for (const e of trail) {
      if (e.why.oracle) { if (!ans.has(e.why.oracle)) { out.add(e.why.oracle); return true; } continue; }
      if (residual(e.why).map((t) => prefix(t, out)).some(Boolean)) return true;
    }
    return false;
  };

  // §4 statuses (amended table), §6 demand, §7 missing literal, per constraint.
  const unresolvable = [], statuses = {}, missing = {}, demandFull = new Set(), demandPrefix = new Set(), summary = [];
  const demand = (trails) => { for (const t of trails) { full(t, demandFull); prefix(t, demandPrefix); } };
  for (const c of program.constraints) {
    const bindings = new Map(); // a binding is a forall instance with Bθ != f
    for (const s of solve(c.forall, new Map())) {
      const k = [...s.th].map(([n, v]) => `${n}=${key(v)}`).sort().join(",");
      const b = bindings.get(k) ?? { th: s.th, val: F, sols: [] };
      b.val = Math.max(b.val, s.val); b.sols.push(s); bindings.set(k, b);
    }
    const uTrails = (sols) => sols.filter((s) => s.val === U).map((s) => s.trail);
    statuses[c.id] = [];
    const states = [];
    for (const b of bindings.values()) {
      const goal = [...solve(c.goal, b.th)], g = best(goal);
      const holds = c.mode === "require" ? T : F, fails = T - holds;
      // require: satisfied iff Gθ = t (whatever Bθ); violated iff Bθ = t and Gθ = f. forbid dually.
      const status = g === holds ? "satisfied" : b.val === T && g === fails ? "violated" : "undetermined";
      const row = Object.fromEntries([...b.th].map(([n, v]) => [n, plain(v)]));
      statuses[c.id].push({ ...row, status });
      states.push(status);
      // §6 support: leaves of residual derivations of the forall instance (if u) and of the goal instance (if u).
      if (status === "undetermined") {
        const trails = [...(b.val === U ? uTrails(b.sols) : []), ...(g === U ? uTrails(goal) : [])], own = new Set();
        demand(trails); trails.forEach((t) => full(t, own));
        // §6: a binding whose support minus asked(ans) is empty is unresolvable (demands nothing).
        if ([...own].every((a) => ans.has(a))) unresolvable.push({ constraint: c.id, ...row });
      }
      if (status === "violated" && c.mode === "require") (missing[c.id] ??= []).push({ ...row, ...missingLiteral(c.goal, b.th) });
    }
    if (c.nonempty && bindings.size === 0) { statuses[c.id].push({ population: "empty", status: "violated" }); states.push("violated"); }
    if (c.nonempty && bindings.size > 0 && [...bindings.values()].every((b) => b.val === U)) {
      // §4: a nonempty population whose every binding is u is undetermined; it rests on the forall leaves.
      statuses[c.id].push({ population: "undetermined", status: "undetermined" }); states.push("undetermined");
      demand([...bindings.values()].flatMap((b) => uTrails(b.sols)));
    }
    summary.push({ c, states });
  }

  // §7 source order for the walk: a derived literal's instances come clause by clause in module
  // order, each body enumerated left to right with facts in dump order, recursively; values are the
  // model's (final). A call already on the stack is skipped (recursion); instances only reachable
  // that way follow in table order, so the list is complete.
  function* orderedSolve(lits, th, stack, i = 0, val = T) {
    if (i === lits.length) { yield { th, val }; return; }
    for (const [th2, v] of ordered(lits[i], th, stack)) if (v !== F) yield* orderedSolve(lits, th2, stack, i + 1, Math.min(val, v));
  }
  function* ordered(l, th, stack = new Set()) {
    if (l.kind !== "pos" || !rulesOf.has(l.predicate)) { yield* literal(l, th); return; }
    const args = l.args.map((a) => subst(a, th)), call = `${l.predicate}(${args.map((a) => ground(a) ? key(a) : "_").join(",")})`;
    const seen = new Set(), emit = function* (g) {
      const k = key(list(g)), th2 = unifyAll(l.args, g, th);
      if (seen.has(k) || !th2) return;
      seen.add(k); yield [th2, ...valueOf(l.predicate, g)];
    };
    if (!stack.has(call)) {
      stack.add(call);
      for (const r of rulesOf.get(l.predicate)) {
        const th0 = r.head.reduce((acc, h, i) => acc && (ground(args[i]) ? unify(h, args[i], acc) : acc), new Map());
        if (th0) for (const s of [...orderedSolve(r.body, th0, stack)]) yield* emit(r.head.map((h) => subst(h, s.th)));
      }
      stack.delete(call);
    }
    for (const { args: g } of final.get(l.predicate)?.values() ?? []) yield* emit(g);
  }

  // §7 missing literal by descent: walk Gθ left to right; t binds and passes, u is noted and passes,
  // the first f is the answer unless it is a derived atom, whose first clause is entered with the
  // head bound. Reports the literal, the clause path and the u literals passed.
  function missingLiteral(goal, th, path = [], passed = []) {
    for (const l of goal) {
      const sols = [...ordered(l, th)], t = sols.find((s) => s[1] === T), u = sols.find((s) => s[1] === U);
      if (t) { th = t[0]; continue; }
      if (u) { passed.push(writeLiteral(l, u[0])); th = u[0]; continue; }
      if (l.kind === "pos" && rulesOf.has(l.predicate)) {
        const clause = rulesOf.get(l.predicate)[0], args = l.args.map((a) => subst(a, th));
        const head = new Map(clause.head.flatMap((h, i) => h.name !== "_" && ground(args[i]) ? [[h.name, args[i]]] : []));
        return missingLiteral(clause.body, head, [...path, `${writeLiteral(l, th)}#1`], passed);
      }
      return { literal: writeLiteral(l, th), ...(path.length ? { path } : {}), ...(passed.length ? { passed_u: passed } : {}) };
    }
    throw new Error("missing-literal walk found no f literal in a goal valued f");
  }

  // §5 verdict (BLOCKED is not reachable: the reference always finishes).
  const errors = summary.filter((s) => s.c.severity === "error"), warnings = summary.filter((s) => s.c.severity === "warning");
  const total = warnings.reduce((n, s) => n + s.c.weight, 0);
  const satisfied = warnings.filter((s) => s.states.every((x) => x === "satisfied")).reduce((n, s) => n + s.c.weight, 0);
  const verdict = errors.some((s) => s.states.includes("violated")) ? "NO-GO"
    : errors.some((s) => s.states.includes("undetermined")) || (total > 0 && satisfied / total < program.warningThreshold) ? "NEEDS-REVIEW" : "PASS";
  // §1/§6 (re-amended): Dem = residual leaves minus asked(ans); an `unknown` answer counts as asked.
  const notAsked = (set) => [...set].filter((a) => !ans.has(a)).sort();
  return { statuses, demand: { full: notAsked(demandFull), prefix: notAsked(demandPrefix) }, verdict, missing, unresolvable, values: final };
}

// §8 static checks, on the parsed (unchecked) module: every negated goal is ground when reached
// (`_` counts as unbound) and every `matches` operand is bound when reached, reading bodies left to right.
export function staticCheck(parsed) {
  const issues = [];
  const vars = (t, out = []) => { if (t.kind === "var") out.push(t.name); if (t.kind === "compound") t.args.forEach((a) => vars(a, out)); return out; };
  const conj = (t) => t.kind === "compound" && t.functor === "," ? [...conj(t.args[0]), ...conj(t.args[1])] : [t];
  const walk = (body, bound, where) => {
    for (const l of conj(body)) {
      const f = l.kind === "compound" ? l.functor : "";
      if ((f === "not" || f === "\\+") && l.args.length === 1) {
        const free = vars(l.args[0]).filter((v) => v === "_" || !bound.has(v));
        if (free.length) issues.push(`${where}: negated goal is not ground when reached (${free.join(", ")})`);
      } else if (f === "matches") {
        const free = vars(l.args[0]).filter((v) => v === "_" || !bound.has(v));
        if (free.length) issues.push(`${where}: matches operand is unbound when reached (${free.join(", ")})`);
      } else if (f === "count" && l.args.length === 3) { walk(l.args[1], new Set(bound), where); vars(l.args[2]).forEach((v) => bound.add(v)); }
      else if (f === "present" && l.args.length === 3) vars(l.args[2]).forEach((v) => bound.add(v));
      else if (!["<", ">", "=<", ">=", "=:=", "=\\=", "in"].includes(f)) vars(l).forEach((v) => bound.add(v));
    }
    return bound;
  };
  for (const r of parsed.rules) walk(r.body, new Set(), `rule ${r.text}`);
  for (const c of parsed.constraints) walk(c.goal, walk(c.forall, new Set(), `${c.id}.forall`), `${c.id}.goal`);
  return issues;
}

/** Loads a witness: the YAML, and either its compiled program and facts or the static rejection. */
export async function loadWitness(path) {
  const w = YAML.parse(readFileSync(path, "utf8"));
  if (w.gate === "corpus" || w.reference === "unsupported") return { witness: w };
  return { witness: w, ...(await loadProgram(w.module)), facts: (w.facts ?? []).map(parseFact) };
}

export async function loadProgram(moduleYaml) {
  try {
    const issues = staticCheck(await loadModule(moduleYaml));
    return issues.length ? { rejected: issues } : { program: await compileModule(moduleYaml) };
  } catch (e) { return { rejected: [`parser/checker: ${e.message}`] }; }
}
