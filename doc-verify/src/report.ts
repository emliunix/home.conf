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

export function renderText(report: VerificationReport): string {
  const lines: string[] = [];
  for (const artifact of report.artifacts) {
    for (const finding of artifact.findings) {
      lines.push(`${finding.path}:${String(finding.line)} [${finding.sectionId}] ${finding.ruleId} ${finding.verdict} ${finding.message} (evidence: ${finding.evidenceId})`);
    }
  }
  lines.push(
    `${report.verdict}: ${String(report.artifacts.length)} artifact(s), ` +
    `${String(report.artifacts.reduce((sum, artifact) => sum + artifact.sections.length, 0))} section(s), ` +
    `${String(report.semanticCalls)} semantic call(s), ${String(report.cacheHits)} cache hit(s)`,
  );
  return `${lines.join("\n")}\n`;
}
