import { execFileSync } from "node:child_process";
import path from "node:path";
import { createMockJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";
import { minimatch } from "minimatch";

import { CompanionMetadata, DocVerifyConfig, DocumentRule, parseCompanion, parseConfig, resolveProfile } from "./config.js";
import { evaluateSemantic, PolicyViolationError } from "./semantic.js";
import { EvidenceBudgetError, MissingCriticalSectionError, expandRubric, resolveRubrics } from "./rubric.js";
import { segmentMarkdown } from "./segments.js";
import { MissingBlobError, SnapshotMode, captureSnapshots } from "./snapshot.js";
import { resolveVerificationStrategy } from "./strategy.js";
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
  sections?: string[];
  rubric?: string;
  backend?: JudgeBackend;
  useCache?: boolean;
}

export async function checkDocuments(options: CheckOptions): Promise<VerificationReport> {
  const started = performance.now();
  const root = options.root ?? gitRoot(process.cwd());
  const bootstrap = await captureSnapshots({
    root,
    mode: options.mode,
    documentPatterns: bootstrapPatterns,
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
    documentPatterns: config.documents.map((document) => document.pattern),
    invalidationPatterns: config.invalidation_patterns,
    documentRules: config.documents.map(({ pattern, verification }) => ({ pattern, verification })),
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
      artifacts.push(deletedReport(file, rule, impactPath));
      continue;
    }
    artifacts.push(await checkArtifact({
      root,
      file,
      blob: entry,
      rule,
      config,
      impactPath,
      readCandidate: pair.readCandidate,
      requestedProfile: options.profile,
      ...(selectedIds === undefined ? {} : { selectedIds }),
      ...(options.rubric === undefined ? {} : { rubricOverride: options.rubric }),
      ...(options.backend === undefined ? {} : { backend: options.backend }),
      ...(options.useCache === undefined ? {} : { useCache: options.useCache }),
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
  rule: DocumentRule;
  config: DocVerifyConfig;
  impactPath: RepoPath[];
  readCandidate: (path: RepoPath) => Promise<TextBlob>;
  requestedProfile: Profile;
  selectedIds?: SectionId[];
  rubricOverride?: string;
  backend?: JudgeBackend;
  useCache?: boolean;
}): Promise<ArtifactReport> {
  const sections = segmentMarkdown(input.blob.content);
  const findings: Finding[] = [];
  const warnings: WarningDiagnostic[] = [];
  for (const required of input.rule.required_sections) {
    if (!sections.some((section) => section.id === required)) {
      findings.push(finding(input.file, sections[0], "structure.required-section", "NO-GO", `missing required section ${required}`));
    }
  }
  const companionPath = repoPath(input.file.replace(/\.md$/i, ".yaml"));
  const companion = await optionalCompanion(input.readCandidate, companionPath);
  if (companion === undefined) {
    warnings.push(warning(input.file, "metadata.missing-companion", "no adjacent companion; using repository defaults"));
  } else if (companion.document.kind !== input.rule.artifact_kind) {
    throw new UsageError(`invalid ${companionPath}: document.kind must be ${input.rule.artifact_kind}`);
  }
  const strategy = await resolveVerificationStrategy({
    root: input.root,
    readBlob: input.readCandidate,
    source: companion === undefined
      ? { kind: "reference", reference: input.rule.verification }
      : { kind: "inline", strategy: companion.verification, declaringPath: companionPath },
  });
  const status = sectionBody(sections.find((section) => section.id === "status")) ?? companion?.document.status;
  const profile = resolveProfile({ requested: input.requestedProfile, configured: strategy.defaultProfile, ...(status === undefined ? {} : { status }) });
  const companionProfile = strategy.profiles[profile];
  const selectedIds = input.selectedIds ?? companionProfile.sections?.map(sectionId);
  const roots = input.rubricOverride !== undefined
    ? [{ reference: input.rubricOverride }]
    : companionProfile.rubric !== undefined
      ? [{ reference: companionProfile.rubric }]
      : strategy.rubricRoots;
  const rubric = await resolveRubrics({
    root: input.root,
    roots,
    readBlob: input.readCandidate,
  });
  let semanticRequestId: string | undefined;
  let semanticCalls = 0;
  let cacheHits = 0;
  let evaluations: ArtifactReport["evaluations"] = [];
  const trace = [];

  if (findings.length === 0 && (profile === "promotion" || selectedIds !== undefined)) {
    try {
      const questions = expandRubric({
        rubric,
        artifactKind: input.rule.artifact_kind,
        sections,
        ...(selectedIds === undefined ? {} : { selectedIds }),
      });
      evaluations = questions.map((question) => ({ questionId: question.id, sectionIds: question.sectionIds }));
      if (profile === "promotion") {
        const semantic = await evaluateSemantic({
          root: input.root,
          artifactKind: input.rule.artifact_kind,
          questions,
          rubric,
          model: input.config.judge.model,
          policyVersion: input.config.policy.version,
          maxEvidenceBytes: input.config.policy.max_evidence_bytes,
          forbiddenLiterals: input.config.policy.forbidden_literals,
          maxAgeSeconds: input.config.judge.attestation_max_age_seconds,
          ...(input.backend === undefined ? {} : { backend: input.backend }),
          ...(input.useCache !== undefined
            ? { useCache: input.useCache }
            : companionProfile.cache === "refresh"
              ? { useCache: false }
              : {}),
        });
        semanticRequestId = semantic.requestId;
        semanticCalls = semantic.calls;
        cacheHits = semantic.cacheHits;
        evaluations = questions.map((question, index) => ({
          questionId: question.id,
          sectionIds: question.sectionIds,
          ...(semantic.outcome.answers[index] === undefined ? {} : { answer: semantic.outcome.answers[index] }),
        }));
        trace.push({ ruleId: semantic.outcome.ruleId, verdict: semantic.outcome.verdict, facts: semantic.outcome.answers });
        if (semantic.outcome.verdict !== "PASS") {
          const first = questions[0];
          findings.push(finding(
            input.file,
            sections.find((section) => section.id === first?.sectionIds[0]),
            semantic.outcome.ruleId,
            semantic.outcome.verdict,
            "semantic rubric did not pass",
          ));
        }
      }
    } catch (error) {
      if (error instanceof MissingCriticalSectionError) {
        findings.push(finding(input.file, sections[0], error.itemId, "NO-GO", error.message));
      } else if (error instanceof PolicyViolationError) {
        findings.push(finding(input.file, sections[0], "policy.outbound", "NO-GO", error.message));
      } else if (error instanceof EvidenceBudgetError || error instanceof BlockedError) {
        findings.push(finding(input.file, sections[0], "semantic.prerequisite", "BLOCKED", error.message));
      } else {
        throw error;
      }
    }
  }

  const verdict = combineVerdicts(findings.map((item) => item.verdict));
  return {
    path: input.file,
    artifactKind: input.rule.artifact_kind,
    profile,
    impactPath: input.impactPath,
    requiredSections: input.rule.required_sections,
    sections: sections.map(({ content: _content, ...section }) => section),
    strategyChain: strategy.chain,
    rubricChain: rubric.chain,
    evaluations,
    ...(semanticRequestId === undefined ? {} : { semanticRequestId }),
    semanticCalls,
    cacheHits,
    warnings,
    findings,
    trace,
    verdict,
  };
}

function deletedReport(file: RepoPath, rule: DocumentRule, impactPath: RepoPath[]): ArtifactReport {
  const item = finding(file, undefined, "structure.deleted", "NO-GO", "configured document was deleted");
  return {
    path: file,
    artifactKind: rule.artifact_kind,
    profile: "draft",
    impactPath,
    requiredSections: rule.required_sections,
    sections: [],
    strategyChain: [],
    rubricChain: [],
    evaluations: [],
    semanticCalls: 0,
    cacheHits: 0,
    warnings: [],
    findings: [item],
    trace: [],
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

function findDocumentRule(config: DocVerifyConfig, file: RepoPath): DocumentRule | undefined {
  return config.documents.find((rule) => minimatch(file, rule.pattern, { dot: true }));
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
