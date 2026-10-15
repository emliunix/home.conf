/**
 * The design 04/06 engine: a verification module is the program. The host parses and
 * checks it; the WFS kernel (doc-verify/src/kernel) evaluates it over segmenter facts,
 * asking the judge in at most `rounds` keyed batches per document.
 */

import type { JudgeBackend } from "deepclause-sdk";

import { PolicyViolationError } from "../judge.js";
import { Kernel, PrologError } from "../kernel/kernel.js";
import { UNKNOWN } from "./demand.js";
import { answersFromStore, demandsFromKeys } from "../kernel/keys.js";
import { translateProgram, type FactTerm } from "../kernel/translate.js";
import { BlockedError } from "../types.js";
import { checkModule, type Constraint, type Literal, type Program, type Rule } from "./checker.js";
import { constraintReports, decideVerdict, type EngineFailure, type EngineReport } from "./diagnostics.js";
import { documentFacts, type DocumentFacts, type DocumentInput } from "./facts.js";
import { loadModule, ModuleError } from "./module.js";
import { askRound, OracleStore, type OracleCache, type OutboundPolicy, type RequestRecord } from "./oracles.js";

export { bindingBasis, bindingReason, bindingSections, bindingSpan, renderProof, renderReport } from "./diagnostics.js";
export type { BindingReport, ConstraintReport, EngineReport, ProofNode, ProofOracle } from "./diagnostics.js";
export { ModuleError } from "./module.js";
export { composeModules, engineLibraries, readEngineLibrary, type ComposedModule } from "./compose.js";
export { applyThreshold, memoryOracleCache } from "./oracles.js";
export type { OracleCache, OracleLeaf, OutboundPolicy, RequestRecord } from "./oracles.js";
export type { DocumentInput } from "./facts.js";
export type { Demand } from "./demand.js";
export { UNKNOWN, oracleAtomKey } from "./demand.js";

/** Round-5 calibrated budget (K=20 × corpus max); host stops runaway evaluation. */
const INFERENCE_BUDGET = 876_940;

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
  /** Override the default inference budget (tests inject a tiny limit). */
  inferenceBudget?: number;
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
  const program: Program = { ...compiled, constraints: selected, rules: reachableRules(compiled, selected) };
  const skipped = compiled.constraints.filter((constraint) => !inProfile(constraint.profiles)).map((constraint) => constraint.id);

  const documents = new Map<string, DocumentFacts>();
  for (const document of input.documents) {
    if (documents.has(document.path)) {
      throw new BlockedError(`document ${document.path} is listed twice`);
    }
    documents.set(document.path, documentFacts(document));
  }
  const facts = [...documents.values()].flatMap((document) => document.facts) as FactTerm[];
  const store = new OracleStore();
  const requests: RequestRecord[] = [];
  let failure: EngineFailure | undefined;
  const budget = input.inferenceBudget ?? INFERENCE_BUDGET;
  let lastReport = await evalKernel(program, facts, store, budget);

  for (let round = 1; round <= program.rounds && failure === undefined; round += 1) {
    if (lastReport.rejected) {
      throw new ModuleError([`kernel refused the module: ${lastReport.rejected}`]);
    }
    if (lastReport.blocked || lastReport.resource) break;
    const demandKeys = lastReport.demand.prefix;
    if (demandKeys.length === 0) break;
    const demands = demandsFromKeys(demandKeys, program);
    if (demands.length === 0) break;
    try {
      requests.push(...await askRound({
        round, demands, documents, store,
        backend: input.backend, unavailable: input.unavailable, model: input.model, policy: input.policy,
        requestShape: program.requestShape, cache: input.cache,
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
    lastReport = await evalKernel(program, facts, store, budget);
  }

  if (lastReport.rejected) {
    throw new ModuleError([`kernel refused the module: ${lastReport.rejected}`]);
  }
  if (lastReport.blocked) {
    failure = { verdict: "BLOCKED", message: `kernel inference budget exceeded (${String(lastReport.budget)})` };
  } else if (lastReport.resource) {
    failure = { verdict: "BLOCKED", message: `kernel resource error (${lastReport.resource})` };
  }

  const findings: string[] = [];
  if (failure === undefined && lastReport.demand.prefix.length > 0) {
    findings.push(`${String(lastReport.demand.prefix.length)} oracle atoms were still unasked after ${String(program.rounds)} rounds: ${lastReport.demand.prefix.slice().sort().join(", ")}`);
  }
  const oracles = [...store.leaves.values()].sort((a, b) => a.round - b.round || a.atom.localeCompare(b.atom));
  // Coverage is the set of atoms that were DEMANDED and not evaluated, which is not the set of stored
  // leaves. Three populations have to be counted, and leaving any one out lets an unevaluated
  // constraint reach a `PASS`:
  //
  //   1. still demanded after the round limit (`lastReport.demand.prefix`) -- no leaf was ever
  //      created, so a leaf-only walk cannot see them at all;
  //   2. a leaf whose evidence never resolved (`key === "-"`, the `unaskedLeaf` marker);
  //   3. a leaf that WAS sent but got no usable answer -- the judge returned nothing, answered a
  //      different atom, or answered twice. `thresholdLeaf` gives these a real evidence key, so
  //      testing the key alone counts them as asked. `answered === UNKNOWN` is the marker, and it is
  //      the same sentinel a judge uses to say "unknown", which is the distinction that matters:
  //      both are an absence of an answer, and neither can support a `PASS`.
  const neverSent = oracles.filter((leaf) => leaf.key === "-");
  // A leaf WITH a real key whose label came back `unknown` was sent and answered nothing usable --
  // either the judge returned no answer, or it answered `unknown`, or the distribution could not
  // decide. `asked` means "the judge produced a usable evaluation", so these are not asked either,
  // but they are not `unasked` -- the judge was reached and asked.
  const noUsableAnswer = oracles.filter((leaf) => leaf.key !== "-" && leaf.answered === UNKNOWN);
  // ⚠ The prefix keys and the leaf atoms are the SAME atom in two spellings -- a raw key reads
  // `m::p('d.md',s)` where the leaf's atom reads `m.p(d.md, s)`. Compare them in one form or the
  // same atom is counted twice. `demandsFromKeys` is the canonicalizer: it yields the host key and
  // `atomText`, which is exactly what a leaf carries.
  //
  // The exclusion is against EVERY leaf, not only the never-sent ones. An atom the judge was sent
  // and returned nothing for keeps its demand (the kernel excludes only *answered* atoms from a
  // demand list), so it appears in the prefix AND as a real-key leaf -- and it is already reported
  // in `unanswered`. Excluding it here keeps one atom to one line.
  const leafAtoms = new Set(oracles.map((leaf) => leaf.atom));
  const prefixUnasked = demandsFromKeys(lastReport.demand.prefix, program)
    .filter((demand) => !leafAtoms.has(demand.atom))
    .map((demand) => demand.atom);
  const unasked = [...prefixUnasked, ...neverSent.map((leaf) => leaf.atom)];
  const unanswered = noUsableAnswer.map((leaf) => leaf.atom);
  // ⚠ A kernel that HALTED (budget or resource) demanded nothing, so both populations are empty
  // and an empty-only test reports `complete: true` for a run that evaluated NOTHING. Measured: a
  // budget halt gave `{"unasked":[],"unanswered":[],"asked":0,"complete":true}` with zero leaves.
  // `complete` has to mean "every constraint was evaluated", so a halt is incomplete by
  // construction, whatever the demand lists say.
  const halted = lastReport.blocked !== undefined || lastReport.resource !== undefined;
  // Two axes, and they are not the same number: `asked` counts the atoms that were SENT to the
  // judge, `evaluated` counts those that came back with a usable evaluation. An atom the judge was
  // reached for and returned nothing usable on was asked and not evaluated. Collapsing them made
  // `asked` a false name -- it said "the judge answered this" about atoms it never answered.
  const asked = oracles.length - neverSent.length;
  const coverage = {
    unasked,
    unanswered,
    asked,
    evaluated: asked - noUsableAnswer.length,
    complete: unasked.length === 0 && unanswered.length === 0 && !halted,
  };
  for (const leaf of oracles) {
    if (leaf.finding !== undefined) {
      findings.push(`${leaf.atom}: ${leaf.finding}`);
    }
  }
  for (const [id, rows] of Object.entries(lastReport.unfounded)) {
    for (const row of rows) {
      findings.push(`unfounded ${id}: ${row.atom}`);
    }
  }

  const constraints = halted
    ? program.constraints.map((constraint) => ({
        id: constraint.id,
        status: "undetermined" as const,
        severity: constraint.severity,
        weight: constraint.weight,
        mode: constraint.mode,
        population: 0,
        certainPopulation: 0,
        bindings: [],
      }))
    : constraintReports(program, lastReport, store);
  const { verdict, decidedBy } = decideVerdict(constraints, failure, program.warningThreshold);
  // `doc-verify:verdict/coverage`: a `PASS` asserts that every constraint was evaluated, so it
  // cannot survive an atom that was never asked. An incomplete run with no conclusive failure is
  // BLOCKED -- the same class as a failed round -- instead of a quiet PASS.
  const decided = coverage.complete || verdict !== "PASS"
    ? { verdict, decidedBy }
    : { verdict: "BLOCKED" as const, decidedBy: "coverage" };
  return {
    module: program.module,
    hash: program.hash,
    rounds: program.rounds,
    profile: input.profile,
    verdict: decided.verdict,
    decidedBy: decided.decidedBy,
    coverage,
    requests,
    constraints,
    skipped,
    oracles,
    findings,
    failure,
  };
}

/** One fresh kernel instance per evaluation (round 7 finding 3). */
async function evalKernel(program: Program, facts: FactTerm[], store: OracleStore, budget: number) {
  const text = translateProgram(program, facts);
  const kernel = await Kernel.create();
  try {
    await kernel.load(text, { sandbox: true });
  } catch (e) {
    if (e instanceof PrologError && /core_rejected/.test(e.prolog)) {
      const m = /core_rejected\(([^,]+),(.*)\)$/.exec(e.prolog);
      return {
        statuses: {},
        certain: {},
        populations: {},
        proofs: {},
        demand: { full: [] as string[], prefix: [] as string[] },
        missing: {},
        unfounded: {},
        rejected: m ? `${m[1]}: ${m[2]}` : e.prolog,
      };
    }
    throw e;
  }
  kernel.setAnswers(answersFromStore(store));
  return kernel.evaluate(program, { budget });
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
