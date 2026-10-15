/**
 * Constraint results, proof trees and the verdict (design 04 §Diagnostics).
 *
 * For each constraint the report gives its population with a count before any
 * judgment, its status, and for each binding its values, rendered message and repair
 * hint, the missing literals of a violated `require`, and a proof tree down to facts
 * and oracle leaves.
 */

import type { Verdict } from "../types.js";
import type { BindingStatus, Mode } from "./demand.js";
import type { OracleLeaf, OracleSpan, RequestRecord } from "./oracles.js";
import { constraintReportsFromKernel } from "./kernel-bridge.js";

export { constraintReportsFromKernel as constraintReports };

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
  /** The oracle's own note (a missing or misaligned distribution, a tie, a threshold demotion). */
  finding?: string | undefined;
  /** The deciding span for a non-passing atom (option B), or the section fallback (option C). */
  span?: OracleSpan | undefined;
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

/**
 * Which oracle atoms the run could not evaluate. Coverage is reported separately from the verdict
 * because the two are different facts: a document can fail *and* part of it remain unjudged, and a
 * caller that only sees the verdict cannot tell that apart from a document that was fully judged.
 */
export interface CoverageReport {
  /** Oracle atoms whose evidence never resolved, so the judge was never asked. */
  unasked: string[];
  /** Oracle atoms the judge answered. */
  asked: number;
  /** `unasked.length === 0`; a `PASS` requires this. */
  complete: boolean;
}

export interface EngineReport {
  module: string;
  hash: string;
  rounds: number;
  profile: string | undefined;
  verdict: Verdict;
  decidedBy: string;
  coverage: CoverageReport;
  requests: RequestRecord[];
  constraints: ConstraintReport[];
  /** Constraints outside the selected profile. */
  skipped: string[];
  /** Every oracle atom asked or resolved, in round then key order. */
  oracles: OracleLeaf[];
  findings: string[];
  failure: EngineFailure | undefined;
}

/** The first span a binding's oracles carry, in proof order (option B, else the C fallback). */
export function bindingSpan(binding: BindingReport): OracleSpan | undefined {
  let found: OracleSpan | undefined;
  const visit = (node: ProofNode): void => {
    if (found === undefined && node.oracle?.span !== undefined) {
      found = node.oracle.span;
    }
    (node.children ?? []).forEach(visit);
  };
  visit(binding.proof);
  return found;
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
  // Kernel budget/resource (and other BLOCKED failures): never treat empty/satisfied constraints as PASS.
  if (failure !== undefined && failure.verdict === "BLOCKED") {
    const by =
      /kernel inference budget/i.test(failure.message) ? "budget"
      : /kernel resource error/i.test(failure.message) ? "resource"
      : "engine";
    return { verdict: "BLOCKED", decidedBy: by };
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

/**
 * What decided a non-satisfied binding, one line each: every oracle leaf in its proof as
 * `answered <label> (p=<value> <|>= threshold <t>) over <sections>` (or `unasked <atom>`), and,
 * for a structural result, `structural: missing <literal>` for a violated require or
 * `structural: <atoms>` for the facts a violated forbid found.
 */
export function bindingBasis(binding: BindingReport): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const visit = (node: ProofNode): void => {
    if (node.oracle !== undefined && !seen.has(node.oracle.key)) {
      seen.add(node.oracle.key);
      const leaf = node.oracle;
      const sections = leaf.sections.join(", ") || "no section";
      if (leaf.distribution.length === 0) {
        lines.push(`answered ${leaf.answered} (no distribution; threshold ${String(leaf.threshold)}) over ${sections}`);
      } else {
        const p = Math.max(...leaf.distribution);
        lines.push(`answered ${leaf.answered} (p=${String(p)} ${p >= leaf.threshold ? ">=" : "<"} threshold ${String(leaf.threshold)}) over ${sections}`);
      }
    } else if (node.kind === "unasked" && !seen.has(node.atom)) {
      seen.add(node.atom);
      lines.push(`unasked ${node.atom}`);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(binding.proof);
  for (const missing of binding.missing) {
    lines.push(`structural: missing ${missing}`);
  }
  if (lines.length === 0) {
    const goal = binding.proof.children?.find((child) => child.kind === "goal");
    const gap = binding.proof.children?.find((child) => child.kind === "missing");
    const atoms = goal?.children?.map((child) => child.atom) ?? [];
    lines.push(`structural: ${atoms.length > 0 ? atoms.join(", ") : gap?.atom ?? binding.proof.atom}`);
  }
  return lines;
}

/**
 * Why a non-satisfied binding is undetermined, one short phrase: the first oracle leaf's own
 * finding (a threshold demotion, a missing distribution, a tie), or `evidence not resolved`
 * for an unasked atom. `bindingBasis` prints the same facts in long form.
 */
export function bindingReason(binding: BindingReport): string | undefined {
  const reasons: string[] = [];
  const visit = (node: ProofNode): void => {
    if (reasons.length > 0) {
      return;
    }
    if (node.kind === "unasked") {
      reasons.push("evidence not resolved");
    } else if (node.oracle !== undefined) {
      const oracle = node.oracle;
      if (oracle.finding !== undefined) {
        reasons.push(oracle.finding);
      } else if (oracle.answered === "unknown" || oracle.label === "unknown") {
        reasons.push(oracle.distribution.length === 0 ? "no distribution from the judge" : "below the oracle's threshold");
      }
    }
    (node.children ?? []).forEach(visit);
  };
  visit(binding.proof);
  return reasons[0];
}

/** The section ids a binding's oracles read, in proof order. */
export function bindingSections(binding: BindingReport): string[] {
  const sections: string[] = [];
  const visit = (node: ProofNode): void => {
    for (const section of node.oracle?.sections ?? []) {
      if (!sections.includes(section)) {
        sections.push(section);
      }
    }
    (node.children ?? []).forEach(visit);
  };
  visit(binding.proof);
  return sections;
}

export function renderProof(node: ProofNode, indent: string): string[] {
  const head = node.oracle === undefined
    ? `${indent}${node.kind} ${node.atom}${node.mode === undefined ? "" : ` [${node.mode}]`}`
    : `${indent}oracle ${node.atom} -> ${oracleSummary(node.oracle)}`;
  return [head, ...(node.children ?? []).flatMap((child) => renderProof(child, `${indent}  `))];
}

function oracleSummary(leaf: ProofOracle): string {
  const distribution = leaf.distribution.length === 0 ? "none" : `[${leaf.distribution.join(", ")}]`;
  const span = leaf.span === undefined ? ""
    : `, span ${String(leaf.span.startLine)}-${String(leaf.span.endLine)} ${leaf.span.judged ? "sentence" : "section (not judged)"}${leaf.span.quote.length > 0 ? ` "${leaf.span.quote}"` : ""}`;
  return `${leaf.label} (answered ${leaf.answered}, distribution ${distribution} over [${leaf.options.join(", ")}], threshold ${String(leaf.threshold)}, key ${leaf.key}, sections ${leaf.sections.join(", ") || "none"}, ${String(leaf.bytes)} bytes, round ${String(leaf.round)}${leaf.cacheHit ? ", cache hit" : ""}${span})`;
}
