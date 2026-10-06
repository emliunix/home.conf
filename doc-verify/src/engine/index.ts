/**
 * The design 04 engine: a verification module is the program. The runtime's Prolog
 * reader parses it, the checker makes it finite and explainable, and the two-bound
 * evaluator runs it over segmenter facts, asking the judge in at most `rounds` keyed
 * batches per document.
 */

import type { JudgeBackend } from "deepclause-sdk";

import { PolicyViolationError } from "../judge.js";
import { BlockedError } from "../types.js";
import { checkModule, type Constraint, type Literal, type Program, type Rule } from "./checker.js";
import { constraintReports, decideVerdict, type EngineFailure, type EngineReport } from "./diagnostics.js";
import { evaluate } from "./evaluate.js";
import { documentFacts, type DocumentFacts, type DocumentInput } from "./facts.js";
import { loadModule } from "./module.js";
import { askRound, OracleStore, type OracleCache, type OutboundPolicy, type RequestRecord } from "./oracles.js";

export { bindingBasis, bindingReason, bindingSections, bindingSpan, renderProof, renderReport } from "./diagnostics.js";
export type { BindingReport, ConstraintReport, EngineReport, ProofNode, ProofOracle } from "./diagnostics.js";
export { ModuleError } from "./module.js";
export { composeModules, engineLibraries, type ComposedModule } from "./compose.js";
export { applyThreshold, memoryOracleCache } from "./oracles.js";
export type { OracleCache, OracleLeaf, OutboundPolicy, RequestRecord } from "./oracles.js";
export type { DocumentInput } from "./facts.js";

export interface RunProgramInput {
  moduleYaml: string;
  documents: DocumentInput[];
  /**
   * The judge. Absent when none is available (no key): every constraint whose goal involves no
   * oracle is still decided, and the first round that must ask the judge fails BLOCKED with
   * `unavailable` as its message.
   */
  backend: JudgeBackend | undefined;
  unavailable?: string;
  model: string;
  policy: OutboundPolicy;
  /** Runs only constraints without `profiles` or listing this profile. */
  profile?: string;
  cache?: OracleCache;
}

/** Loads and checks a module; a malformed module throws `ModuleError`. */
export async function compileModule(moduleYaml: string): Promise<Program> {
  return checkModule(await loadModule(moduleYaml));
}

export async function runProgram(input: RunProgramInput): Promise<EngineReport> {
  const compiled = await compileModule(input.moduleYaml);
  const inProfile = (profiles: string[] | undefined): boolean =>
    profiles === undefined || input.profile === undefined || profiles.includes(input.profile);
  const selected = compiled.constraints.filter((constraint) => inProfile(constraint.profiles));
  // Only rules some selected constraint can reach are evaluated, so an oracle that only
  // out-of-profile constraints depend on is never asked (a draft asks nothing it does not use).
  const program: Program = { ...compiled, constraints: selected, rules: reachableRules(compiled, selected) };
  const skipped = compiled.constraints.filter((constraint) => !inProfile(constraint.profiles)).map((constraint) => constraint.id);

  const documents = new Map<string, DocumentFacts>();
  for (const document of input.documents) {
    if (documents.has(document.path)) {
      throw new BlockedError(`document ${document.path} is listed twice`);
    }
    documents.set(document.path, documentFacts(document));
  }
  const facts = [...documents.values()].flatMap((document) => document.facts);
  const store = new OracleStore();
  const requests: RequestRecord[] = [];
  let failure: EngineFailure | undefined;

  for (let round = 1; round <= program.rounds && failure === undefined; round += 1) {
    const { demands } = evaluate(program, facts, store);
    if (demands.size === 0) {
      break;
    }
    try {
      requests.push(...await askRound({
        round, demands: [...demands.values()], documents, store,
        backend: input.backend, unavailable: input.unavailable, model: input.model, policy: input.policy, cache: input.cache,
      }));
    } catch (error) {
      if (error instanceof PolicyViolationError) {
        failure = { verdict: "NO-GO", message: error.message };
      } else if (error instanceof BlockedError) {
        failure = { verdict: "BLOCKED", message: error.message };
      } else {
        throw error;
      }
    }
  }

  const evaluation = evaluate(program, facts, store);
  const findings: string[] = [];
  if (failure === undefined && evaluation.demands.size > 0) {
    // The depth check makes this unreachable for a checked module; report it if it is not.
    findings.push(`${String(evaluation.demands.size)} oracle atoms were still unasked after ${String(program.rounds)} rounds: ${[...evaluation.demands.keys()].sort().join(", ")}`);
  }
  const oracles = [...store.leaves.values()].sort((a, b) => a.round - b.round || a.atom.localeCompare(b.atom));
  for (const leaf of oracles) {
    if (leaf.finding !== undefined) {
      findings.push(`${leaf.atom}: ${leaf.finding}`);
    }
  }
  const constraints = constraintReports(program, evaluation, store);
  const { verdict, decidedBy } = decideVerdict(constraints, failure, program.warningThreshold);
  return {
    module: program.module,
    hash: program.hash,
    rounds: program.rounds,
    profile: input.profile,
    verdict,
    decidedBy,
    requests,
    constraints,
    skipped,
    oracles,
    findings,
    failure,
  };
}

/** The rules whose predicates the given constraints reach, directly or through other rules. */
function reachableRules(program: Program, constraints: Constraint[]): Rule[] {
  const needed = new Set<string>();
  const pending: string[] = [];
  const visit = (literals: Literal[]): void => {
    for (const literal of literals) {
      if (literal.kind === "pos" || literal.kind === "neg") {
        if (!needed.has(literal.predicate)) {
          needed.add(literal.predicate);
          pending.push(literal.predicate);
        }
      } else if (literal.kind === "count") {
        visit(literal.goal);
      }
    }
  };
  for (const constraint of constraints) {
    visit([...constraint.forall, ...constraint.goal]);
  }
  for (let predicate = pending.pop(); predicate !== undefined; predicate = pending.pop()) {
    for (const rule of program.rules) {
      if (rule.predicate === predicate) {
        visit(rule.body);
      }
    }
  }
  return program.rules.filter((rule) => needed.has(rule.predicate));
}
