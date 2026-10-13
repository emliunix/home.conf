/**
 * Translate a design-04 module (plus dump facts) into Prolog text for core.pl.
 *
 * Mechanical: the module is parsed by doc-verify's own parser and every literal is written as
 * one Prolog goal. Author rules keep their clause structure, order and variables
 * (`writeTerm` writes a variable D as `_V_D`). Nothing is optimised or reordered.
 *
 * Naming:
 *   core.p(...)        -> core_p(...)              (base facts of the dump, two-valued)
 *   module predicate   -> 'w::p'(...)              (tabled `as incremental`)
 *   oracle o (ask)     -> 'w::o'(Is) :- core_label('w::o'(Is), holds).
 *   oracle k (choose)  -> 'w::k'(Is, L) :- core_choose('w::k'(Is), Labels, L).
 */

import { compileModule } from "../engine/index.js";
import { loadModule, type ConstraintSource, type OracleSource, type ParsedModule, type RequestShape } from "../engine/module.js";
import { forallBindingVars, localNegationVars, restBodyVars, type Literal } from "../engine/checker.js";
import { listItems, quoteAtom, readCanonical, variablesOf, writeTerm, type Term } from "../engine/terms.js";

/** A fact term with a qualified functor (`core::section`, `w::n`, …). */
export type FactTerm = { kind: "compound"; functor: string; args: Term[] };

export interface TranslateOracle {
  predicate: string;
  arity: number;
  params: string[];
  inputs: number[];
  labels: string[];
  source: OracleSource;
}

export interface TranslateConstraint {
  id: string;
  forall: Literal[];
  goal: Literal[];
  mode: "require" | "forbid";
  severity: "error" | "warning";
  weight: number;
  nonempty: boolean;
  profiles?: string[] | undefined;
  source: ConstraintSource;
}

export interface TranslateRule {
  predicate: string;
  head: Term[];
  body: Literal[];
  text: string;
}

/** Program shape accepted by the translator (full checker Program or syntax-only). */
export type TranslateProgram = {
  module: string;
  hash: string;
  rounds: number;
  requestShape: RequestShape;
  warningThreshold: number;
  rules: TranslateRule[];
  oracles: TranslateOracle[];
  constraints: TranslateConstraint[];
  params: Record<string, Term>;
  syntaxOnly?: boolean;
};

export interface CompileWitnessResult {
  program: TranslateProgram;
  repaired: boolean;
  firstError?: string;
  text: string;
  checkerRejected?: string;
}

/**
 * Compiles a module text. If the YAML is rejected only because a flow mapping holds an unquoted
 * value with a comma, the value is quoted mechanically and the compile retried; `repaired` says so.
 */
export async function compileWitnessModule(moduleYaml: string): Promise<CompileWitnessResult> {
  let text = moduleYaml;
  let repaired = false;
  let firstError: string | undefined;
  try {
    await loadModule(text);
  } catch (error) {
    const fixed = repairFlowMappings(text);
    if (fixed === text) throw error;
    text = fixed;
    repaired = true;
    firstError = error instanceof Error ? error.message : String(error);
  }
  try {
    const full = await compileModule(text);
    const program: TranslateProgram = {
      module: full.module,
      hash: full.hash,
      rounds: full.rounds,
      requestShape: full.requestShape,
      warningThreshold: full.warningThreshold,
      rules: full.rules,
      oracles: full.oracles.map((o) => ({
        predicate: o.predicate,
        arity: o.arity,
        params: o.params,
        inputs: o.inputs,
        labels: o.labels,
        source: o.source,
      })),
      constraints: full.constraints.map((c) => ({
        id: c.id,
        forall: c.forall,
        goal: c.goal,
        mode: c.mode,
        severity: c.severity,
        weight: c.weight,
        nonempty: c.nonempty,
        ...(c.profiles !== undefined ? { profiles: c.profiles } : {}),
        source: c.source,
      })),
      params: full.params,
    };
    return {
      program,
      repaired,
      text,
      ...(firstError !== undefined ? { firstError } : {}),
    };
  } catch (error) {
    // The design-04 checker refuses what the model allows (unstratified negation, an oracle
    // deeper than `rounds`) and what the model makes the KERNEL's check. Syntax only here.
    const program = syntaxProgram(await loadModule(text));
    return {
      program,
      repaired,
      text,
      checkerRejected: error instanceof Error ? error.message : String(error),
      ...(firstError !== undefined ? { firstError } : {}),
    };
  }
}

const COMPARISONS = new Set(["<", ">", "=<", ">=", "=:=", "=\\="]);

/** ParsedModule -> Program-shaped object (rules/oracles/constraints as Literals), syntax only. */
export function syntaxProgram(parsed: ParsedModule): TranslateProgram {
  const mod = parsed.source.module;
  const qualify = (n: string) => `${mod}::${n}`;
  const conj = (t: Term): Term[] =>
    t.kind === "compound" && t.functor === "," && t.args.length === 2 ? [...conj((t.args[0] as Term)), ...conj((t.args[1] as Term))] : [t];
  const resolve = (t: Term): Literal[] => {
    if (t.kind === "atom" && t.name === "true") return [];
    if (t.kind === "atom") return [{ kind: "pos", predicate: qualify(t.name), args: [] }];
    if (t.kind !== "compound") throw new Error(`unresolvable term ${JSON.stringify(t)}`);
    if ((t.functor === "not" || t.functor === "\\+") && t.args.length === 1) {
      const [inner] = resolve((t.args[0] as Term));
      if (!inner) throw new Error("empty negation");
      if (inner.kind === "matches") return [{ ...inner, negated: !inner.negated }];
      if (inner.kind === "pos") return [{ kind: "neg", predicate: inner.predicate, args: inner.args }];
      throw new Error(`unresolvable negation of ${inner.kind}`);
    }
    if (t.functor === "matches" && t.args.length === 2) {
      const pat = (t.args[1] as Term);
      const p = pat.kind === "atom" ? pat.name : pat.kind === "string" ? pat.value : (() => { throw new Error("matches pattern"); })();
      return [{ kind: "matches", item: (t.args[0] as Term), pattern: p, regex: new RegExp(p, "u"), negated: false }];
    }
    if (t.functor === "in" && t.args.length === 2) return [{ kind: "in", item: (t.args[0] as Term), list: (t.args[1] as Term) }];
    if (COMPARISONS.has(t.functor) && t.args.length === 2) return [{ kind: "cmp", op: t.functor, left: (t.args[0] as Term), right: (t.args[1] as Term) }];
    if (t.functor === "present" && t.args.length === 3) {
      return [{ kind: "present", document: (t.args[0] as Term), candidates: (t.args[1] as Term), present: (t.args[2] as Term) }];
    }
    if (t.functor === "count" && t.args.length === 3) {
      return [{ kind: "count", variable: (t.args[0] as Term), goal: conj((t.args[1] as Term)).flatMap(resolve), result: (t.args[2] as Term) }];
    }
    if (t.functor === ":" && t.args.length === 2) {
      const [alias, c] = t.args;
      if (!alias || alias.kind !== "atom" || !c) throw new Error("qualified call");
      if (c.kind === "atom") return [{ kind: "pos", predicate: `${alias.name}::${c.name}`, args: [] }];
      if (c.kind !== "compound") throw new Error("qualified call");
      return [{ kind: "pos", predicate: `${alias.name}::${c.functor}`, args: c.args }];
    }
    return [{ kind: "pos", predicate: qualify(t.functor), args: t.args }];
  };
  const body = (t: Term) => conj(t).flatMap(resolve);
  const oracles: TranslateOracle[] = parsed.oracles.map((o) => {
    const params = o.head.kind === "compound" ? o.head.args.map((a) => (a.kind === "var" ? a.name : "_")) : [];
    const choose = o.source.choose !== undefined;
    return {
      predicate: qualify(o.head.kind === "compound" ? o.head.functor : o.name),
      arity: params.length,
      params,
      inputs: (choose ? params.slice(0, -1) : params).map((_, i) => i),
      labels: o.source.choose ?? ["holds", "fails"],
      source: o.source,
    };
  });
  const rules: TranslateRule[] = parsed.rules.map((r) => {
    if (r.head.kind === "atom") {
      return { predicate: qualify(r.head.name), head: [], body: body(r.body), text: r.text };
    }
    if (r.head.kind !== "compound") throw new Error("rule head");
    return { predicate: qualify(r.head.functor), head: r.head.args, body: body(r.body), text: r.text };
  });
  const constraints: TranslateConstraint[] = parsed.constraints.map((c) => ({
    id: c.id,
    forall: body(c.forall),
    goal: body(c.goal),
    mode: c.mode,
    severity: c.source.severity,
    weight: c.source.weight ?? 1,
    ...(c.source.profiles !== undefined ? { profiles: c.source.profiles } : {}),
    nonempty: c.source.population === "nonempty",
    source: c.source,
  }));
  return {
    module: mod,
    hash: parsed.hash,
    rounds: parsed.rounds,
    requestShape: parsed.requestShape,
    warningThreshold: parsed.source.warning_threshold ?? 0,
    rules,
    oracles,
    constraints,
    params: parsed.params,
    syntaxOnly: true,
  };
}

function repairFlowMappings(text: string): string {
  return text.split("\n").map((line) => {
    const m = /^(\s*[^{#]*:\s*)\{(.*)\}\s*$/.exec(line);
    if (!m) return line;
    const parts: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let cur = "";
    for (const ch of (m[2] as string)) {
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === "(" || ch === "[") depth += 1;
      if (ch === ")" || ch === "]") depth -= 1;
      if (ch === "," && depth === 0) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    const fixed = parts.map((p) => {
      const kv = /^(\s*[A-Za-z_]+:\s*)(.*?)\s*$/.exec(p);
      if (!kv || /^["'[{]/.test((kv[2] as string)) || !/[(,]/.test((kv[2] as string))) return p.trim();
      return `${(kv[1] as string).trim()} ${JSON.stringify(kv[2])}`;
    });
    return `${m[1]}{${fixed.join(", ")}}`;
  }).join("\n");
}

/** A witness fact `section(d, a, root)` (or `w::n(a)`) as a Term with a qualified functor. */
export function parseFactText(text: string): FactTerm {
  const m = /^\s*([^(\s]*::[^(\s]*)\((.*)\)\s*$/.exec(text);
  if (m) {
    const wrapped = readCanonical(`x(${m[2]})`);
    if (wrapped.kind !== "compound") throw new Error(`fact args not a compound: ${text}`);
    return { kind: "compound", functor: (m[1] as string), args: wrapped.args };
  }
  const t = readCanonical(text.trim());
  if (t.kind === "atom") return { kind: "compound", functor: `core::${t.name}`, args: [] };
  if (t.kind !== "compound") throw new Error(`fact not a compound: ${text}`);
  return { kind: "compound", functor: `core::${t.functor}`, args: t.args };
}

/** The Prolog name of a qualified predicate. */
export function predName(predicate: string): string {
  return predicate.startsWith("core::") ? `core_${predicate.slice(6)}` : quoteAtom(predicate);
}

const call = (predicate: string, args: Term[]) =>
  args.length === 0 ? predName(predicate) : `${predName(predicate)}(${args.map(writeTerm).join(",")})`;

/** Translates a compiled Program plus fact Terms into Prolog text (consulted after core.pl). */
export function translateProgram(program: TranslateProgram, facts: FactTerm[]): string {
  const out: string[] = [":- style_check(-singleton).", ":- style_check(-discontiguous).", ""];
  const oracles = new Map(program.oracles.map((o) => [o.predicate, o]));
  const derived = new Set(program.rules.map((r) => r.predicate));
  const aux: string[] = [];
  const auxByGoal = new Map<string, string>();
  const auxTables: string[] = [];
  let negLift = 0;

  const termHasAnonymous = (term: Term): boolean => {
    if (term.kind === "var") return term.name === "_";
    if (term.kind === "compound") return term.args.some(termHasAnonymous);
    return false;
  };

  /**
   * Translate one literal in a body. `outer` is head/params/count-result/forall-bound names;
   * locality (what to lift under negation) uses the shared `localNegationVars` with this body.
   */
  const literal = (lit: Literal, body: Literal[], outer: Set<string>): string => {
    switch (lit.kind) {
      case "pos":
        return call(lit.predicate, lit.args);
      case "neg": {
        const o = oracles.get(lit.predicate);
        if (o) {
          const choose = o.source.choose !== undefined;
          const inputs = choose ? lit.args.slice(0, -1) : lit.args;
          const label = choose ? writeTerm((lit.args.at(-1) as Term)) : "holds";
          return `core_not_label(${call(lit.predicate, inputs)},${label})`;
        }
        // Lift only vars local to this negated literal (shared helper with the checker).
        const local = localNegationVars(lit, body, outer);
        const atomVars = [...new Set(lit.args.flatMap((a) => [...variablesOf(a)]))];
        const lift = lit.args.some(termHasAnonymous) || atomVars.some((n) => local.has(n));
        if (lift) {
          const headVars = atomVars.filter((n) => !local.has(n)).sort();
          negLift += 1;
          const name = `core_neg_${negLift}`;
          const headArgs = headVars.map((n) => `_V_${n}`).join(",");
          const head = headVars.length === 0 ? name : `${name}(${headArgs})`;
          aux.push(`${head} :- ${call(lit.predicate, lit.args)}.`);
          if (derived.has(lit.predicate)) {
            auxTables.push(`${name}/${headVars.length}`);
            return `core_tnot(${head})`;
          }
          return `core_naf(${head})`;
        }
        if (derived.has(lit.predicate)) return `core_tnot(${call(lit.predicate, lit.args)})`;
        return `core_naf(${call(lit.predicate, lit.args)})`;
      }
      case "in":
        return `memberchk(${writeTerm(lit.item)},${writeTerm(lit.list)})`;
      case "matches":
        return `${lit.negated ? "core_not_matches" : "core_matches"}(${writeTerm(lit.item)},${quoteAtom(lit.pattern)})`;
      case "cmp":
        return `core_cmp(${quoteAtom(lit.op)},${writeTerm(lit.left)},${writeTerm(lit.right)})`;
      case "present":
        return `core_present(${writeTerm(lit.document)},${writeTerm(lit.candidates)},${writeTerm(lit.present)})`;
      case "count": {
        const v = lit.variable.kind === "var" ? lit.variable.name : (() => { throw new Error("count variable"); })();
        const inner = new Set<string>();
        for (const g of lit.goal) for (const n of literalVars(g)) inner.add(n);
        // Capture = inner ∩ (head/params ∪ vars of every other body literal). Sibling-bound
        // variables (not in the head) must be parameters of the aux, not free inside it.
        const scope = restBodyVars(lit, body, outer);
        const captured = [...inner].filter((n) => n !== v && scope.has(n)).sort();
        const params = [...captured, v];
        const countOuter = new Set(params);
        if (lit.result.kind === "var") countOuter.add(lit.result.name);
        const goalText = lit.goal.map((g) => literal(g, lit.goal, countOuter)).join(", ");
        // Identical count goals (up to renaming the head's variables) share one aux predicate, so
        // two counts of the same goal have the same undetermined instances (core_same_count/2).
        const canonical = params.reduce((t, n, i) => t.replace(new RegExp(`\\b_V_${n}\\b`, "g"), `_P${i}`), goalText);
        let name = auxByGoal.get(canonical);
        const args = params.map((n) => `_V_${n}`).join(",");
        if (name === undefined) {
          name = `core_aux_${auxByGoal.size + 1}`;
          auxByGoal.set(canonical, name);
          auxTables.push(`${name}/${params.length}`);
          aux.push(`${name}(${args}) :- ${goalText}.`);
        }
        return `core_count(_V_${v},${name}(${args}),${writeTerm(lit.result)})`;
      }
    }
  };

  const bodyText = (lits: Literal[], headTerms: Term[]) => {
    const outer = new Set<string>();
    for (const t of headTerms) variablesOf(t, outer);
    return lits.length === 0 ? "true" : lits.map((l) => literal(l, lits, outer)).join(", ");
  };

  out.push("% ---- facts (the document dump, model §1)");
  for (const f of facts) out.push(`${call(f.functor, f.args)}.`);
  out.push("");

  out.push("% ---- oracles (model §1/§2): declarations and untabled leaf wrappers");
  for (const o of program.oracles) {
    const kind = o.source.choose !== undefined ? "choose" : "ask";
    out.push(`core_oracle_decl(${quoteAtom(o.predicate)},${o.arity},[${o.labels.map(quoteAtom).join(",")}],[${o.inputs.join(",")}],${kind}).`);
    const params = o.params.map((p) => `_V_${p}`);
    const inputs = o.inputs.map((i) => (params[i] as string));
    const atomText = `${quoteAtom(o.predicate)}(${inputs.join(",")})`;
    if (kind === "ask") out.push(`${quoteAtom(o.predicate)}(${params.join(",")}) :- core_label(${atomText},holds).`);
    else out.push(`${quoteAtom(o.predicate)}(${params.join(",")}) :- core_choose(${atomText},[${o.labels.map(quoteAtom).join(",")}],${params.at(-1)}).`);
  }
  out.push("");

  out.push("% ---- rules (author clauses, translated literal by literal; every derived predicate tabled)");
  const arities = new Map(program.rules.map((r) => [r.predicate, r.head.length]));
  for (const [p, n] of arities) out.push(`:- table ${quoteAtom(p)}/${n} as incremental.`, `core_rule_pred(${quoteAtom(p)},${n}).`);
  const ruleText = program.rules.map((r) => `${call(r.predicate, r.head)} :- ${bodyText(r.body, r.head)}.   % ${r.text.replace(/\n/g, " ")}`);
  const constraintText: string[] = [];
  out.push(":- table core_forall/2, core_goal/2 as incremental.");
  for (const c of program.constraints) {
    const names = forallBindingVars(c.forall);
    const vars = names.map((n) => `_V_${n}`);
    const forall = bodyText(c.forall, []);
    const goal = bodyText(c.goal, names.map((n) => ({ kind: "var" as const, name: n })));
    const id = quoteAtom(c.id);
    constraintText.push(
      `core_constraint(${id},${c.mode},${c.severity},${c.weight},${c.nonempty},[${names.map((n, i) => `${quoteAtom(n)}=${vars[i]}`).join(",")}],(${forall}),(${goal})).`,
      `core_forall(${id},[${vars.join(",")}]) :- ${forall}.`,
      `core_goal(${id},[${vars.join(",")}]) :- ${goal}.`,
    );
  }
  if (auxTables.length > 0) out.push(`:- table ${auxTables.join(", ")} as incremental.`);
  out.push(
    ...ruleText,
    "",
    "% ---- count goals (model §3), one tabled predicate each",
    ...aux,
    "",
    "% ---- constraints (model §4): constraint(Id, Mode, Severity, Weight, Nonempty, ForallVarsNames, ForallGoal, Goal)",
    ...constraintText,
    `core_warning_threshold(${program.warningThreshold}).`,
    "",
  );
  return out.join("\n");
}

function literalVars(lit: Literal): string[] {
  const s = new Set<string>();
  const add = (t: Term) => variablesOf(t, s);
  switch (lit.kind) {
    case "pos":
    case "neg":
      lit.args.forEach(add);
      break;
    case "in":
      add(lit.item);
      add(lit.list);
      break;
    case "matches":
      add(lit.item);
      break;
    case "cmp":
      add(lit.left);
      add(lit.right);
      break;
    case "present":
      add(lit.document);
      add(lit.candidates);
      add(lit.present);
      break;
    case "count":
      add(lit.variable);
      add(lit.result);
      lit.goal.forEach((g) => literalVars(g).forEach((n) => s.add(n)));
      break;
  }
  return [...s];
}

export interface WitnessInput {
  module: string;
  facts?: string[];
}

/** Witness object -> { program, facts, text, repaired }. */
export async function translateWitness(witness: WitnessInput): Promise<{
  program: TranslateProgram;
  facts: FactTerm[];
  text: string;
  repaired: boolean;
  firstError?: string;
  checkerRejected?: string;
}> {
  const { program, repaired, firstError, checkerRejected } = await compileWitnessModule(witness.module);
  const facts = (witness.facts ?? []).map(parseFactText);
  return {
    program,
    facts,
    text: translateProgram(program, facts),
    repaired,
    ...(firstError !== undefined ? { firstError } : {}),
    ...(checkerRejected !== undefined ? { checkerRejected } : {}),
  };
}

void listItems;
