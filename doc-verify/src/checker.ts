import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
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
import { fileOracleCache } from "./cache.js";
import { loadDocVerifyEnv } from "./local-env.js";
import { productionBackend } from "./judge.js";
import {
  bindingBasis,
  bindingReason,
  bindingSections,
  bindingSpan,
  composeModules,
  ModuleError,
  renderProof,
  renderReport,
  runProgram,
  type BindingReport,
} from "./engine/index.js";
import { segmentMarkdown } from "./segments.js";
import { MissingBlobError, SnapshotMode, captureSnapshots } from "./snapshot.js";
import {
  ArtifactReport,
  BlockedError,
  ConfigNotFoundError,
  ConfigNotStagedError,
  Finding,
  FindingVerdict,
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
  /**
   * The persistent oracle cache: `use` (default) unless the profile says `cache: refresh`;
   * `off` (`--no-cache`) neither reads nor writes it.
   */
  cache?: "use" | "off";
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
  const exists = candidateExists(root, pair.candidateInventory, pair.workingTree);
  const repository = { exists, files: pair.candidateInventory, gitRefs: pair.gitRefs };
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
      repository,
      requestedProfile: options.profile,
      cacheEnabled: options.cache !== "off",
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
  repository: RepositoryView;
  requestedProfile: Profile;
  cacheEnabled: boolean;
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
  repository: RepositoryView;
  requestedProfile: Profile;
  cacheEnabled: boolean;
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
  const cacheSetting = input.config.profiles?.[profile]?.cache;
  const cache = input.cacheEnabled ? fileOracleCache(input.root, cacheSetting === "refresh" ? "refresh" : "use") : undefined;
  const report = await runProgram({
    moduleYaml: composed.yaml,
    documents: [{ path: input.file, markdown: input.blob.content, meta, ...input.repository,
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
    ...(cache === undefined ? {} : { cache }),
  });
  // One finding per binding that did not hold: a violated error is NO-GO, a violated warning
  // WARN, an undetermined binding NEEDS-REVIEW (BLOCKED when its oracle could not be asked). Engine-level notes (unasked atoms, a judge answer
  // that disagrees with its distribution) follow as NEEDS-REVIEW. An empty population is
  // vacuously satisfied and adds nothing. The artifact verdict stays the engine's own.
  for (const constraint of report.constraints) {
    for (const binding of constraint.bindings) {
      if (binding.status === "satisfied") {
        continue;
      }
      // An undetermined binding whose oracle was never asked because the engine failed (no
      // judge, an over-budget round) is BLOCKED, not a judgment to review.
      const unasked = report.failure !== undefined && bindingBasis(binding).some((line) => line.startsWith("unasked "));
      const verdict: FindingVerdict = binding.status === "violated"
        ? constraint.severity === "error" ? "NO-GO" : "WARN"
        : unasked ? "BLOCKED" : "NEEDS-REVIEW";
      const item = bindingFinding(input.file, input.sections, `module.${constraint.id}`, verdict, binding);
      const reason = unasked ? report.failure?.message ?? "evidence not resolved" : bindingReason(binding);
      findings.push(reason === undefined ? item : { ...item, reason });
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
    cacheHits: report.oracles.filter((leaf) => leaf.cacheHit).length,
    engine: { modules: composed.sources, hash: report.hash, requests: report.requests.length, text: renderReport(report), report },
    verdict: report.verdict,
  };
}

/** What reference facts may consult about the candidate (`core.ref`, `core.resolves`). */
interface RepositoryView {
  exists: (repoPath: string) => boolean;
  files: readonly string[];
  gitRefs: readonly string[];
}

/**
 * Whether a repository path is a file or directory of the candidate: in its tree (a directory
 * when some file lies under it) or, when the working tree is part of the candidate, on disk.
 */
function candidateExists(root: string, inventory: readonly string[], workingTree: boolean): (repoPath: string) => boolean {
  const files = new Set(inventory);
  const directories = new Set<string>();
  for (const file of inventory) {
    for (let index = file.indexOf("/"); index > 0; index = file.indexOf("/", index + 1)) {
      directories.add(file.slice(0, index));
    }
  }
  return (repoPath) => files.has(repoPath) || directories.has(repoPath)
    || (workingTree && existsSync(path.join(root, repoPath)));
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

/**
 * A finding for one binding that did not hold. It sits at the binding's section (`S`, else `C`,
 * else the first section an oracle read), or at the document's first section when it names none.
 */
function bindingFinding(file: RepoPath, sections: Section[], ruleId: string, verdict: FindingVerdict, binding: BindingReport): Finding {
  const read = bindingSections(binding);
  const named = [binding.values.S, binding.values.C].filter((value): value is string =>
    value !== undefined && sections.some((section) => section.id === value));
  const ids = [...new Set([...named, ...read])];
  const anchor = sections.find((section) => section.id === ids[0]) ?? sections[0];
  return {
    ...finding(file, anchor, ruleId, verdict, binding.message),
    status: binding.status,
    ...(binding.repair === undefined ? {} : { repair: binding.repair }),
    sections: ids,
    ...(() => { const span = bindingSpan(binding); return span === undefined ? {} : { span }; })(),
    basis: bindingBasis(binding),
    proof: renderProof(binding.proof, ""),
  };
}

function finding(pathValue: RepoPath, section: Section | undefined, ruleId: string, verdict: FindingVerdict, message: string): Finding {
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

/** The worst verdict; a `WARN` finding does not move it. */
export function combineVerdicts(verdicts: Array<Verdict | FindingVerdict>): Verdict {
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
