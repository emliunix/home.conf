/**
 * Two-bound evaluation (design 04 §Evaluation), bottom-up in TypeScript.
 *
 * Each predicate has a certain bound (unknown oracle atoms read as false) and a
 * possible bound (unknown and unasked oracle atoms read as true). `not G` reads the
 * opposite bound of `G`, which stratification makes well defined. Each stratum is run
 * to a fixpoint, certain first and then possible.
 *
 * A possible tuple is `settled` when some derivation of it reads only answered oracle
 * atoms. An oracle literal is demanded when its inputs are bound, every oracle literal
 * before it in its rule or constraint instance is answered (the prefix is settled), and
 * the instance is still possible. That is the round schedule.
 */

import type { Constraint, Literal, Oracle, Program, Rule } from "./checker.js";
import { atom, compound, list, listItems, number, termText, writeTerm, type Term } from "./terms.js";

export type Mode = "certain" | "possible";
type Env = ReadonlyMap<string, Term>;

/** Why a literal held in one derivation; the proof tree is built from these. */
export type Premise =
  | { kind: "atom"; predicate: string; key: string }
  | { kind: "oracle"; predicate: string; key: string; atom: string; negated: boolean }
  | { kind: "not"; atom: string }
  | { kind: "builtin"; text: string };

export interface Derivation {
  rule: number | undefined;
  premises: Premise[];
}

export interface TupleEntry {
  args: Term[];
  settled: boolean;
  derivation: Derivation;
}

export interface Relation {
  certain: Map<string, TupleEntry>;
  possible: Map<string, TupleEntry>;
}

/** The engine's view of answered oracle atoms: absent means never asked. */
export interface OracleView {
  lookup(key: string): { label: string } | undefined;
}

export interface Demand {
  key: string;
  /** The atom as diagnostics print it, e.g. `golden.purpose(d.md, scope)`. */
  atom: string;
  oracle: Oracle;
  inputs: Term[];
}

export type BindingStatus = "violated" | "satisfied" | "undetermined";

export interface BindingResult {
  env: Map<string, Term>;
  certain: boolean;
  status: BindingStatus;
  /** Proof premises of the forall binding, certain when the binding is certain. */
  forall: Premise[];
  forallMode: Mode;
  /** Premises of a goal solution: certain for a certain goal, else possible when one exists. */
  goal: Premise[] | undefined;
  goalMode: Mode;
  /** For a violated `require`: goal literals that were not possible, instantiated. */
  missing: Array<{ literal: string; after: Premise[] }>;
}

export interface ConstraintEvaluation {
  constraint: Constraint;
  bindings: BindingResult[];
}

export interface Evaluation {
  relations: Map<string, Relation>;
  demands: Map<string, Demand>;
  constraints: ConstraintEvaluation[];
}

export const UNKNOWN = "unknown";

/** The canonical key of an oracle atom: its predicate and ground inputs. */
export function oracleAtomKey(predicate: string, inputs: Term[]): string {
  return `${predicate}(${inputs.map(writeTerm).join(",")})`;
}

export function atomText(predicate: string, args: Term[]): string {
  return `${predicate.replace("::", ".")}(${args.map(termText).join(", ")})`;
}

export function tupleKey(args: Term[]): string {
  return args.map(writeTerm).join(",");
}

interface Context {
  program: Program;
  oracles: Map<string, Oracle>;
  relations: Map<string, Relation>;
  view: OracleView;
  demands: Map<string, Demand>;
}

interface Solution {
  env: Env;
  settled: boolean;
  premises: Premise[];
}

/**
 * The ids of `documentId`'s sections in document order, read from the `section/3` and
 * `order/3` facts. Bounded to one document: a candidate list can never reach another
 * document's sections, and no rule solution is enumerated.
 */
function sectionIdsInOrder(context: Context, documentId: string): string[] {
  const orders = context.relations.get("core::order");
  const sections = context.relations.get("core::section");
  if (orders === undefined || sections === undefined) {
    return [];
  }
  const seen = new Set<string>();
  for (const entry of sections.certain.values()) {
    const [document, section] = entry.args as [Term, Term];
    if (termText(document) === documentId && isGround(section)) {
      seen.add(termText(section));
    }
  }
  const ordered: Array<{ id: string; order: number }> = [];
  for (const entry of orders.certain.values()) {
    const [document, section, position] = entry.args as [Term, Term, Term];
    if (termText(document) !== documentId || !isGround(section) || position.kind !== "number") {
      continue;
    }
    const id = termText(section);
    if (seen.has(id)) {
      ordered.push({ id, order: position.value });
    }
  }
  ordered.sort((a, b) => a.order - b.order);
  return ordered.map((item) => item.id);
}

export function evaluate(program: Program, facts: Term[], view: OracleView): Evaluation {
  const relations = new Map<string, Relation>();
  const relation = (predicate: string): Relation => {
    let entry = relations.get(predicate);
    if (entry === undefined) {
      entry = { certain: new Map(), possible: new Map() };
      relations.set(predicate, entry);
    }
    return entry;
  };
  for (const fact of facts) {
    if (fact.kind !== "compound") {
      continue;
    }
    const entry: TupleEntry = { args: fact.args, settled: true, derivation: { rule: undefined, premises: [] } };
    const key = tupleKey(fact.args);
    relation(fact.functor).certain.set(key, entry);
    relation(fact.functor).possible.set(key, entry);
  }
  for (const rule of program.rules) {
    relation(rule.predicate);
  }
  const context: Context = {
    program,
    oracles: new Map(program.oracles.map((oracle) => [oracle.predicate, oracle])),
    relations,
    view,
    demands: new Map(),
  };

  const strata = [...new Set(program.rules.map((rule) => program.strata.get(rule.predicate) ?? 1))].sort((a, b) => a - b);
  for (const stratum of strata) {
    const rules = program.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => (program.strata.get(rule.predicate) ?? 1) === stratum);
    fixpoint(context, rules, "certain");
    fixpoint(context, rules, "possible");
  }
  const constraints = program.constraints.map((constraint) => judgeConstraint(context, constraint));
  return { relations, demands: context.demands, constraints };
}

function fixpoint(context: Context, rules: Array<{ rule: Rule; index: number }>, mode: Mode): void {
  for (let changed = true; changed;) {
    changed = false;
    for (const { rule, index } of rules) {
      const target = context.relations.get(rule.predicate) as Relation;
      const bound = mode === "certain" ? target.certain : target.possible;
      for (const solution of solve(context, rule.body, 0, new Map(), mode, true, [], mode === "possible")) {
        const args = rule.head.map((term) => substitute(term, solution.env));
        const key = tupleKey(args);
        const existing = bound.get(key);
        const settled = mode === "certain" || solution.settled;
        if (existing === undefined || (settled && !existing.settled)) {
          bound.set(key, { args, settled, derivation: { rule: index, premises: solution.premises } });
          changed = true;
        }
      }
    }
  }
}

/**
 * Solves a conjunction left to right. `settled` says every oracle literal read so far
 * is answered; `record` lets possible-mode oracle literals raise demands.
 */
function* solve(
  context: Context,
  literals: Literal[],
  index: number,
  env: Env,
  mode: Mode,
  settled: boolean,
  premises: Premise[],
  record: boolean,
): Generator<Solution> {
  const literal = literals[index];
  if (literal === undefined) {
    yield { env, settled, premises };
    return;
  }
  const next = (solution: Solution): Generator<Solution> =>
    solve(context, literals, index + 1, solution.env, mode, solution.settled, solution.premises, record);
  for (const solution of solveLiteral(context, literal, env, mode, settled, premises, record)) {
    yield* next(solution);
  }
}

function* solveLiteral(
  context: Context,
  literal: Literal,
  env: Env,
  mode: Mode,
  settled: boolean,
  premises: Premise[],
  record: boolean,
): Generator<Solution> {
  switch (literal.kind) {
    case "pos":
    case "neg": {
      const oracle = context.oracles.get(literal.predicate);
      if (oracle !== undefined) {
        yield* solveOracle(context, oracle, literal.args, literal.kind === "pos", env, mode, settled, premises, record);
        return;
      }
      const relation = context.relations.get(literal.predicate) ?? { certain: new Map<string, TupleEntry>(), possible: new Map<string, TupleEntry>() };
      if (literal.kind === "pos") {
        const bound = mode === "certain" ? relation.certain : relation.possible;
        const pattern = literal.args.map((arg) => substitute(arg, env));
        const exact = pattern.every(isGround) ? bound.get(tupleKey(pattern)) : undefined;
        const candidates = exact === undefined ? (pattern.every(isGround) ? [] : bound.values()) : [exact];
        for (const entry of candidates) {
          const unified = unifyAll(pattern, entry.args, env);
          if (unified !== undefined) {
            yield {
              env: unified,
              settled: settled && entry.settled,
              premises: [...premises, { kind: "atom", predicate: literal.predicate, key: tupleKey(entry.args) }],
            };
          }
        }
        return;
      }
      // `not G` holds certainly when no possible tuple matches G, possibly when no
      // certain one does; an anonymous argument matches anything.
      const args = literal.args.map((arg) => substitute(arg, env));
      const matching = (bound: Map<string, TupleEntry>): TupleEntry[] => args.every(isGround)
        ? [bound.get(tupleKey(args))].filter((entry): entry is TupleEntry => entry !== undefined)
        : [...bound.values()].filter((entry) => unifyAll(args, entry.args, env) !== undefined);
      const premise: Premise = { kind: "not", atom: atomText(literal.predicate, args) };
      if (mode === "certain") {
        if (matching(relation.possible).length === 0) {
          yield { env, settled, premises: [...premises, premise] };
        }
      } else if (matching(relation.certain).length === 0) {
        yield { env, settled: settled && matching(relation.possible).every((entry) => entry.settled), premises: [...premises, premise] };
      }
      return;
    }
    case "present": {
      const document = substitute(literal.document, env);
      const candidateTerm = substitute(literal.candidates, env);
      const listed = listItems(candidateTerm) ?? [];
      if (!isGround(document)) {
        return;
      }
      const documentId = termText(document);
      const sections = sectionIdsInOrder(context, documentId);
      const wanted = new Set(listed.map((candidate) => termText(candidate)));
      const presentIds = sections.filter((id) => wanted.has(id));
      // Zero present members has no derivation: a v1 `scope: combined` item whose candidates all
      // miss is v1's missing-coverage failure, and the module states that as a companion
      // constraint over a rule whose body is this literal. Failing here means the combined
      // constraint binds nothing (vacuously satisfied, no question asked) and the guard reddens.
      if (presentIds.length === 0) {
        return;
      }
      const present = list(presentIds.map((id) => atom(id)));
      const unified = unifyAll([literal.present], [present], env);
      if (unified !== undefined) {
        yield {
          env: unified,
          settled,
          premises: [...premises, { kind: "builtin", text: `present(${documentId}, ${String(presentIds.length)} of ${String(listed.length)} in ${termText(candidateTerm)})` }],
        };
      }
      return;
    }
    case "in": {
      const item = substitute(literal.item, env);
      const listTerm = substitute(literal.list, env);
      const items = listItems(listTerm) ?? [];
      if (items.some((candidate) => writeTerm(candidate) === writeTerm(item))) {
        yield { env, settled, premises: [...premises, { kind: "builtin", text: `${termText(item)} in ${termText(listTerm)}` }] };
      }
      return;
    }
    case "cmp": {
      const left = bounds(substitute(literal.left, env));
      const right = bounds(substitute(literal.right, env));
      if (left !== undefined && right !== undefined && compare(literal.op, left, right, mode)) {
        const text = `${termText(substitute(literal.left, env))} ${literal.op} ${termText(substitute(literal.right, env))}`;
        yield { env, settled, premises: [...premises, { kind: "builtin", text }] };
      }
      return;
    }
    case "count": {
      const distinct = (solutions: Iterable<Solution>): { size: number; settled: boolean } => {
        const seen = new Set<string>();
        let allSettled = true;
        for (const solution of solutions) {
          seen.add(writeTerm(substitute(literal.variable, solution.env)));
          allSettled &&= solution.settled;
        }
        return { size: seen.size, settled: allSettled };
      };
      const low = distinct(solve(context, literal.goal, 0, env, "certain", settled, [], false)).size;
      const high = distinct(solve(context, literal.goal, 0, env, "possible", settled, [], record && mode === "possible"));
      const value = low === high.size ? number(low) : compound("dv_interval", [number(low), number(high.size)]);
      const unified = unifyAll([literal.result], [value], env);
      if (unified !== undefined) {
        const text = `count(${termText(literal.variable)}) = ${low === high.size ? String(low) : `[${String(low)}, ${String(high.size)}]`}`;
        yield { env: unified, settled: settled && high.settled, premises: [...premises, { kind: "builtin", text }] };
      }
      return;
    }
  }
}

function* solveOracle(
  context: Context,
  oracle: Oracle,
  args: Term[],
  positive: boolean,
  env: Env,
  mode: Mode,
  settled: boolean,
  premises: Premise[],
  record: boolean,
): Generator<Solution> {
  const inputs = oracle.inputs.map((position) => substitute(args[position] as Term, env));
  if (!inputs.every(isGround)) {
    throw new Error(`${oracle.predicate} was reached with unbound inputs; the checker should have rejected it`);
  }
  const key = oracleAtomKey(oracle.predicate, inputs);
  const answer = context.view.lookup(key);
  if (answer === undefined && mode === "possible" && record && settled) {
    context.demands.set(key, { key, atom: atomText(oracle.predicate, inputs), oracle, inputs });
  }
  const known = answer === undefined || answer.label === UNKNOWN ? undefined : answer.label;
  const answeredSettled = settled && answer !== undefined;
  const choose = oracle.source.choose !== undefined;
  const premiseFor = (label: string | undefined): Premise => ({
    kind: "oracle",
    predicate: oracle.predicate,
    key,
    atom: atomText(oracle.predicate, choose ? [...inputs, atom(label ?? "_")] : inputs),
    negated: !positive,
  });
  if (!choose) {
    // An `ask` oracle is a choose over holds and fails.
    const holds = positive
      ? (mode === "certain" ? known === "holds" : known !== "fails")
      : (mode === "certain" ? known === "fails" : known !== "holds");
    if (holds) {
      yield { env, settled: known === undefined ? answeredSettled : settled, premises: [...premises, premiseFor(undefined)] };
    }
    return;
  }
  const labelTerm = args.at(-1) as Term;
  if (!positive) {
    const label = substitute(labelTerm, env);
    const other = known !== undefined && writeTerm(atom(known)) !== writeTerm(label);
    const holds = mode === "certain" ? other : known === undefined || other;
    if (holds) {
      yield { env, settled: known === undefined ? answeredSettled : settled, premises: [...premises, premiseFor(termText(label))] };
    }
    return;
  }
  const candidates = known !== undefined ? [known] : mode === "possible" ? oracle.labels : [];
  for (const label of candidates) {
    const unified = unifyAll([labelTerm], [atom(label)], env);
    if (unified !== undefined) {
      yield { env: unified, settled: known === undefined ? answeredSettled : settled, premises: [...premises, premiseFor(label)] };
    }
  }
}

/** The numeric interval a comparison operand denotes; a count may be an interval. */
function bounds(term: Term): [number, number] | undefined {
  if (term.kind === "number") {
    return [term.value, term.value];
  }
  if (term.kind === "compound" && term.functor === "dv_interval") {
    const [low, high] = term.args;
    if (low?.kind === "number" && high?.kind === "number") {
      return [low.value, high.value];
    }
  }
  return undefined;
}

/** Certain when the comparison holds over the whole interval, possible when for some value in it. */
function compare(op: string, [aLow, aHigh]: [number, number], [bLow, bHigh]: [number, number], mode: Mode): boolean {
  const all = mode === "certain";
  switch (op) {
    case "<": return all ? aHigh < bLow : aLow < bHigh;
    case ">": return all ? aLow > bHigh : aHigh > bLow;
    case "=<": return all ? aHigh <= bLow : aLow <= bHigh;
    case ">=": return all ? aLow >= bHigh : aHigh >= bLow;
    case "=:=": return all ? aLow === aHigh && bLow === bHigh && aLow === bLow : aLow <= bHigh && bLow <= aHigh;
    case "=\\=": return all ? aHigh < bLow || bHigh < aLow : !(aLow === aHigh && bLow === bHigh && aLow === bLow);
    default: return false;
  }
}

export function substitute(term: Term, env: Env): Term {
  if (term.kind === "var") {
    return term.name === "_" ? term : env.get(term.name) ?? term;
  }
  if (term.kind === "compound") {
    return compound(term.functor, term.args.map((arg) => substitute(arg, env)));
  }
  return term;
}

function isGround(term: Term): boolean {
  return term.kind === "var" ? false : term.kind === "compound" ? term.args.every(isGround) : true;
}

/** Matches a pattern (with variables) against ground values, extending `env`. */
function unifyAll(patterns: Term[], values: Term[], env: Env): Env | undefined {
  let current: Map<string, Term> | undefined;
  const bind = (pattern: Term, value: Term): boolean => {
    if (pattern.kind === "var") {
      if (pattern.name === "_") {
        return true;
      }
      const bound = (current ?? env).get(pattern.name);
      if (bound !== undefined) {
        return writeTerm(bound) === writeTerm(value);
      }
      current ??= new Map(env);
      current.set(pattern.name, value);
      return true;
    }
    if (pattern.kind === "compound") {
      return value.kind === "compound" && value.functor === pattern.functor && value.args.length === pattern.args.length
        && pattern.args.every((arg, position) => bind(arg, value.args[position] as Term));
    }
    return writeTerm(pattern) === writeTerm(value);
  };
  for (const [position, pattern] of patterns.entries()) {
    if (!bind(pattern, values[position] as Term)) {
      return undefined;
    }
  }
  return current ?? env;
}

/**
 * The population is the possible bindings of `forall`, projected onto its named
 * variables, so an unresolved class never silently narrows it; each binding records
 * whether it is certain. Every goal solution is visited in possible mode so the round
 * schedule sees every instance that is still possible.
 */
function judgeConstraint(context: Context, constraint: Constraint): ConstraintEvaluation {
  const names = [...new Set(constraint.forall.flatMap((literal) => literalVariables(literal)))];
  const groups = new Map<string, { env: Map<string, Term>; possible: Solution; certain: Solution | undefined }>();
  for (const solution of solve(context, constraint.forall, 0, new Map(), "possible", true, [], true)) {
    const env = new Map(names.flatMap((name) => {
      const value = solution.env.get(name);
      return value === undefined ? [] : [[name, value] as const];
    }));
    const key = names.map((name) => writeTerm(env.get(name) ?? atom("_"))).join("|");
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, { env, possible: solution, certain: undefined });
    } else if (solution.settled && !group.possible.settled) {
      group.possible = solution;
    }
  }
  for (const solution of solve(context, constraint.forall, 0, new Map(), "certain", true, [], false)) {
    const key = names.map((name) => writeTerm(solution.env.get(name) ?? atom("_"))).join("|");
    const group = groups.get(key);
    if (group !== undefined && group.certain === undefined) {
      group.certain = solution;
    }
  }

  const bindings = [...groups.values()].map(({ env, possible, certain }): BindingResult => {
    const certainGoal = first(solve(context, constraint.goal, 0, env, "certain", true, [], false));
    let possibleGoal: Solution | undefined;
    // The goal continues the forall instance: its oracles wait for the forall's answers.
    for (const solution of solve(context, constraint.goal, 0, env, "possible", possible.settled, [], true)) {
      possibleGoal ??= solution;
    }
    const isCertain = certain !== undefined;
    const forall = (certain ?? possible).premises;
    const forallMode: Mode = isCertain ? "certain" : "possible";
    let status: BindingStatus;
    if (constraint.mode === "require") {
      status = certainGoal !== undefined ? "satisfied" : isCertain && possibleGoal === undefined ? "violated" : "undetermined";
    } else {
      status = possibleGoal === undefined ? "satisfied" : isCertain && certainGoal !== undefined ? "violated" : "undetermined";
    }
    const goalSolution = certainGoal ?? possibleGoal;
    return {
      env,
      certain: isCertain,
      status,
      forall,
      forallMode,
      goal: goalSolution?.premises,
      goalMode: certainGoal !== undefined ? "certain" : "possible",
      missing: constraint.mode === "require" && status === "violated" ? missingLiterals(context, constraint.goal, env) : [],
    };
  });
  return { constraint, bindings };
}

/**
 * For a violated `require`, walks the goal left to right with the certain prefix
 * solutions and reports each literal that no prefix solution could make possible.
 * Bounded abduction: it names what is missing and searches no alternatives.
 */
function missingLiterals(context: Context, goal: Literal[], env: Env): Array<{ literal: string; after: Premise[] }> {
  const LIMIT = 5;
  let frontier: Solution[] = [{ env, settled: true, premises: [] }];
  for (const [index, literal] of goal.entries()) {
    const extended: Solution[] = [];
    for (const solution of frontier) {
      for (const next of solveLiteral(context, literal, solution.env, "possible", true, solution.premises, false)) {
        extended.push(next);
      }
    }
    if (extended.length === 0) {
      return frontier.slice(0, LIMIT).map((solution) => ({ literal: literalText(goal[index] as Literal, solution.env), after: solution.premises }));
    }
    frontier = extended;
  }
  return [];
}

export function literalText(literal: Literal, env: Env): string {
  const show = (term: Term): string => termText(substitute(term, env));
  switch (literal.kind) {
    case "pos":
      return atomText(literal.predicate, literal.args.map((arg) => substitute(arg, env)));
    case "neg":
      return `not ${atomText(literal.predicate, literal.args.map((arg) => substitute(arg, env)))}`;
    case "in":
      return `${show(literal.item)} in ${show(literal.list)}`;
    case "cmp":
      return `${show(literal.left)} ${literal.op} ${show(literal.right)}`;
    case "count":
      return `count(${show(literal.variable)}, ${literal.goal.map((inner) => literalText(inner, env)).join(", ")}, ${show(literal.result)})`;
    case "present":
      return `present(${show(literal.document)}, ${show(literal.candidates)}, ${show(literal.present)})`;
  }
}

function literalVariables(literal: Literal): string[] {
  const terms = literal.kind === "pos" || literal.kind === "neg" ? literal.args
    : literal.kind === "in" ? [literal.item, literal.list]
      : literal.kind === "cmp" ? [literal.left, literal.right]
        : literal.kind === "present" ? [literal.document, literal.candidates, literal.present]
          : [literal.result];
  const names: string[] = [];
  const visit = (term: Term): void => {
    if (term.kind === "var" && term.name !== "_") {
      names.push(term.name);
    } else if (term.kind === "compound") {
      term.args.forEach(visit);
    }
  };
  terms.forEach(visit);
  return names;
}

function first<T>(iterator: Iterator<T>): T | undefined {
  const step = iterator.next();
  return step.done === true ? undefined : step.value;
}
