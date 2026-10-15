import { Finding, ReportCoverage, VerificationReport, Verdict } from "./types.js";

const exitCodes: Record<Verdict, number> = {
  PASS: 0,
  "NO-GO": 1,
  "NEEDS-REVIEW": 2,
  BLOCKED: 3,
};

export function exitCodeFor(verdict: Verdict): number {
  return exitCodes[verdict];
}

export function renderText(report: VerificationReport, options: { verbose?: boolean } = {}): string {
  if (options.verbose === true) {
    return renderVerboseText(report);
  }
  const lines: string[] = [];
  for (const artifact of report.artifacts) {
    for (const warning of artifact.warnings) {
      lines.push(`${warning.path}:${String(warning.line)} [${warning.sectionId}] ${warning.ruleId} WARN ${warning.message}`);
    }
    for (const finding of artifact.findings) {
      lines.push(...findingLines(finding, false));
    }
  }
  lines.push(...coverageLines(report));
  lines.push(summary(report));
  return `${lines.join("\n")}\n`;
}

function renderVerboseText(report: VerificationReport): string {
  const lines = [
    `verification invocation=${report.invocation} requested-profile=${report.requestedProfile}`,
    `snapshot baseline=${report.baselineId.slice(0, 12)} candidate=${report.candidateId.slice(0, 12)} policy=${String(report.policyVersion)}`,
    `changed roots (${String(report.changedRoots.length)}):`,
    ...listPaths(report.changedRoots),
    `affected documents (${String(report.affectedArtifacts.length)}):`,
    ...listPaths(report.affectedArtifacts),
  ];
  for (const artifact of report.artifacts) {
    lines.push(
      `artifact ${artifact.path} [${artifact.artifactKind}] ${artifact.verdict} profile=${artifact.profile} sections=${String(artifact.sections.length)}`,
      `  impact: ${artifact.impactPath.join(" -> ")}`,
      `  selector trace: ${artifact.selectorTrace.map((entry) => `${entry.action}:${entry.pattern}`).join(" -> ") || "none"}`,
      `  required sections (${String(artifact.requiredSections.length)}): ${artifact.requiredSections.join(",") || "none"}`,
    );
    lines.push(`  semantic: calls=${String(artifact.semanticCalls)} cache-hits=${String(artifact.cacheHits)}`);
    if (artifact.engine !== undefined) {
      lines.push(`  modules: ${artifact.engine.modules.join(" + ")} (${artifact.engine.hash.slice(0, 12)}), requests=${String(artifact.engine.requests)}`);
      lines.push(...artifact.engine.text.trimEnd().split("\n").map((line) => `    ${line}`));
    } else {
      lines.push("  modules: not run");
    }
    for (const warning of artifact.warnings) {
      lines.push(`  warning: ${warning.path}:${String(warning.line)} [${warning.sectionId}] ${warning.ruleId} WARN ${warning.message}`);
    }
    for (const finding of artifact.findings) {
      const [head, ...rest] = findingLines(finding, true);
      lines.push(`  finding: ${head ?? ""}`, ...rest.map((line) => `  ${line}`));
    }
  }
  lines.push(...coverageLines(report));
  lines.push(summary(report));
  return `${lines.join("\n")}\n`;
}

/**
 * A finding's head line, then its repair hint and what decided it. The default names the
 * sections it rests on; `verbose` adds the evidence hash and the binding's proof tree.
 */
function findingLines(finding: Finding, verbose: boolean): string[] {
  const status = finding.status === undefined ? "" : `${finding.status}: `;
  const span = finding.span;
  const location = span === undefined
    ? `${finding.path}:${String(finding.line)}`
    : `${finding.path}:${String(span.startLine)}-${String(span.endLine)}`;
  const sections = finding.sections === undefined || finding.sections.length === 0 ? "" : ` (sections: ${finding.sections.join(", ")})`;
  const evidence = verbose ? ` (evidence: ${finding.evidenceId})` : "";
  const lines = [`${location} [${finding.sectionId}] ${finding.ruleId} ${finding.verdict} ${status}${finding.message}${sections}${evidence}`];
  // The deciding span (also in the default form: it is what a reader acts on), its reason, the
  // judge's answer and distribution (in `basis`), and the repair.
  if (span !== undefined) {
    const what = span.judged ? "deciding sentence" : "section (not judged)";
    const where = span.quote.length > 0 ? `"${span.quote}"` : `lines ${String(span.startLine)}-${String(span.endLine)}`;
    lines.push(`  span: ${what} — ${where}`);
  }
  if (finding.reason !== undefined) {
    lines.push(`  reason: ${finding.reason}`);
  }
  if (finding.repair !== undefined) {
    lines.push(`  repair: ${finding.repair}`);
  }
  lines.push(...(finding.basis ?? []).map((line) => `  ${line}`));
  if (verbose && finding.proof !== undefined) {
    lines.push("  proof:", ...finding.proof.map((line) => `    ${line}`));
  }
  return lines;
}

function listPaths(paths: string[]): string[] {
  return paths.length === 0 ? ["  - none"] : paths.map((file) => `  - ${file}`);
}

  function summary(report: VerificationReport): string {
    const coverage = report.coverage.complete
      ? "coverage: complete"
      : coverageSummary(report.coverage);
    return `${report.verdict}: ${String(report.artifacts.length)} artifact(s), ` +
      `${String(report.artifacts.reduce((sum, artifact) => sum + artifact.sections.length, 0))} section(s), ` +
      `${String(report.warningCount)} warning(s), ` +
      `${String(report.semanticCalls)} semantic call(s), ${String(report.cacheHits)} cache hit(s), ` +
      coverage;
  }

  /**
   * The unasked atoms, one per line, so a reader can tell a conclusive failure from an unevaluable
   * run without parsing the engine's diagnostics.
   */
  /** Names both incomplete populations, because they need different responses. */
  function coverageSummary(coverage: ReportCoverage): string {
    const parts: string[] = [];
    if (coverage.unasked.length > 0) {
      parts.push(`${String(coverage.unasked.length)} oracle atom(s) never asked`);
    }
    if (coverage.unanswered.length > 0) {
      parts.push(`${String(coverage.unanswered.length)} oracle atom(s) asked with no usable answer`);
    }
    // A kernel halt reports no atom in either list, because it never got as far as demanding one.
    // Without this the summary renders as a bare `coverage: `, which reads as a formatting bug
    // rather than as the incomplete run it is.
    if (parts.length === 0) {
      parts.push("incomplete (the run halted before every constraint was evaluated)");
    }
    return `coverage: ${parts.join("; ")}`;
  }

  function coverageLines(report: VerificationReport): string[] {
    return [
      ...report.coverage.unasked.map((atom) => `  unasked ${atom}`),
      ...report.coverage.unanswered.map((atom) => `  unanswered ${atom}`),
    ];
  }
