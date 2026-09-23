import { execFileSync } from "node:child_process";
import { createMockJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";
import { minimatch } from "minimatch";

import { CompanionMetadata, DocVerifyConfig, DocumentRule, parseCompanion, parseConfig, resolveProfile } from "./config.js";
import { evaluateSemantic, PolicyViolationError } from "./semantic.js";
import { EvidenceBudgetError, MissingCriticalSectionError, expandRubric, resolveRubric } from "./rubric.js";
import { segmentMarkdown } from "./segments.js";
import { SnapshotMode, captureSnapshots } from "./snapshot.js";
import {
  ArtifactReport,
  BlockedError,
  Finding,
  Profile,
  RepoPath,
  Section,
  SectionId,
  TextBlob,
  UsageError,
  VerificationReport,
  Verdict,
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
  const config = parseConfig(await bootstrap.readCandidate(repoPath(".doc-verify.yaml")));
  const pair = await captureSnapshots({
    root,
    mode: options.mode,
    documentPatterns: config.documents.map((document) => document.pattern),
    invalidationPatterns: config.invalidation_patterns,
  });
  const selectedIds = options.sections?.map(sectionId);
  const artifacts: ArtifactReport[] = [];
  for (const file of pair.candidatePaths) {
    const rule = findDocumentRule(config, file);
    if (rule === undefined) {
      continue;
    }
    const entry = pair.candidate.entries.get(file);
    if (entry === undefined || "deleted" in entry) {
      artifacts.push(deletedReport(file, rule));
      continue;
    }
    artifacts.push(await checkArtifact({
      root,
      file,
      blob: entry,
      rule,
      config,
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
  readCandidate: (path: RepoPath) => Promise<TextBlob>;
  requestedProfile: Profile;
  selectedIds?: SectionId[];
  rubricOverride?: string;
  backend?: JudgeBackend;
  useCache?: boolean;
}): Promise<ArtifactReport> {
  const sections = segmentMarkdown(input.blob.content);
  const findings: Finding[] = [];
  for (const required of input.rule.required_sections) {
    if (!sections.some((section) => section.id === required)) {
      findings.push(finding(input.file, sections[0], "structure.required-section", "NO-GO", `missing required section ${required}`));
    }
  }
  const status = sectionBody(sections.find((section) => section.id === "status"));
  const profile = resolveProfile({ requested: input.requestedProfile, configured: input.rule.semantic_profile, ...(status === undefined ? {} : { status }) });
  const companionPath = repoPath(input.file.replace(/\.md$/i, ".yaml"));
  const companion = await optionalCompanion(input.readCandidate, companionPath);
  const reference = input.rubricOverride ?? companion?.rubrics?.inherits ?? input.rule.rubric;
  const rubric = await resolveRubric({
    root: input.root,
    reference,
    readBlob: input.readCandidate,
    ...(input.rubricOverride === undefined && companion?.rubrics !== undefined ? { declaringPath: companionPath } : {}),
  });
  let semanticRequestId: string | undefined;
  let semanticCalls = 0;
  let cacheHits = 0;
  const trace = [];

  if (findings.length === 0 && (profile === "promotion" || input.selectedIds !== undefined)) {
    try {
      const questions = expandRubric({
        rubric,
        artifactKind: input.rule.artifact_kind,
        sections,
        ...(input.selectedIds === undefined ? {} : { selectedIds: input.selectedIds }),
      });
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
          ...(input.useCache === undefined ? {} : { useCache: input.useCache }),
        });
        semanticRequestId = semantic.requestId;
        semanticCalls = semantic.calls;
        cacheHits = semantic.cacheHits;
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
    sections: sections.map(({ content: _content, ...section }) => section),
    rubricChain: rubric.chain,
    ...(semanticRequestId === undefined ? {} : { semanticRequestId }),
    semanticCalls,
    cacheHits,
    findings,
    trace,
    verdict,
  };
}

function deletedReport(file: RepoPath, rule: DocumentRule): ArtifactReport {
  const item = finding(file, undefined, "structure.deleted", "NO-GO", "configured document was deleted");
  return {
    path: file,
    artifactKind: rule.artifact_kind,
    profile: "draft",
    sections: [],
    rubricChain: [],
    semanticCalls: 0,
    cacheHits: 0,
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
