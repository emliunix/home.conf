import { VerificationReport, Verdict } from "./types.js";

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
      lines.push(`${finding.path}:${String(finding.line)} [${finding.sectionId}] ${finding.ruleId} ${finding.verdict} ${finding.message} (evidence: ${finding.evidenceId})`);
    }
  }
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
      lines.push(`  finding: ${finding.path}:${String(finding.line)} [${finding.sectionId}] ${finding.ruleId} ${finding.verdict} ${finding.message} (evidence: ${finding.evidenceId})`);
    }
  }
  lines.push(summary(report));
  return `${lines.join("\n")}\n`;
}

function listPaths(paths: string[]): string[] {
  return paths.length === 0 ? ["  - none"] : paths.map((file) => `  - ${file}`);
}

function summary(report: VerificationReport): string {
  return `${report.verdict}: ${String(report.artifacts.length)} artifact(s), ` +
    `${String(report.artifacts.reduce((sum, artifact) => sum + artifact.sections.length, 0))} section(s), ` +
    `${String(report.warningCount)} warning(s), ` +
    `${String(report.semanticCalls)} semantic call(s), ${String(report.cacheHits)} cache hit(s)`;
}
