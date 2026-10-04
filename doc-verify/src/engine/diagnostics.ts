/**
 * Constraint results, proof trees and the verdict (design 04 §Diagnostics).
 *
 * For each constraint the report gives its population with a count before any
 * judgment, its status, and for each binding its values, rendered message and repair
 * hint, the missing literals of a violated `require`, and a proof tree down to facts
 * and oracle leaves.
 */

import type { Verdict } from "../types.js";
import type { Constraint, Program } from "./checker.js";
import { atomText, type BindingStatus, type ConstraintEvaluation, type Evaluation, type Mode, type Premise } from "./evaluate.js";
import type { OracleLeaf, OracleStore, RequestRecord } from "./oracles.js";
import { termText, type Term } from "./terms.js";

export interface ProofOracle {
  key: string;
  atom: string;
  question: string;
  sections: string[];
  bytes: number;
  label: string;
  answered: string;
  options: string[];
  distribution: number[];
  threshold: number;
  round: number;
  cacheHit: boolean;
}

export interface ProofNode {
  kind: "binding" | "forall" | "goal" | "missing" | "rule" | "fact" | "oracle" | "unasked" | "not" | "builtin";
  atom: string;
  mode?: Mode;
  rule?: string;
  oracle?: ProofOracle;
  children?: ProofNode[];
}

export interface BindingReport {
  status: BindingStatus;
  /** Whether the forall binding itself is certain; a merely possible binding is never violated. */
  certain: boolean;
  values: Record<string, string>;
  message: string;
  repair: string | undefined;
  missing: string[];
  proof: ProofNode;
}

export interface ConstraintReport {
  id: string;
  status: BindingStatus;
  severity: "error" | "warning";
  weight: number;
  mode: "require" | "forbid";
  /** Every possible forall binding; `certainPopulation` of them are certain. */
  population: number;
  certainPopulation: number;
  bindings: BindingReport[];
}

export interface EngineFailure {
  verdict: Exclude<Verdict, "PASS">;
  message: string;
}

export interface EngineReport {
  module: string;
  hash: string;
  rounds: number;
  profile: string | undefined;
  verdict: Verdict;
  decidedBy: string;
  requests: RequestRecord[];
  constraints: ConstraintReport[];
  /** Constraints outside the selected profile. */
  skipped: string[];
  /** Every oracle atom asked or resolved, in round then key order. */
  oracles: OracleLeaf[];
  findings: string[];
  failure: EngineFailure | undefined;
}

export function constraintReports(program: Program, evaluation: Evaluation, store: OracleStore): ConstraintReport[] {
  return evaluation.constraints.map((result) => constraintReport(program, evaluation, store, result));
}

function constraintReport(program: Program, evaluation: Evaluation, store: OracleStore, result: ConstraintEvaluation): ConstraintReport {
  const constraint = result.constraint;
  const bindings = result.bindings.map((binding): BindingReport => {
    const values = Object.fromEntries([...binding.env].map(([name, value]) => [name, termText(value)]));
    const children: ProofNode[] = [
      { kind: "forall", atom: literalsText(constraint, "forall"), mode: binding.forallMode, children: premiseNodes(program, evaluation, store, binding.forall, binding.forallMode) },
    ];
    if (binding.goal !== undefined) {
      children.push({
        kind: "goal", atom: literalsText(constraint, "goal"), mode: binding.goalMode,
        children: premiseNodes(program, evaluation, store, binding.goal, binding.goalMode),
      });
    }
    for (const missing of binding.missing) {
      children.push({
        kind: "missing", atom: `${missing.literal} is not possible`, mode: "possible",
        children: premiseNodes(program, evaluation, store, missing.after, "possible"),
      });
    }
    const templateValues = { ...paramTexts(program.params), ...values };
    return {
      status: binding.status,
      certain: binding.certain,
      values,
      message: constraint.message === undefined
        ? `${constraint.id} is ${binding.status} for ${Object.entries(values).map(([name, value]) => `${name}=${value}`).join(", ")}`
        : fill(constraint.message, templateValues),
      repair: constraint.repair === undefined ? undefined : fill(constraint.repair, templateValues),
      missing: binding.missing.map((missing) => missing.literal),
      proof: { kind: "binding", atom: `${constraint.id}: ${binding.status}`, children },
    };
  });
  const status: BindingStatus = bindings.some((binding) => binding.status === "violated") ? "violated"
    : bindings.some((binding) => binding.status === "undetermined") ? "undetermined" : "satisfied";
  return {
    id: constraint.id,
    status,
    severity: constraint.severity,
    weight: constraint.weight,
    mode: constraint.mode,
    population: bindings.length,
    certainPopulation: bindings.filter((binding) => binding.certain).length,
    bindings,
  };
}

function premiseNodes(program: Program, evaluation: Evaluation, store: OracleStore, premises: Premise[], mode: Mode, seen: Set<string> = new Set()): ProofNode[] {
  return premises.map((premise) => premiseNode(program, evaluation, store, premise, mode, seen));
}

function premiseNode(program: Program, evaluation: Evaluation, store: OracleStore, premise: Premise, mode: Mode, seen: Set<string>): ProofNode {
  switch (premise.kind) {
    case "builtin":
      return { kind: "builtin", atom: premise.text };
    case "not":
      return { kind: "not", atom: `not ${premise.atom}`, mode };
    case "oracle": {
      const leaf = store.leaves.get(premise.key);
      const node: ProofNode = leaf === undefined
        ? { kind: "unasked", atom: premise.atom }
        : { kind: "oracle", atom: premise.atom, oracle: proofOracle(leaf) };
      return premise.negated ? { kind: "not", atom: `not ${premise.atom}`, mode, children: [node] } : node;
    }
    case "atom": {
      const relation = evaluation.relations.get(premise.predicate);
      const entry = (mode === "certain" ? relation?.certain : relation?.possible)?.get(premise.key)
        ?? relation?.possible.get(premise.key);
      if (entry === undefined) {
        return { kind: "fact", atom: `${premise.predicate}(${premise.key})` };
      }
      const text = atomText(premise.predicate, entry.args);
      const rule = entry.derivation.rule === undefined ? undefined : program.rules[entry.derivation.rule];
      if (rule === undefined) {
        return { kind: "fact", atom: text };
      }
      const visit = `${mode}:${premise.predicate}(${premise.key})`;
      if (seen.has(visit)) {
        return { kind: "rule", atom: text, mode, rule: rule.text };
      }
      const inner = new Set(seen).add(visit);
      return {
        kind: "rule", atom: text, mode, rule: rule.text,
        children: premiseNodes(program, evaluation, store, entry.derivation.premises, mode, inner),
      };
    }
  }
}

function proofOracle(leaf: OracleLeaf): ProofOracle {
  return {
    key: leaf.key, atom: leaf.atom, question: leaf.question, sections: leaf.sections, bytes: leaf.bytes,
    label: leaf.label, answered: leaf.answered, options: leaf.options, distribution: leaf.distribution,
    threshold: leaf.threshold, round: leaf.round, cacheHit: leaf.cacheHit,
  };
}

function literalsText(constraint: Constraint, which: "forall" | "goal"): string {
  const text = which === "forall" ? constraint.source.forall : constraint.source.require ?? constraint.source.forbid ?? "";
  return which === "goal" && constraint.mode === "forbid" ? `not (${text})` : text;
}

function paramTexts(params: Record<string, Term>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([name, value]) => [name, termText(value)]));
}

/** `{Name}` becomes a binding value or a param; an unknown name stays as written. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => values[name] ?? match);
}

/**
 * `doc-verify:verdict/strict`: a violated error is NO-GO; an outbound-policy violation is
 * NO-GO; an engine failure that left some constraint undetermined (no judge, a failed or
 * over-budget round) is BLOCKED; an undetermined error is NEEDS-REVIEW; a warning ratio of
 * satisfied weight to total weight below the threshold is NEEDS-REVIEW; otherwise PASS.
 * Precedence is NO-GO, BLOCKED, NEEDS-REVIEW, PASS. A constraint whose goal reads no oracle is
 * always decided, so a structural NO-GO stands whether or not the judge could be asked.
 */
export function decideVerdict(constraints: ConstraintReport[], failure: EngineFailure | undefined, warningThreshold: number): { verdict: Verdict; decidedBy: string } {
  const errors = constraints.filter((constraint) => constraint.severity === "error");
  const violated = errors.find((constraint) => constraint.status === "violated");
  if (violated !== undefined) {
    return { verdict: "NO-GO", decidedBy: violated.id };
  }
  if (failure !== undefined && failure.verdict === "NO-GO") {
    return { verdict: failure.verdict, decidedBy: "engine" };
  }
  if (failure !== undefined && constraints.some((constraint) => constraint.status === "undetermined")) {
    return { verdict: failure.verdict, decidedBy: "engine" };
  }
  const undetermined = errors.find((constraint) => constraint.status === "undetermined");
  if (undetermined !== undefined) {
    return { verdict: "NEEDS-REVIEW", decidedBy: undetermined.id };
  }
  const warnings = constraints.filter((constraint) => constraint.severity === "warning");
  const total = warnings.reduce((sum, constraint) => sum + constraint.weight, 0);
  const satisfied = warnings.filter((constraint) => constraint.status === "satisfied").reduce((sum, constraint) => sum + constraint.weight, 0);
  if (total > 0 && satisfied / total < warningThreshold) {
    return { verdict: "NEEDS-REVIEW", decidedBy: "warning-ratio" };
  }
  return { verdict: "PASS", decidedBy: "all-constraints" };
}

/** Text form of the report; it carries the same fields as the JSON form. */
export function renderReport(report: EngineReport): string {
  const lines: string[] = [
    `module ${report.module} (${report.hash.slice(0, 12)}), rounds ${String(report.rounds)}${report.profile === undefined ? "" : `, profile ${report.profile}`}`,
    `verdict ${report.verdict} (decided by ${report.decidedBy})`,
  ];
  if (report.failure !== undefined) {
    lines.push(`engine: ${report.failure.verdict}: ${report.failure.message}`);
  }
  lines.push(`requests ${String(report.requests.length)}`);
  for (const request of report.requests) {
    lines.push(`  round ${String(request.round)} ${request.document}: ${String(request.questions)} questions, ${String(request.stateBytes)} bytes, ${request.id.slice(0, 12)}`);
  }
  for (const constraint of report.constraints) {
    lines.push("", `constraint ${constraint.id} [${constraint.severity}${constraint.severity === "warning" ? ` weight ${String(constraint.weight)}` : ""}, ${constraint.mode}]`);
    lines.push(`  population ${String(constraint.population)} (${String(constraint.certainPopulation)} certain)`);
    for (const binding of constraint.bindings) {
      lines.push(`    ${Object.entries(binding.values).map(([name, value]) => `${name}=${value}`).join(" ")}${binding.certain ? "" : " (possible)"}`);
    }
    lines.push(`  status ${constraint.status}`);
    for (const binding of constraint.bindings.filter((entry) => entry.status !== "satisfied")) {
      lines.push(`  ${binding.status}: ${binding.message}`);
      if (binding.repair !== undefined) {
        lines.push(`    repair: ${binding.repair}`);
      }
      for (const missing of binding.missing) {
        lines.push(`    missing: ${missing} is not possible`);
      }
      lines.push(...renderProof(binding.proof, "    "));
    }
  }
  if (report.skipped.length > 0) {
    lines.push("", `skipped outside the profile: ${report.skipped.join(", ")}`);
  }
  lines.push("", `oracle questions ${String(report.oracles.length)}`);
  for (const leaf of report.oracles) {
    lines.push(`  r${String(leaf.round)} ${leaf.key} ${leaf.atom} -> ${oracleSummary(leaf)}`);
  }
  if (report.findings.length > 0) {
    lines.push("", "findings");
    lines.push(...report.findings.map((finding) => `  ${finding}`));
  }
  return `${lines.join("\n")}\n`;
}

function renderProof(node: ProofNode, indent: string): string[] {
  const head = node.oracle === undefined
    ? `${indent}${node.kind} ${node.atom}${node.mode === undefined ? "" : ` [${node.mode}]`}`
    : `${indent}oracle ${node.atom} -> ${oracleSummary(node.oracle)}`;
  return [head, ...(node.children ?? []).flatMap((child) => renderProof(child, `${indent}  `))];
}

function oracleSummary(leaf: ProofOracle): string {
  const distribution = leaf.distribution.length === 0 ? "none" : `[${leaf.distribution.join(", ")}]`;
  return `${leaf.label} (answered ${leaf.answered}, distribution ${distribution} over [${leaf.options.join(", ")}], threshold ${String(leaf.threshold)}, key ${leaf.key}, sections ${leaf.sections.join(", ") || "none"}, ${String(leaf.bytes)} bytes, round ${String(leaf.round)}${leaf.cacheHit ? ", cache hit" : ""})`;
}
