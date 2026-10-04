import { execFileSync } from "node:child_process";
import { documentSectionsNote, explainSectionMatch, sectionIdMatches } from "./normalize.js";
import path from "node:path";
import { createMockJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";

import {
  CompanionMetadata,
  DocVerifyConfig,
  DocumentIncludeRule,
  documentRuleFor,
  documentTraceFor,
  parseCompanion,
  parseConfig,
} from "./config.js";
import { loadDocVerifyEnv } from "./local-env.js";
import { productionBackend } from "./judge.js";
import { composeModules, ModuleError, renderReport, runProgram } from "./engine/index.js";
import { segmentMarkdown } from "./segments.js";
import { MissingBlobError, SnapshotMode, captureSnapshots } from "./snapshot.js";
import {
  ArtifactReport,
  BlockedError,
  ConfigNotFoundError,
  ConfigNotStagedError,
  Finding,
  Profile,
  RepoPath,
  Section,
  SectionId,
  TextBlob,
  UsageError,
  VerificationReport,
  Verdict,
  WarningDiagnostic,
  repoPath,
  sectionId,
} from "./types.js";

const bootstrapPatterns = ["design/**/*.md", "goals/**/*.md"];

export interface CheckOptions {
  root?: string;
  mode: SnapshotMode;
  profile: Profile;
  /** Section ids for the `selected(D, S)` fact; every section when absent. */
  sections?: string[];
  backend?: JudgeBackend;
}

export async function checkDocuments(options: CheckOptions): Promise<VerificationReport> {
  const started = performance.now();
  const root = options.root ?? gitRoot(process.cwd());
  loadDocVerifyEnv(root);
  const bootstrap = await captureSnapshots({
    root,
    mode: options.mode,
    documentRules: bootstrapPatterns.map((pattern) => ({ pattern })),
    invalidationPatterns: [".doc-verify.yaml"],
  });
  let configBlob: TextBlob;
  try {
    configBlob = await bootstrap.readCandidate(repoPath(".doc-verify.yaml"));
  } catch (error) {
    if (!(error instanceof MissingBlobError)) {
      throw error;
    }
    if (options.mode.kind === "staged") {
      throw new ConfigNotStagedError(
        "config .doc-verify.yaml is not in the Git index; run `git add .doc-verify.yaml` and retry",
      );
    }
    throw new ConfigNotFoundError(
      `config .doc-verify.yaml not found; expected ${path.join(root, ".doc-verify.yaml")}`,
    );
  }
  const config = parseConfig(configBlob);
  const pair = await captureSnapshots({
    root,
    mode: options.mode,
    documentRules: config.documents,
    invalidationPatterns: config.invalidation_patterns,
  });
  if (options.mode.kind === "paths") {
    const consumed = new Set<RepoPath>();
    for (const [artifact, impact] of pair.impactPaths) {
      consumed.add(artifact);
      for (const entry of impact) {
        consumed.add(entry);
      }
    }
    const unmatched = pair.changedRoots.filter((file) => !consumed.has(file));
    if (unmatched.length > 0) {
      throw new UsageError(
        `--paths selected no configured document or dependency: ${unmatched.join(", ")}`,
      );
    }
  }
  const selectedIds = options.sections?.map(sectionId);
  const artifacts: ArtifactReport[] = [];
  for (const file of pair.candidatePaths) {
    const rule = findDocumentRule(config, file);
    if (rule === undefined) {
      continue;
    }
    const entry = pair.candidate.entries.get(file);
    const impactPath = pair.impactPaths.get(file) ?? [file];
    if (entry === undefined || "deleted" in entry) {
      artifacts.push(deletedReport(file, rule, impactPath, documentTraceFor(config.documents, file)));
      continue;
    }
    artifacts.push(await checkArtifact({
      root,
      file,
      blob: entry,
      rule,
      config,
      impactPath,
      selectorTrace: documentTraceFor(config.documents, file),
      readCandidate: pair.readCandidate,
      requestedProfile: options.profile,
      ...(selectedIds === undefined ? {} : { selectedIds }),
      ...(options.backend === undefined ? {} : { backend: options.backend }),
    }));
  }
  const verdict = combineVerdicts(artifacts.map((artifact) => artifact.verdict));
  return {
    schemaVersion: 1,
    invocation: modeLabel(options.mode),
    requestedProfile: options.profile,
    baselineId: pair.baseline.id,
    candidateId: pair.candidate.id,
    policyVersion: config.policy.version,
    changedRoots: pair.changedRoots,
    affectedArtifacts: pair.candidatePaths,
    artifacts,
    warningCount: artifacts.reduce((sum, artifact) => sum + artifact.warnings.length, 0),
    semanticCalls: artifacts.reduce((sum, artifact) => sum + artifact.semanticCalls, 0),
    cacheHits: artifacts.reduce((sum, artifact) => sum + artifact.cacheHits, 0),
    verdict,
    timingMs: Math.round(performance.now() - started),
  };
}

async function checkArtifact(input: {
  root: string;
  file: RepoPath;
  blob: TextBlob;
  rule: DocumentIncludeRule;
  config: DocVerifyConfig;
  impactPath: RepoPath[];
  selectorTrace: ArtifactReport["selectorTrace"];
  readCandidate: (path: RepoPath) => Promise<TextBlob>;
  requestedProfile: Profile;
  selectedIds?: SectionId[];
  backend?: JudgeBackend;
}): Promise<ArtifactReport> {
  const sections = segmentMarkdown(input.blob.content);
  const findings: Finding[] = [];
  const warnings: WarningDiagnostic[] = [];
  for (const required of input.rule.required_sections) {
    if (!sections.some((section) => sectionIdMatches(sectionId(required), section.id))) {
      findings.push(finding(input.file, sections[0], "structure.required-section", "NO-GO",
        `missing required section -- ${explainSectionMatch(required, sections.map((s) => s.id))} [${documentSectionsNote(sections.map((s) => s.id))}]`));
    }
  }
  const companionPath = repoPath(input.file.replace(/\.md$/i, ".yaml"));
  const companion = await optionalCompanion(input.readCandidate, companionPath);
  if (companion === undefined) {
    warnings.push(warning(input.file, "metadata.missing-companion", "no adjacent companion; using repository defaults"));
  } else if (companion.document.kind !== input.rule.artifact_kind) {
    throw new UsageError(`invalid ${companionPath}: document.kind must be ${input.rule.artifact_kind}`);
  }
  if (companion?.legacyVerification === true) {
    warnings.push(warning(input.file, "metadata.legacy-verification",
      `${companionPath} carries a v1 verification: block, which is ignored; the rule's modules verify this document`));
  }
  return checkWithModules({ ...input, modules: input.rule.modules, sections, findings, warnings,
    ...(companion?.document.status === undefined ? {} : { companionStatus: companion.document.status }) });
}

/**
 * The design-04 path: compose the rule's modules, derive the document's facts, and run the
 * engine. A draft runs only the constraints without `profiles` (the structural ones);
 * every other status runs the `promotion` profile. The verdict and findings are the engine's.
 */
async function checkWithModules(input: {
  root: string;
  file: RepoPath;
  blob: TextBlob;
  rule: DocumentIncludeRule;
  config: DocVerifyConfig;
  impactPath: RepoPath[];
  selectorTrace: ArtifactReport["selectorTrace"];
  readCandidate: (path: RepoPath) => Promise<TextBlob>;
  requestedProfile: Profile;
  selectedIds?: SectionId[];
  backend?: JudgeBackend;
  modules: string[];
  sections: Section[];
  findings: Finding[];
  warnings: WarningDiagnostic[];
  companionStatus?: string;
}): Promise<ArtifactReport> {
  const statusSection = input.sections.find((section) => section.id === "status");
  const status = input.rule.status_from === "title"
    ? titleStatus(input.blob.content)
    : (sectionBody(statusSection) ?? input.companionStatus)?.toLowerCase().replace(/[^a-z-]/g, "");
  const profile: Exclude<Profile, "auto"> = input.requestedProfile !== "auto"
    ? input.requestedProfile
    : status === "draft" ? "draft" : "promotion";
  const base: Omit<ArtifactReport, "findings" | "verdict" | "semanticCalls"> = {
    path: input.file,
    artifactKind: input.rule.artifact_kind,
    profile,
    impactPath: input.impactPath,
    selectorTrace: input.selectorTrace,
    requiredSections: input.rule.required_sections,
    sections: input.sections.map(({ content: _content, ...section }) => section),
    cacheHits: 0,
    warnings: input.warnings,
  };
  const findings = [...input.findings];
  if (findings.length > 0) {
    return { ...base, findings, semanticCalls: 0, verdict: combineVerdicts(findings.map((item) => item.verdict)) };
  }
  let composed;
  try {
    composed = await composeModules(input.modules, input.readCandidate);
  } catch (error) {
    if (error instanceof ModuleError) {
      throw new UsageError(`invalid modules for ${input.file}: ${error.message}`);
    }
    throw error;
  }
  // No key is not a reason to skip the structural constraints: the engine runs without a judge,
  // decides every constraint whose goal reads no oracle, and fails BLOCKED only at the round
  // that must ask one.
  let backend = input.backend;
  let unavailable: string | undefined;
  if (backend === undefined) {
    try {
      backend = productionBackend(input.config.judge.model);
    } catch (error) {
      if (!(error instanceof BlockedError)) {
        throw error;
      }
      unavailable = error.message;
    }
  }
  const meta: Record<string, string> = { kind: input.rule.artifact_kind };
  if (status !== undefined && status.length > 0) {
    meta.status = status;
  }
  // The status word is the line's first token, so `status` alone cannot tell "reviewed" from
  // "Reviewed — nearly done". `status_words` counts the line's tokens for a module to constrain.
  const line = input.rule.status_from === "title" ? undefined : statusLine(statusSection);
  if (line !== undefined) {
    meta.status_words = String(line.split(/\s+/).length);
  }
  const report = await runProgram({
    moduleYaml: composed.yaml,
    documents: [{ path: input.file, markdown: input.blob.content, meta,
      ...(input.selectedIds === undefined ? {} : { selected: input.selectedIds }) }],
    backend,
    ...(unavailable === undefined ? {} : { unavailable }),
    model: input.config.judge.model,
    policy: {
      maxEvidenceBytes: input.config.policy.max_evidence_bytes,
      forbiddenLiterals: input.config.policy.forbidden_literals,
      version: input.config.policy.version,
    },
    profile,
  });
  // One finding per binding that did not hold: a violated error is NO-GO, a violated warning or
  // an undetermined binding NEEDS-REVIEW. Engine-level notes (unasked atoms, empty populations)
  // follow as NEEDS-REVIEW. The artifact verdict stays the engine's own.
  for (const constraint of report.constraints) {
    for (const binding of constraint.bindings) {
      if (binding.status === "satisfied") {
        continue;
      }
      const verdict = binding.status === "violated" && constraint.severity === "error" ? "NO-GO" : "NEEDS-REVIEW";
      findings.push(finding(input.file, input.sections[0], `module.${constraint.id}`, verdict,
        `${binding.status}: ${binding.message}${binding.repair === undefined ? "" : ` -- repair: ${binding.repair}`}`));
    }
  }
  // An engine failure that decided nothing (every constraint was decided without the judge)
  // does not turn a PASS into a finding.
  if (report.failure !== undefined && report.verdict !== "PASS") {
    findings.push(finding(input.file, input.sections[0], unavailable !== undefined && report.failure.message === unavailable
      ? "semantic.prerequisite" : "module.engine", report.failure.verdict, report.failure.message));
  }
  for (const note of report.findings) {
    findings.push(finding(input.file, input.sections[0], "module.engine", "NEEDS-REVIEW", note));
  }
  return {
    ...base,
    findings,
    semanticCalls: report.requests.length,
    engine: { modules: composed.sources, hash: report.hash, requests: report.requests.length, text: renderReport(report) },
    verdict: report.verdict,
  };
}

/** A goal keeps its status as the title suffix: `# <goal> — OPEN|BLOCKED|CLOSED-GREEN (<date>)`. */
export function titleStatus(markdown: string): string | undefined {
  const match = /^# .*?\s[—–-]\s+([A-Z][A-Z-]*[A-Z])\b/m.exec(markdown);
  return match?.[1]?.toLowerCase();
}

function deletedReport(
  file: RepoPath,
  rule: DocumentIncludeRule,
  impactPath: RepoPath[],
  selectorTrace: ArtifactReport["selectorTrace"],
): ArtifactReport {
  const item = finding(file, undefined, "structure.deleted", "NO-GO", "configured document was deleted");
  return {
    path: file,
    artifactKind: rule.artifact_kind,
    profile: "draft",
    impactPath,
    selectorTrace,
    requiredSections: rule.required_sections,
    sections: [],
    semanticCalls: 0,
    cacheHits: 0,
    warnings: [],
    findings: [item],
    verdict: "NO-GO",
  };
}

function finding(pathValue: RepoPath, section: Section | undefined, ruleId: string, verdict: Exclude<Verdict, "PASS">, message: string): Finding {
  return {
    path: pathValue,
    line: section?.startLine ?? 1,
    sectionId: section?.id ?? sectionId("@document"),
    ruleId,
    verdict,
    message,
    evidenceId: section?.contentHash ?? "tombstone",
  };
}

function warning(pathValue: RepoPath, ruleId: string, message: string): WarningDiagnostic {
  return {
    path: pathValue,
    line: 1,
    sectionId: sectionId("@document"),
    ruleId,
    message,
  };
}

async function optionalCompanion(reader: (path: RepoPath) => Promise<TextBlob>, file: RepoPath): Promise<CompanionMetadata | undefined> {
  try {
    return parseCompanion(await reader(file));
  } catch (error) {
    if (error instanceof UsageError) {
      throw error;
    }
    return undefined;
  }
}

function findDocumentRule(config: DocVerifyConfig, file: RepoPath): DocumentIncludeRule | undefined {
  return documentRuleFor(config.documents, file);
}

/** The first non-empty line under a section's heading. */
function statusLine(section: Section | undefined): string | undefined {
  return section?.content.split("\n").slice(1).map((line) => line.trim()).find((line) => line.length > 0);
}

function sectionBody(section: Section | undefined): string | undefined {
  if (section === undefined) {
    return undefined;
  }
  return section.content.split("\n").slice(1).join("\n").trim().split(/\s+/, 1)[0];
}

export function combineVerdicts(verdicts: Verdict[]): Verdict {
  const precedence: Verdict[] = ["NO-GO", "BLOCKED", "NEEDS-REVIEW", "PASS"];
  return precedence.find((verdict) => verdicts.includes(verdict)) ?? "PASS";
}

function gitRoot(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  } catch {
    throw new UsageError("doc-verify must run inside a Git repository");
  }
}

function modeLabel(mode: SnapshotMode): string {
  switch (mode.kind) {
    case "paths": return `paths:${mode.paths.join(",")}`;
    case "staged": return "staged";
    case "range": return `range:${mode.range}`;
    case "all": return "all";
  }
}

export function mockSupportedBackend(): JudgeBackend {
  return createMockJevJudgeBackend({ choice: "first" });
}
