/**
 * Static checks over a parsed module (design 04 §Rule syntax).
 *
 * The checker rejects: a predicate that is neither declared, imported nor built in;
 * an unsafe variable; negation or count over the same or a higher stratum; an oracle
 * inside a recursive cycle; an oracle whose arguments are not bound by earlier positive
 * literals; an oracle depth above `rounds`; and `matches/2` whose item is unbound or
 * whose pattern is not a valid quoted regular expression.
 */

import { CORE_BASE, CORE_DERIVED } from "./facts.js";
import { ModuleError, type ConstraintSource, type OracleSource, type ParsedModule, type RequestShape } from "./module.js";
import { conjuncts, listItems, variablesOf, type Term } from "./terms.js";

export type Literal =
  | { kind: "pos"; predicate: string; args: Term[] }
  | { kind: "neg"; predicate: string; args: Term[] }
  | { kind: "in"; item: Term; list: Term }
  | { kind: "matches"; item: Term; pattern: string; regex: RegExp; negated: boolean }
  | { kind: "cmp"; op: string; left: Term; right: Term }
  | { kind: "count"; variable: Term; goal: Literal[]; result: Term }
  | { kind: "present"; document: Term; candidates: Term; present: Term };

export interface Rule {
  predicate: string;
  head: Term[];
  body: Literal[];
  text: string;
}

export interface Oracle {
  /** Qualified predicate name, e.g. `golden::purpose`. */
  predicate: string;
  arity: number;
  /** Head argument variable names, in order. */
  params: string[];
  /** Input argument positions; for `choose` every position except the last. */
  inputs: number[];
  labels: string[];
  ask: string;
  threshold: number;
  evidence: { form: "own" | "body"; section: number } | { form: "union"; sections: number } | { form: "cell"; row: number; column: number } | { form: "column"; row: number; column: number } | { form: "cells"; row: number; columns: number } | { form: "row_with_column"; row: number; column: number };
  maxBytes: number | undefined;
  source: OracleSource;
}

export interface Constraint {
  id: string;
  forall: Literal[];
  goal: Literal[];
  mode: "require" | "forbid";
  severity: "error" | "warning";
  weight: number;
  message: string | undefined;
  repair: string | undefined;
  profiles: string[] | undefined;
  /** Whether an empty population violates the constraint (`population: nonempty`). */
  nonempty: boolean;
  source: ConstraintSource;
}

export interface Program {
  module: string;
  hash: string;
  rounds: number;
  requestShape: RequestShape;
  warningThreshold: number;
  rules: Rule[];
  oracles: Oracle[];
  constraints: Constraint[];
  /** Stratum of every derived predicate; base facts and oracles are stratum 0. */
  strata: Map<string, number>;
  /** Predicates whose derivation can reach an oracle literal. */
  oracleDependent: Set<string>;
  params: Record<string, Term>;
}

const COMPARISONS = new Set(["<", ">", "=<", ">=", "=:=", "=\\="]);

export function checkModule(parsed: ParsedModule): Program {
  const issues: string[] = [];
  const moduleName = parsed.source.module;
  const qualify = (name: string): string => `${moduleName}::${name}`;
  const known = new Map<string, number>();
  for (const entry of [...CORE_BASE, ...CORE_DERIVED]) {
    const [name, arity] = entry.split("/") as [string, string];
    known.set(`core::${name}`, Number(arity));
  }

  const oracles: Oracle[] = [];
  const oracleNames = new Set<string>();
  for (const declared of parsed.oracles) {
    const oracle = checkOracleHead(declared, qualify, issues);
    if (oracle !== undefined) {
      if (known.has(oracle.predicate)) {
        issues.push(`oracles.${declared.name}: ${declared.name} is declared twice`);
      }
      known.set(oracle.predicate, oracle.arity);
      oracleNames.add(oracle.predicate);
      oracles.push(oracle);
    }
  }
  const ruleHeads = parsed.rules.map((rule) => {
    if (rule.head.kind !== "compound" || rule.head.args.some((arg) => arg.kind !== "var")) {
      issues.push(`rules: head ${JSON.stringify(rule.text)} must be a predicate over variables`);
      return undefined;
    }
    const predicate = qualify(rule.head.functor);
    if (oracleNames.has(predicate)) {
      issues.push(`rules.${rule.head.functor}: ${rule.head.functor} is already an oracle`);
    }
    const arity = known.get(predicate);
    if (arity !== undefined && arity !== rule.head.args.length && !oracleNames.has(predicate)) {
      issues.push(`rules.${rule.head.functor}: ${rule.head.functor} is defined with two arities`);
    }
    known.set(predicate, rule.head.args.length);
    return { predicate, args: rule.head.args };
  });

  const oracleInputs = new Map(oracles.map((oracle) => [oracle.predicate, oracle.inputs]));
  // A `core.union` oracle asked over a literal empty list would bind no evidence at all
  // (`unionEvidence` returns the empty object: `chosen.length === wanted.size` is `0 === 0`),
  // so the judge would be asked to label nothing. Refused at the call site, where the list
  // is written; the declaration shape is validated separately in `checkOracleHead`.
  const oracleUnionArgs = new Map(oracles.filter((oracle) => oracle.evidence.form === "union").map((oracle) => [oracle.predicate, (oracle.evidence as { form: "union"; sections: number }).sections]));
  const resolve = (term: Term, where: string): Literal | undefined => resolveLiteral(term, where, qualify, known, oracleNames, oracleUnionArgs, issues);
  const rules: Rule[] = [];
  for (const [index, rule] of parsed.rules.entries()) {
    const head = ruleHeads[index];
    if (head === undefined) {
      continue;
    }
    const where = `rules.${rule.head.kind === "compound" ? rule.head.functor : "?"}`;
    const body = resolveBody(rule.body, where, resolve);
    checkSafety(head.args, body, where, oracleInputs, issues);
    rules.push({ predicate: head.predicate, head: head.args, body, text: rule.text });
  }

  const constraints: Constraint[] = parsed.constraints.map((constraint) => {
    const where = `constraints.${constraint.id}`;
    const forall = resolveBody(constraint.forall, `${where}.forall`, resolve);
    const goal = resolveBody(constraint.goal, `${where}.${constraint.mode}`, resolve);
    const bound = checkSafety([], forall, `${where}.forall`, oracleInputs, issues);
    const binding = new Set(forallBindingVars(forall));
    const derivedOnly = [...bound].filter((name) => !binding.has(name));
    for (const lit of goal) {
      for (const name of literalVarNames(lit)) {
        if (derivedOnly.includes(name)) {
          issues.push(`${where}.${constraint.mode}: ${name} is bound only by a count or comparison in the forall, so it is not a binding variable; count again in the goal`);
        }
      }
    }
    checkSafety([], goal, `${where}.${constraint.mode}`, oracleInputs, issues, new Set([...bound].filter((name) => binding.has(name))));
    return {
      id: constraint.id, forall, goal, mode: constraint.mode,
      severity: constraint.source.severity, weight: constraint.source.weight ?? 1,
      message: constraint.source.message, repair: constraint.source.repair, profiles: constraint.source.profiles,
      nonempty: constraint.source.population === "nonempty",
      source: constraint.source,
    };
  });

  checkLabels([...rules.map((rule) => ({ body: rule.body, where: `rules.${local(rule.predicate)}` })),
    ...constraints.map((constraint) => ({ body: [...constraint.forall, ...constraint.goal], where: `constraints.${constraint.id}` }))], oracles, issues);
  const { strata, oracleDependent } = stratify(rules, oracleNames, issues);
  if (issues.length > 0) {
    throw new ModuleError(issues);
  }
  checkOracleDepth(rules, constraints, oracleNames, parsed.rounds, issues);
  if (issues.length > 0) {
    throw new ModuleError(issues);
  }
  return {
    module: moduleName,
    hash: parsed.hash,
    rounds: parsed.rounds,
    requestShape: parsed.requestShape,
    warningThreshold: parsed.source.warning_threshold ?? 0,
    rules, oracles, constraints, strata, oracleDependent, params: parsed.params,
  };
}

function checkOracleHead(
  declared: ParsedModule["oracles"][number],
  qualify: (name: string) => string,
  issues: string[],
): Oracle | undefined {
  const where = `oracles.${declared.name}`;
  const head = declared.head;
  if (head.kind !== "compound" || head.args.some((arg) => arg.kind !== "var" || arg.name === "_")) {
    issues.push(`${where}: an oracle head is a predicate over distinct named variables`);
    return undefined;
  }
  const params = head.args.map((arg) => (arg.kind === "var" ? arg.name : "_"));
  if (new Set(params).size !== params.length) {
    issues.push(`${where}: an oracle head is a predicate over distinct named variables`);
    return undefined;
  }
  const isChoose = declared.source.choose !== undefined;
  const labels = declared.source.choose ?? ["holds", "fails"];
  if (labels.includes("unknown")) {
    issues.push(`${where}: the engine adds unknown; authors never list it`);
  }
  if (new Set(labels).size !== labels.length) {
    issues.push(`${where}: choose lists a label twice`);
  }
  if (isChoose && params.length < 2) {
    issues.push(`${where}: a choose oracle needs at least one input before its label`);
    return undefined;
  }
  const inputs = isChoose ? params.slice(0, -1).map((_, index) => index) : params.map((_, index) => index);
  const inputNames = new Set(inputs.map((index) => params[index] as string));

  const evidence = declared.evidence;
  const position = (term: Term | undefined): number | undefined => {
    if (term?.kind !== "var" || !inputNames.has(term.name)) {
      return undefined;
    }
    return params.indexOf(term.name);
  };
  let shape: Oracle["evidence"] | undefined;
  if (evidence.kind === "compound" && evidence.functor === ":" && evidence.args.length === 2) {
    const [alias, call] = evidence.args as [Term, Term];
    if (alias.kind === "atom" && alias.name === "core" && call.kind === "compound" && call.functor === "cells" && call.args.length === 3) {
      // `cells(D, R, L)`: one row's cells under a list of columns, each line headed by its column.
      const [document, rowTerm, listTerm] = call.args as [Term, Term, Term];
      const row = position(rowTerm);
      const columns = position(listTerm);
      if (position(document) === 0 && row !== undefined && columns !== undefined) {
        shape = { form: "cells", row, columns };
      }
    } else if (alias.kind === "atom" && alias.name === "core" && call.kind === "compound" && call.functor === "row_with_column" && call.args.length === 3) {
      // `row_with_column(D, R, C)`: one row's Property and `C` cells plus its table's property list.
      const [document, rowTerm, columnTerm] = call.args as [Term, Term, Term];
      const row = position(rowTerm);
      const column = position(columnTerm);
      if (position(document) === 0 && row !== undefined && column !== undefined) {
        shape = { form: "row_with_column", row, column };
      }
    } else if (alias.kind === "atom" && alias.name === "core" && call.kind === "compound" && (call.functor === "cell" || call.functor === "column") && call.args.length === 3) {
      // `cell(D, R, C)`: one row's cell; `column(D, T, C)`: a table's cells under one header.
      const [document, rowTerm, columnTerm] = call.args as [Term, Term, Term];
      const row = position(rowTerm);
      const column = position(columnTerm);
      if (position(document) === 0 && row !== undefined && column !== undefined) {
        shape = call.functor === "cell" ? { form: "cell", row, column } : { form: "column", row, column };
      }
    } else if (alias.kind === "atom" && alias.name === "core" && call.kind === "compound" && call.args.length === 2) {
      const [document, subject] = call.args as [Term, Term];
      const documentPosition = position(document);
      if ((call.functor === "own" || call.functor === "body") && documentPosition === 0) {
        const section = position(subject);
        if (section !== undefined) {
          shape = { form: call.functor, section };
        }
      } else if (call.functor === "union" && documentPosition === 0) {
        const sections = position(subject);
        if (sections !== undefined) {
          shape = { form: "union", sections };
        }
      }
    }
  }
  if (shape === undefined) {
    issues.push(`${where}.evidence: evidence is core.own(D, S), core.body(D, S), core.union(D, L), core.cell(D, R, C), core.cells(D, R, L), core.column(D, T, C) or core.row_with_column(D, R, C) over the oracle's input variables, with the document first`);
    return undefined;
  }
  for (const placeholder of declared.source.ask.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
    if (!inputNames.has(placeholder[1] as string)) {
      issues.push(`${where}.ask: {${placeholder[1] as string}} is not an input argument`);
    }
  }
  return {
    predicate: qualify(head.functor),
    arity: params.length,
    params,
    inputs,
    labels,
    ask: declared.source.ask,
    threshold: declared.source.threshold ?? 0,
    evidence: shape,
    maxBytes: declared.source.max_bytes,
    source: declared.source,
  };
}

function resolveBody(term: Term, where: string, resolve: (term: Term, where: string) => Literal | undefined): Literal[] {
  return conjuncts(term).flatMap((literal) => {
    const resolved = resolve(literal, where);
    return resolved === undefined ? [] : [resolved];
  });
}

function resolveLiteral(
  term: Term,
  where: string,
  qualify: (name: string) => string,
  known: Map<string, number>,
  oracleNames: Set<string>,
  oracleUnionArgs: Map<string, number>,
  issues: string[],
): Literal | undefined {
  if (term.kind === "atom" && term.name === "true") {
    return undefined;
  }
  if (term.kind !== "compound") {
    issues.push(`${where}: ${describe(term)} is not a goal`);
    return undefined;
  }
  if ((term.functor === "not" || term.functor === "\\+") && term.args.length === 1) {
    const inner = resolveLiteral(term.args[0] as Term, where, qualify, known, oracleNames, oracleUnionArgs, issues);
    if (inner === undefined) {
      return undefined;
    }
    if (inner.kind === "matches") {
      return { ...inner, negated: !inner.negated };
    }
    if (inner.kind !== "pos") {
      issues.push(`${where}: not applies to a predicate or matches, not to ${describe(term.args[0] as Term)}`);
      return undefined;
    }
    return { kind: "neg", predicate: inner.predicate, args: inner.args };
  }
  if (term.functor === "matches" && term.args.length === 2) {
    const [item, pattern] = term.args as [Term, Term];
    if (pattern.kind !== "atom" && pattern.kind !== "string") {
      issues.push(`${where}: the pattern of matches is a quoted atom or string`);
      return undefined;
    }
    const source = pattern.kind === "atom" ? pattern.name : pattern.value;
    try {
      return { kind: "matches", item, pattern: source, regex: new RegExp(source, "u"), negated: false };
    } catch {
      issues.push(`${where}: ${source} is not a valid regular expression`);
      return undefined;
    }
  }
  if (term.functor === "in" && term.args.length === 2) {
    const [item, listTerm] = term.args as [Term, Term];
    if (listItems(listTerm) === undefined) {
      issues.push(`${where}: the right side of in is a list`);
      return undefined;
    }
    return { kind: "in", item, list: listTerm };
  }
  if (COMPARISONS.has(term.functor) && term.args.length === 2) {
    const [left, right] = term.args as [Term, Term];
    for (const side of [left, right]) {
      if (side.kind !== "var" && side.kind !== "number") {
        issues.push(`${where}: comparisons are between integers or variables, not ${describe(side)}`);
        return undefined;
      }
      if (side.kind === "number" && !Number.isInteger(side.value)) {
        issues.push(`${where}: comparisons are between integers`);
        return undefined;
      }
    }
    return { kind: "cmp", op: term.functor, left, right };
  }
  if (term.functor === "present" && term.args.length === 3) {
    const [document, candidates, present] = term.args as [Term, Term, Term];
    if (document.kind !== "var") {
      issues.push(`${where}: present(D, Candidates, Present) takes a variable for D`);
      return undefined;
    }
    if (present.kind !== "var") {
      issues.push(`${where}: present(D, Candidates, Present) takes a variable for Present`);
      return undefined;
    }
    const listed = listItems(candidates);
    if (listed === undefined) {
      issues.push(`${where}: the second argument of present is a list of section ids`);
      return undefined;
    }
    if (listed.length === 0) {
      issues.push(`${where}: present(D, Candidates, Present) needs a non-empty candidate list`);
      return undefined;
    }
    for (const candidate of listed) {
      if (candidate.kind !== "atom") {
        issues.push(`${where}: present candidate ${describe(candidate)} is not a section id`);
        return undefined;
      }
    }
    const seen = new Set<string>();
    for (const candidate of listed) {
      const text = candidate.kind === "atom" ? candidate.name : "";
      if (seen.has(text)) {
        issues.push(`${where}: present candidate '${text}' is listed twice`);
        return undefined;
      }
      seen.add(text);
    }
    return { kind: "present", document, candidates, present };
  }
  if (term.functor === "count" && term.args.length === 3) {
    const [variable, goal, result] = term.args as [Term, Term, Term];
    if (variable.kind !== "var" || result.kind !== "var") {
      issues.push(`${where}: count(V, G, N) takes variables for V and N`);
      return undefined;
    }
    const inner = resolveBody(goal, where, (candidate, innerWhere) => resolveLiteral(candidate, innerWhere, qualify, known, oracleNames, oracleUnionArgs, issues));
    if (inner.some((literal) => literal.kind === "count")) {
      issues.push(`${where}: count does not nest`);
      return undefined;
    }
    return { kind: "count", variable, goal: inner, result };
  }
  let predicate: string;
  let args: Term[];
  if (term.functor === ":" && term.args.length === 2) {
    const [alias, call] = term.args as [Term, Term];
    if (alias.kind !== "atom" || call.kind !== "compound") {
      issues.push(`${where}: ${describe(term)} is not a qualified predicate`);
      return undefined;
    }
    predicate = `${alias.name}::${call.functor}`;
    args = call.args;
  } else {
    predicate = qualify(term.functor);
    args = term.args;
  }
  const arity = known.get(predicate);
  if (arity === undefined) {
    issues.push(`${where}: ${predicate.replace("::", ".")}/${String(args.length)} is neither declared, imported, nor a built-in`);
    return undefined;
  }
  if (arity !== args.length) {
    issues.push(`${where}: ${predicate.replace("::", ".")} takes ${String(arity)} arguments, not ${String(args.length)}`);
    return undefined;
  }
  const unionArg = oracleUnionArgs.get(predicate);
  if (unionArg !== undefined) {
    const listed = listItems(args[unionArg] as Term);
    if (listed !== undefined && listed.length === 0) {
      issues.push(`${where}: ${predicate.replace("::", ".")} is asked over an empty section list; core.union over no sections would bind no evidence`);
      return undefined;
    }
  }
  for (const arg of args) {
    if (arg.kind === "compound" && listItems(arg) === undefined) {
      issues.push(`${where}: ${describe(arg)} is not an atom, integer, list or variable`);
      return undefined;
    }
  }
  return { kind: "pos", predicate, args };
}

/** Named variables occurring in a literal (anonymous `_` excluded). Shared with the translator. */
export function literalVarNames(literal: Literal): string[] {
  const s = new Set<string>();
  const add = (t: Term) => variablesOf(t, s);
  switch (literal.kind) {
    case "pos":
    case "neg":
      literal.args.forEach(add);
      break;
    case "in":
      add(literal.item);
      add(literal.list);
      break;
    case "matches":
      add(literal.item);
      break;
    case "cmp":
      add(literal.left);
      add(literal.right);
      break;
    case "present":
      add(literal.document);
      add(literal.candidates);
      add(literal.present);
      break;
    case "count":
      add(literal.variable);
      add(literal.result);
      for (const g of literal.goal) for (const n of literalVarNames(g)) s.add(n);
      break;
  }
  return [...s];
}

/**
 * A constraint's binding variables: the named variables of its forall literals that bind (not a
 * `count`, whose counted and goal-local variables stay inside it and whose result is a derived
 * value, and not a comparison). One binding is one assignment of these; a count result that
 * varied with the answers would change a binding's identity between rounds (property track,
 * 2026-10-14: a count in a forall gave unbound and interval-valued binding values, empty demand
 * and false `unfounded`). Shared by the checker (a goal may not use any other forall name) and
 * the translator (the binding list).
 */
export function forallBindingVars(forall: Literal[]): string[] {
  const names: string[] = [];
  for (const lit of forall) {
    if (lit.kind === "count" || lit.kind === "cmp") continue;
    for (const n of literalVarNames(lit)) if (!names.includes(n)) names.push(n);
  }
  return names;
}

/**
 * Head/params/forall-bound names plus every named variable of every other literal in `body`
 * (skipping `skip`). One source of truth for "the rest of the body": the translator uses it for
 * count capture; `localNegationVars` uses it for negation locality.
 */
export function restBodyVars(skip: Literal, body: Literal[], outer: Iterable<string>): Set<string> {
  const s = new Set<string>(outer);
  for (const lit of body) {
    if (lit === skip) continue;
    for (const n of literalVarNames(lit)) s.add(n);
  }
  return s;
}

/**
 * Named variables local to a negated literal: they occur in `neg` and in no other literal of
 * `body`, and not in `outer` (head / params / count result / forall-bound names). The translator
 * lifts exactly these (plus anonymous `_`); the checker allows them unbound.
 */
export function localNegationVars(
  neg: Extract<Literal, { kind: "neg" }>,
  body: Literal[],
  outer: Iterable<string>,
): Set<string> {
  const forbidden = restBodyVars(neg, body, outer);
  const local = new Set<string>();
  for (const arg of neg.args) {
    for (const n of variablesOf(arg)) {
      if (!forbidden.has(n)) local.add(n);
    }
  }
  return local;
}

function termHasAnonymous(term: Term): boolean {
  if (term.kind === "var") return term.name === "_";
  if (term.kind === "compound") return term.args.some(termHasAnonymous);
  return false;
}

/**
 * Range restriction plus the bound-inputs rule for oracles, read left to right. A
 * positive literal binds its variables, except that an oracle literal's inputs must
 * already be bound; `not`, `in`, `matches`, comparisons and `count` bind nothing but `count`'s result.
 * Negation may carry anonymous/`_` and variables local to that literal (the translator lifts them);
 * a variable shared with other literals yet unbound at the negation is refused here.
 * Oracle negation is never lifted: every argument (inputs and choose label) must be bound.
 */
function checkSafety(
  head: Term[],
  body: Literal[],
  where: string,
  oracleInputs: Map<string, number[]>,
  issues: string[],
  outer: Set<string> = new Set(),
): Set<string> {
  const bound = new Set(outer);
  const scopeOuter = new Set(outer);
  for (const t of head) variablesOf(t, scopeOuter);
  const unsafe = (name: string, what: string): void => {
    issues.push(`${where}: ${name} is unsafe; ${what}`);
  };
  const requireBound = (terms: Term[], what: string): void => {
    for (const term of terms) {
      for (const name of variablesOf(term)) {
        if (!bound.has(name)) {
          unsafe(name, what);
        }
      }
    }
  };

  for (const literal of body) {
    switch (literal.kind) {
      case "pos": {
        const inputs = oracleInputs.get(literal.predicate);
        if (inputs !== undefined) {
          const inputTerms = inputs.map((index) => literal.args[index] as Term);
          if (inputTerms.some((term) => term.kind === "var" && term.name === "_")) {
            issues.push(`${where}: oracle ${local(literal.predicate)} has an anonymous input; every input is one question's argument`);
          }
          requireBound(inputTerms, `oracle ${local(literal.predicate)} needs it bound by an earlier positive literal`);
        }
        for (const arg of literal.args) {
          variablesOf(arg, bound);
        }
        break;
      }
      case "neg": {
        if (oracleInputs.has(literal.predicate)) {
          // Refuse: lifting an oracle into an existential would ask the judge about unbound atoms.
          const bad = literal.args.some((term) => termHasAnonymous(term) || [...variablesOf(term)].some((n) => !bound.has(n)));
          if (bad) {
            issues.push(`${where}: not over oracle ${local(literal.predicate)} needs every argument bound (inputs and label; oracle negation is not lifted)`);
          }
          break;
        }
        // Anonymous `_` and variables local to this negated literal are OK (translate lifts them).
        // A variable shared with other literals yet unbound here is unsafe.
        const localVars = localNegationVars(literal, body, scopeOuter);
        for (const arg of literal.args) {
          for (const name of variablesOf(arg)) {
            if (bound.has(name)) continue;
            if (!localVars.has(name)) {
              unsafe(name, "negation needs it bound by an earlier positive literal (it is shared with other literals)");
            }
          }
        }
        break;
      }
      case "in":
        requireBound([literal.item, literal.list], "it is not bound by an earlier positive literal");
        break;
      case "matches":
        requireBound([literal.item], "it is not bound by an earlier positive literal");
        break;
      case "cmp":
        requireBound([literal.left, literal.right], "it is not bound by an earlier positive literal");
        break;
      case "count": {
        const countOuter = new Set(bound);
        if (literal.variable.kind === "var") countOuter.add(literal.variable.name);
        if (literal.result.kind === "var") countOuter.add(literal.result.name);
        checkSafety([], literal.goal, where, oracleInputs, issues, countOuter);
        if (literal.result.kind === "var") {
          bound.add(literal.result.name);
        }
        break;
      }
      case "present": {
        requireBound([literal.document], "present(D, Candidates, Present) needs D bound by an earlier positive literal");
        if (literal.present.kind === "var") {
          bound.add(literal.present.name);
        }
        break;
      }
    }
  }
  requireBound(head, "it is not bound by an earlier positive literal");
  return bound;
}

function stratify(rules: Rule[], oracleNames: Set<string>, issues: string[]): { strata: Map<string, number>; oracleDependent: Set<string> } {
  const derived = new Set(rules.map((rule) => rule.predicate));
  const positive = new Map<string, Set<string>>();
  const negative = new Map<string, Set<string>>();
  const direct = new Map<string, Set<string>>();
  for (const predicate of derived) {
    positive.set(predicate, new Set());
    negative.set(predicate, new Set());
    direct.set(predicate, new Set());
  }
  const visit = (rule: Rule, literals: Literal[], underAggregate: boolean): void => {
    for (const literal of literals) {
      if (literal.kind === "pos" || literal.kind === "neg") {
        direct.get(rule.predicate)?.add(literal.predicate);
        if (derived.has(literal.predicate)) {
          (literal.kind === "pos" && !underAggregate ? positive : negative).get(rule.predicate)?.add(literal.predicate);
        }
      } else if (literal.kind === "count") {
        visit(rule, literal.goal, true);
      }
    }
  };
  for (const rule of rules) {
    visit(rule, rule.body, false);
  }
  // Strongly connected components over all edges give the recursion structure.
  const reach = new Map<string, Set<string>>();
  for (const predicate of derived) {
    const seen = new Set<string>();
    const stack = [predicate];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const next of [...(positive.get(current) ?? []), ...(negative.get(current) ?? [])]) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    reach.set(predicate, seen);
  }
  const sameComponent = (a: string, b: string): boolean => a === b || ((reach.get(a)?.has(b) ?? false) && (reach.get(b)?.has(a) ?? false));
  for (const predicate of derived) {
    for (const target of negative.get(predicate) ?? []) {
      if (sameComponent(predicate, target)) {
        issues.push(`rules.${local(predicate)}: negation or count over ${local(target)} in the same stratum`);
      }
    }
  }
  // Oracle dependence and recursion through an oracle.
  const oracleDependent = new Set<string>();
  const dependsOnOracle = (predicate: string, seen: Set<string>): boolean => {
    if (oracleDependent.has(predicate)) {
      return true;
    }
    if (seen.has(predicate)) {
      return false;
    }
    seen.add(predicate);
    for (const target of direct.get(predicate) ?? []) {
      if (oracleNames.has(target) || (derived.has(target) && dependsOnOracle(target, seen))) {
        oracleDependent.add(predicate);
        return true;
      }
    }
    return false;
  };
  for (const predicate of derived) {
    dependsOnOracle(predicate, new Set());
  }
  for (const predicate of derived) {
    const recursive = reach.get(predicate)?.has(predicate) ?? false;
    if (recursive && oracleDependent.has(predicate)) {
      issues.push(`rules.${local(predicate)}: an oracle inside a recursive cycle`);
    }
  }
  // Strata: a stratum is 1 + the maximum over negative edges, and at least the maximum over positive edges.
  const strata = new Map<string, number>();
  const order = [...derived].sort();
  let changed = true;
  let iterations = 0;
  for (const predicate of order) {
    strata.set(predicate, 1);
  }
  while (changed && iterations < order.length + 2) {
    changed = false;
    iterations += 1;
    for (const predicate of order) {
      let level = 1;
      for (const target of positive.get(predicate) ?? []) {
        level = Math.max(level, strata.get(target) ?? 1);
      }
      for (const target of negative.get(predicate) ?? []) {
        level = Math.max(level, (strata.get(target) ?? 1) + 1);
      }
      if (level !== strata.get(predicate)) {
        strata.set(predicate, level);
        changed = true;
      }
    }
  }
  return { strata, oracleDependent };
}

/** The longest left-to-right chain of oracle literals reaching each oracle, bounded by `rounds`. */
function checkOracleDepth(rules: Rule[], constraints: Constraint[], oracleNames: Set<string>, rounds: number, issues: string[]): void {
  const byPredicate = new Map<string, Rule[]>();
  for (const rule of rules) {
    const entry = byPredicate.get(rule.predicate) ?? [];
    entry.push(rule);
    byPredicate.set(rule.predicate, entry);
  }
  const memo = new Map<string, number>();
  let deepest = 0;
  // Returns the oracle depth contributed by a body: the depth after reading all literals.
  const bodyDepth = (body: Literal[], entering: number, active: Set<string>): number => {
    let depth = entering;
    for (const literal of body) {
      if (literal.kind === "pos" || literal.kind === "neg") {
        if (oracleNames.has(literal.predicate)) {
          depth += 1;
          deepest = Math.max(deepest, depth);
        } else if (byPredicate.has(literal.predicate)) {
          // A derived predicate's oracles are asked through its own rule instances,
          // whatever precedes it here; its tuples settle after its own depth.
          depth = Math.max(depth, predicateDepth(literal.predicate, 0, active));
        }
      } else if (literal.kind === "count") {
        depth = Math.max(depth, bodyDepth(literal.goal, depth, active));
      }
    }
    return depth;
  };
  const predicateDepth = (predicate: string, entering: number, active: Set<string>): number => {
    const key = `${predicate}@${String(entering)}`;
    const cached = memo.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (active.has(predicate)) {
      return entering;
    }
    active.add(predicate);
    let depth = entering;
    for (const rule of byPredicate.get(predicate) ?? []) {
      depth = Math.max(depth, bodyDepth(rule.body, entering, active));
    }
    active.delete(predicate);
    memo.set(key, depth);
    return depth;
  };
  // Every rule instance is evaluated, so every rule is a starting point, not only constraints.
  for (const rule of rules) {
    bodyDepth(rule.body, 0, new Set());
  }
  for (const constraint of constraints) {
    bodyDepth([...constraint.forall, ...constraint.goal], 0, new Set());
  }
  if (deepest > rounds) {
    issues.push(`rounds: an oracle at depth ${String(deepest)} is deeper than rounds (${String(rounds)})`);
  }
}

/** A constant label argument must be one of the oracle's labels, or the literal can never hold. */
function checkLabels(bodies: Array<{ body: Literal[]; where: string }>, oracles: Oracle[], issues: string[]): void {
  const byPredicate = new Map(oracles.filter((oracle) => oracle.source.choose !== undefined).map((oracle) => [oracle.predicate, oracle]));
  const visit = (literals: Literal[], where: string): void => {
    for (const literal of literals) {
      if (literal.kind === "count") {
        visit(literal.goal, where);
        continue;
      }
      if (literal.kind !== "pos" && literal.kind !== "neg") {
        continue;
      }
      const oracle = byPredicate.get(literal.predicate);
      const label = literal.args.at(-1);
      if (oracle !== undefined && label?.kind === "atom" && !oracle.labels.includes(label.name)) {
        issues.push(`${where}: ${label.name} is not a label of ${local(oracle.predicate)} (${oracle.labels.join(", ")})`);
      }
    }
  };
  for (const { body, where } of bodies) {
    visit(body, where);
  }
}

function local(predicate: string): string {
  return predicate.split("::")[1] ?? predicate;
}

function describe(term: Term): string {
  switch (term.kind) {
    case "var":
      return term.name;
    case "atom":
      return term.name;
    case "number":
      return String(term.value);
    case "string":
      return JSON.stringify(term.value);
    case "compound":
      return `${term.functor}/${String(term.args.length)}`;
  }
}
