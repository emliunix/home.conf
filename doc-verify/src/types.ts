import { z } from "zod";

import type { EngineReport } from "./engine/diagnostics.js";

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
  /** The binding's status for a module constraint (`violated` or `undetermined`). */
  status?: string;
  repair?: string;
  /** The section ids the finding rests on (the binding's sections and its oracles' evidence). */
  sections?: string[];
  /** What decided it: oracle answers against thresholds, or the structural fact found or missing. */
  basis?: string[];
  /** The engine's proof tree for the binding, rendered. */
  proof?: string[];
}

export interface WarningDiagnostic {
  path: RepoPath;
  line: number;
  sectionId: SectionId;
  ruleId: string;
  message: string;
}

export interface ArtifactReport {
  path: RepoPath;
  artifactKind: string;
  profile: Exclude<Profile, "auto">;
  impactPath: RepoPath[];
  selectorTrace: Array<{ pattern: string; action: "include" | "exclude" }>;
  requiredSections: string[];
  sections: Array<Omit<Section, "content">>;
  semanticCalls: number;
  cacheHits: number;
  warnings: WarningDiagnostic[];
  findings: Finding[];
  /** The engine's rendered diagnostics (populations, proofs, oracles, repairs); absent when the run stopped before the engine. */
  engine?: { modules: RepoPath[]; hash: string; requests: number; text: string; report: EngineReport };
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
