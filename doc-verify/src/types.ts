import { z } from "zod";

export const verdictSchema = z.enum(["PASS", "NO-GO", "NEEDS-REVIEW", "BLOCKED"]);
export type Verdict = z.infer<typeof verdictSchema>;

export const profileSchema = z.enum(["draft", "promotion", "auto"]);
export type Profile = z.infer<typeof profileSchema>;

export type RepoPath = string & { readonly __brand: "RepoPath" };
export type SectionId = string & { readonly __brand: "SectionId" };

export interface Section {
  id: SectionId;
  heading: string;
  depth: number;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
  content: string;
  contentHash: string;
}

export interface TextBlob {
  path: RepoPath;
  content: string;
  hash: string;
}

export interface Tombstone {
  path: RepoPath;
  deleted: true;
}

export type SnapshotEntry = TextBlob | Tombstone;

export interface Snapshot {
  id: string;
  label: string;
  entries: ReadonlyMap<RepoPath, SnapshotEntry>;
}

export interface Finding {
  path: RepoPath;
  line: number;
  sectionId: SectionId;
  ruleId: string;
  verdict: Exclude<Verdict, "PASS">;
  message: string;
  evidenceId: string;
}

export interface WarningDiagnostic {
  path: RepoPath;
  line: number;
  sectionId: SectionId;
  ruleId: string;
  message: string;
}

export interface RuleTrace {
  ruleId: string;
  verdict: Verdict;
  facts: string[];
}

export interface EvaluationDetail {
  questionId: string;
  sectionIds: SectionId[];
  answer?: "supported" | "refuted" | "unknown";
}

export interface ArtifactReport {
  path: RepoPath;
  artifactKind: string;
  profile: Exclude<Profile, "auto">;
  impactPath: RepoPath[];
  requiredSections: string[];
  sections: Array<Omit<Section, "content">>;
  strategyChain: Array<{ path: RepoPath; fragment: string }>;
  rubricChain: Array<{ path: RepoPath; fragment: string; hash: string }>;
  evaluations: EvaluationDetail[];
  semanticRequestId?: string;
  semanticCalls: number;
  cacheHits: number;
  warnings: WarningDiagnostic[];
  findings: Finding[];
  trace: RuleTrace[];
  verdict: Verdict;
}

export interface VerificationReport {
  schemaVersion: 1;
  invocation: string;
  requestedProfile: Profile;
  baselineId: string;
  candidateId: string;
  policyVersion: number;
  changedRoots: RepoPath[];
  affectedArtifacts: RepoPath[];
  artifacts: ArtifactReport[];
  warningCount: number;
  semanticCalls: number;
  cacheHits: number;
  verdict: Verdict;
  timingMs: number;
}

export class UsageError extends Error {
  readonly exitCode = 64;
}

export class BlockedError extends Error {
  readonly verdict = "BLOCKED" as const;
}

/** The repository-level verifier configuration is absent. */
export class ConfigNotFoundError extends Error {
  readonly exitCode = 66;
}

/** A staged run cannot read the config because it is not in the Git index. */
export class ConfigNotStagedError extends Error {
  readonly exitCode = 65;
}

export function repoPath(value: string): RepoPath {
  return value as RepoPath;
}

export function sectionId(value: string): SectionId {
  return value as SectionId;
}
