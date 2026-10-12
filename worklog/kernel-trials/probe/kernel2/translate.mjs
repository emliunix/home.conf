// translate.mjs - a witness (probe/witnesses/FORMAT.md) as Prolog text for kernel2/core.pl.
//
// Mechanical: the design-04 module is parsed by doc-verify's own parser (compileModule, syntax
// only: the Program's rules/oracles/constraints as Literal/Term structures) and every literal is
// written as one Prolog goal. Author rules keep their clause structure, order and variables
// (writeTerm writes a variable D as _V_D). Nothing is optimised or reordered.
//
// Naming:
//   core.p(...)        -> core_p(...)              (base facts of the dump, two-valued)
//   module predicate   -> 'w::p'(...)              (tabled `as incremental`, one table per predicate)
//   oracle o (ask)     -> 'w::o'(Is) :- core_label('w::o'(Is), holds).          (untabled wrapper)
//   oracle k (choose)  -> 'w::k'(Is, L) :- core_choose('w::k'(Is), Labels, L).  (one label atom per label)
// Literals:
//   p(...)             -> the predicate as named above
//   not core.p(...)    -> core_naf(core_p(...))       base fact: groundness check, then \+
//   not w.p(...)       -> core_tnot('w::p'(...))      derived: groundness check, then tnot/1
//   not o(...)         -> core_not_label('w::o'(Is), Label)   oracle: negation at the leaf
//   X in L             -> memberchk(X, L)
//   matches(X, R)      -> core_matches(X, 'R')  /  not matches -> core_not_matches(X, 'R')
//   A op B             -> core_cmp(op, A, B)       (interval-aware, model §3)
//   count(V, G, N)     -> core_count(V, core_aux_k(Outer..., V), N), with
//                         core_aux_k(Outer..., V) :- G.  tabled; Outer = G's variables that occur
//                         elsewhere in the clause (the others are existential in G)
//   present(D, Cs, P)  -> core_present(D, Cs, P)
// The groundness rule (model §8): a negated goal is checked ground when it is reached, by
// core_naf/core_tnot/core_not_label in core.pl; an anonymous `_` inside a negation is therefore
// rejected when reached (strict reading of §8), never read as existential (F13).
import { readFileSync } from "node:fs";
import path from "node:path";
import { compileModule } from "../../../../doc-verify/dist/engine/index.js";
import { loadModule } from "../../../../doc-verify/dist/engine/module.js";
import { writeTerm, quoteAtom, readCanonical, variablesOf, listItems } from "../../../../doc-verify/dist/engine/terms.js";

const here = import.meta.dirname;
export const CORE_PL = process.env.KERNEL2_CORE ?? path.join(here, "core.pl");   // KERNEL2_CORE: seeded-defect runs only

/**
 * Compiles a module text. If the YAML is rejected only because a flow mapping holds an unquoted
 * value with a comma (`{ask: q, evidence: core.own(D, S)}`, as in FORMAT.md's own example), the
 * value is quoted mechanically and the compile retried; `repaired` says so.
 */
export async function compileWitnessModule(moduleYaml) {
  let text = moduleYaml, repaired = false, firstError;
  try {
    await loadModule(text);
  } catch (error) {
    const fixed = repairFlowMappings(text);
    if (fixed === text) throw error;
    text = fixed; repaired = true; firstError = String(error.message ?? error);
  }
  try {
    return { program: await compileModule(text), repaired, firstError, text };
  } catch (error) {
    // The design-04 checker refuses what the model allows (unstratified negation, an oracle
    // deeper than `rounds`) and what the model makes the KERNEL's check (a non-ground negation is
    // checked when reached, §8). The parser is reused for syntax only: the parsed terms are
    // resolved into the same Literal shapes here, without the design-04 semantic checks.
    const program = syntaxProgram(await loadModule(text));
    return { program, repaired, firstError, text, checkerRejected: String(error.message ?? error) };
  }
}

const COMPARISONS = new Set(["<", ">", "=<", ">=", "=:=", "=\\="]);
/** ParsedModule -> Program-shaped object (rules/oracles/constraints as checker Literals), syntax only. */
export function syntaxProgram(parsed) {
  const mod = parsed.source.module;
  const qualify = (n) => `${mod}::${n}`;
  const conj = (t) => t.kind === "compound" && t.functor === "," && t.args.length === 2 ? [...conj(t.args[0]), ...conj(t.args[1])] : [t];
  const resolve = (t) => {
    if (t.kind === "atom" && t.name === "true") return [];
    if (t.kind === "atom") return [{ kind: "pos", predicate: qualify(t.name), args: [] }];
    if ((t.functor === "not" || t.functor === "\\+") && t.args.length === 1) {
      const [inner] = resolve(t.args[0]);
      if (inner.kind === "matches") return [{ ...inner, negated: !inner.negated }];
      return [{ kind: "neg", predicate: inner.predicate, args: inner.args }];
    }
    if (t.functor === "matches" && t.args.length === 2) {
      const p = t.args[1].kind === "atom" ? t.args[1].name : t.args[1].value;
      return [{ kind: "matches", item: t.args[0], pattern: p, regex: new RegExp(p, "u"), negated: false }];
    }
    if (t.functor === "in" && t.args.length === 2) return [{ kind: "in", item: t.args[0], list: t.args[1] }];
    if (COMPARISONS.has(t.functor) && t.args.length === 2) return [{ kind: "cmp", op: t.functor, left: t.args[0], right: t.args[1] }];
    if (t.functor === "present" && t.args.length === 3) return [{ kind: "present", document: t.args[0], candidates: t.args[1], present: t.args[2] }];
    if (t.functor === "count" && t.args.length === 3) return [{ kind: "count", variable: t.args[0], goal: conj(t.args[1]).flatMap(resolve), result: t.args[2] }];
    if (t.functor === ":" && t.args.length === 2) {
      const [alias, c] = t.args;
      return [{ kind: "pos", predicate: `${alias.name}::${c.kind === "atom" ? c.name : c.functor}`, args: c.kind === "atom" ? [] : c.args }];
    }
    return [{ kind: "pos", predicate: qualify(t.functor), args: t.args }];
  };
  const body = (t) => conj(t).flatMap(resolve);
  const oracles = parsed.oracles.map((o) => {
    const params = o.head.args.map((a) => a.name);
    const choose = o.source.choose !== undefined;
    return { predicate: qualify(o.head.functor), arity: params.length, params,
      inputs: (choose ? params.slice(0, -1) : params).map((_, i) => i), labels: o.source.choose ?? ["holds", "fails"],
      ask: o.source.ask, threshold: o.source.threshold ?? 0, source: o.source };
  });
  const rules = parsed.rules.map((r) => ({ predicate: qualify(r.head.kind === "atom" ? r.head.name : r.head.functor), head: r.head.kind === "atom" ? [] : r.head.args, body: body(r.body), text: r.text }));
  const constraints = parsed.constraints.map((c) => ({ id: c.id, forall: body(c.forall), goal: body(c.goal), mode: c.mode,
    severity: c.source.severity, weight: c.source.weight ?? 1, message: c.source.message, repair: c.source.repair,
    profiles: c.source.profiles, nonempty: c.source.population === "nonempty", source: c.source }));
  return { module: mod, hash: parsed.hash, rounds: parsed.rounds, requestShape: parsed.requestShape,
    warningThreshold: parsed.source.warning_threshold ?? 0, rules, oracles, constraints, params: parsed.params, syntaxOnly: true };
}

function repairFlowMappings(text) {
  return text.split("\n").map((line) => {
    const m = /^(\s*[^{#]*:\s*)\{(.*)\}\s*$/.exec(line);
    if (!m) return line;
    const parts = [];
    let depth = 0, quote = null, cur = "";
    for (const ch of m[2]) {
      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === "(" || ch === "[") depth += 1;
      if (ch === ")" || ch === "]") depth -= 1;
      if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
      cur += ch;
    }
    parts.push(cur);
    const fixed = parts.map((p) => {
      const kv = /^(\s*[A-Za-z_]+:\s*)(.*?)\s*$/.exec(p);
      if (!kv || /^["'[{]/.test(kv[2]) || !/[(,]/.test(kv[2])) return p.trim();
      return `${kv[1].trim()} ${JSON.stringify(kv[2])}`;
    });
    return `${m[1]}{${fixed.join(", ")}}`;
  }).join("\n");
}

/** A witness fact `section(d, a, root)` (or `w::n(a)`) as a Term with a qualified functor. */
export function parseFactText(text) {
  const m = /^\s*([^(\s]*::[^(\s]*)\((.*)\)\s*$/.exec(text);
  if (m) return { kind: "compound", functor: m[1], args: readCanonical(`x(${m[2]})`).args };
  const t = readCanonical(text.trim());
  if (t.kind === "atom") return { kind: "compound", functor: `core::${t.name}`, args: [] };
  return { kind: "compound", functor: `core::${t.functor}`, args: t.args };
}

/** The Prolog name of a qualified predicate. */
export function predName(predicate) {
  return predicate.startsWith("core::") ? `core_${predicate.slice(6)}` : quoteAtom(predicate);
}
const call = (predicate, args) => args.length === 0 ? predName(predicate) : `${predName(predicate)}(${args.map(writeTerm).join(",")})`;

/** Translates a compiled Program plus fact Terms into Prolog text (consulted after core.pl). */
export function translateProgram(program, facts) {
  const out = [":- style_check(-singleton).", ":- style_check(-discontiguous).", ""];
  const oracles = new Map(program.oracles.map((o) => [o.predicate, o]));
  const derived = new Set(program.rules.map((r) => r.predicate));
  const aux = [];
  const auxTables = [];

  const literal = (lit, outerVars) => {
    switch (lit.kind) {
      case "pos": return call(lit.predicate, lit.args);
      case "neg": {
        const o = oracles.get(lit.predicate);
        if (o) {
          const choose = o.source.choose !== undefined;
          const inputs = choose ? lit.args.slice(0, -1) : lit.args;
          const label = choose ? writeTerm(lit.args.at(-1)) : "holds";
          return `core_not_label(${call(lit.predicate, inputs)},${label})`;
        }
        if (derived.has(lit.predicate)) return `core_tnot(${call(lit.predicate, lit.args)})`;
        return `core_naf(${call(lit.predicate, lit.args)})`;
      }
      case "in": return `memberchk(${writeTerm(lit.item)},${writeTerm(lit.list)})`;
      case "matches": return `${lit.negated ? "core_not_matches" : "core_matches"}(${writeTerm(lit.item)},${quoteAtom(lit.pattern)})`;
      case "cmp": return `core_cmp(${quoteAtom(lit.op)},${writeTerm(lit.left)},${writeTerm(lit.right)})`;
      case "present": return `core_present(${writeTerm(lit.document)},${writeTerm(lit.candidates)},${writeTerm(lit.present)})`;
      case "count": {
        const v = lit.variable.name;
        const inner = new Set();
        for (const g of lit.goal) for (const n of literalVars(g)) inner.add(n);
        const outer = [...inner].filter((n) => n !== v && outerVars.has(n)).sort();
        const name = `core_aux_${aux.length + 1}`;
        const head = `${name}(${[...outer, v].map((n) => `_V_${n}`).join(",")})`;
        auxTables.push(`${name}/${outer.length + 1}`);
        aux.push(`${head} :- ${lit.goal.map((g) => literal(g, new Set([...outer, v]))).join(", ")}.`);
        return `core_count(_V_${v},${head},${writeTerm(lit.result)})`;
      }
    }
    throw new Error(`untranslatable literal ${JSON.stringify(lit)}`);
  };
  // Variables of a clause outside a given literal (for count's outer variables).
  const outside = (terms, body, index) => {
    const s = new Set();
    for (const t of terms) variablesOf(t, s);
    body.forEach((l, i) => { if (i !== index) for (const n of literalVars(l)) s.add(n); });
    return s;
  };
  const body = (lits, headTerms) => lits.length === 0 ? "true" : lits.map((l, i) => literal(l, outside(headTerms, lits, i))).join(", ");

  out.push("% ---- facts (the document dump, model §1)");
  for (const f of facts) out.push(`${call(f.functor, f.args)}.`);
  out.push("");

  out.push("% ---- oracles (model §1/§2): declarations and untabled leaf wrappers");
  for (const o of program.oracles) {
    const kind = o.source.choose !== undefined ? "choose" : "ask";
    out.push(`core_oracle_decl(${quoteAtom(o.predicate)},${o.arity},[${o.labels.map(quoteAtom).join(",")}],[${o.inputs.join(",")}],${kind}).`);
    const params = o.params.map((p) => `_V_${p}`);
    const inputs = o.inputs.map((i) => params[i]);
    const atomText = `${quoteAtom(o.predicate)}(${inputs.join(",")})`;
    if (kind === "ask") out.push(`${quoteAtom(o.predicate)}(${params.join(",")}) :- core_label(${atomText},holds).`);
    else out.push(`${quoteAtom(o.predicate)}(${params.join(",")}) :- core_choose(${atomText},[${o.labels.map(quoteAtom).join(",")}],${params.at(-1)}).`);
  }
  out.push("");

  out.push("% ---- rules (author clauses, translated literal by literal; every derived predicate tabled)");
  const arities = new Map(program.rules.map((r) => [r.predicate, r.head.length]));
  for (const [p, n] of arities) out.push(`:- table ${quoteAtom(p)}/${n} as incremental.`, `core_rule_pred(${quoteAtom(p)},${n}).`);
  const ruleText = program.rules.map((r) => `${call(r.predicate, r.head)} :- ${body(r.body, r.head)}.   % ${r.text.replace(/\n/g, " ")}`);
  const constraintText = [];
  out.push(":- table core_forall/2, core_goal/2 as incremental.");
  for (const c of program.constraints) {
    const names = [];
    for (const l of c.forall) for (const n of literalVars(l)) if (!names.includes(n)) names.push(n);
    const vars = names.map((n) => `_V_${n}`);
    const forall = body(c.forall, []);
    const goal = body(c.goal, names.map((n) => ({ kind: "var", name: n })));
    const id = quoteAtom(c.id);
    constraintText.push(
      `core_constraint(${id},${c.mode},${c.severity},${c.weight},${c.nonempty},[${names.map((n, i) => `${quoteAtom(n)}=${vars[i]}`).join(",")}],(${forall}),(${goal})).`,
      `core_forall(${id},[${vars.join(",")}]) :- ${forall}.`,
      `core_goal(${id},[${vars.join(",")}]) :- ${goal}.`,
    );
  }
  if (auxTables.length > 0) out.push(`:- table ${auxTables.join(", ")} as incremental.`);
  out.push(...ruleText, "", "% ---- count goals (model §3), one tabled predicate each", ...aux, "",
    "% ---- constraints (model §4): constraint(Id, Mode, Severity, Weight, Nonempty, ForallVarsNames, ForallGoal, Goal)",
    ...constraintText, `core_warning_threshold(${program.warningThreshold}).`, "");
  return out.join("\n");
}

function literalVars(lit) {
  const s = new Set();
  const add = (t) => variablesOf(t, s);
  switch (lit.kind) {
    case "pos": case "neg": lit.args.forEach(add); break;
    case "in": add(lit.item); add(lit.list); break;
    case "matches": add(lit.item); break;
    case "cmp": add(lit.left); add(lit.right); break;
    case "present": add(lit.document); add(lit.candidates); add(lit.present); break;
    case "count": add(lit.variable); add(lit.result); lit.goal.forEach((g) => literalVars(g).forEach((n) => s.add(n))); break;
  }
  return [...s];
}

/** Witness object -> { program, facts, text, repaired }. */
export async function translateWitness(witness) {
  const { program, repaired, firstError, checkerRejected } = await compileWitnessModule(witness.module);
  const facts = (witness.facts ?? []).map(parseFactText);
  return { program, facts, text: translateProgram(program, facts), repaired, firstError, checkerRejected };
}

// CLI: node kernel2/translate.mjs witnesses/x.yaml  -> prints the Prolog text
if (process.argv[1] === import.meta.filename) {
  const YAML = (await import("../../../../node_modules/yaml/dist/index.js")).default;
  const w = YAML.parse(readFileSync(process.argv[2], "utf8"));
  const t = await translateWitness(w);
  if (t.repaired) console.log(`% module YAML repaired mechanically (flow mapping quoting): ${t.firstError}`);
  console.log(t.text);
}
void listItems;
