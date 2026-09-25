import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import { minimatch } from "minimatch";
import type { Link, Root, RootContent } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import YAML from "yaml";
import { z } from "zod";

import { canonicalJson, sha256 } from "./hash.js";
import { RepoPath, Snapshot, SnapshotEntry, TextBlob, UsageError, repoPath } from "./types.js";

export type SnapshotMode =
  | { kind: "paths"; paths: string[] }
  | { kind: "staged" }
  | { kind: "range"; range: string }
  | { kind: "all" };

export interface SnapshotPair {
  baseline: Snapshot;
  candidate: Snapshot;
  changedRoots: RepoPath[];
  impactPaths: ReadonlyMap<RepoPath, RepoPath[]>;
  readCandidate: (path: RepoPath) => Promise<TextBlob>;
  candidatePaths: RepoPath[];
}

export interface DocumentReferenceRule {
  pattern: string;
  verification: string;
}

export async function captureSnapshots(input: {
  root: string;
  mode: SnapshotMode;
  documentPatterns: string[];
  invalidationPatterns: string[];
  documentRules?: DocumentReferenceRule[];
}): Promise<SnapshotPair> {
  const allTracked = gitLines(input.root, ["ls-files", "--cached"]);
  const workingFiles = await fg(input.documentPatterns, {
    cwd: input.root,
    onlyFiles: true,
    followSymbolicLinks: false,
  });
  const workingYaml = await fg(["**/*.yaml", "**/*.yml"], {
    cwd: input.root,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ["node_modules/**", ".git/**"],
  });

  if (input.mode.kind === "range") {
    const [baseArg, headArg] = splitRange(input.mode.range);
    const base = gitText(input.root, ["merge-base", baseArg, headArg]).trim();
    const head = gitText(input.root, ["rev-parse", headArg]).trim();
    const baselineInventory = gitLines(input.root, ["ls-tree", "-r", "--name-only", base]);
    const candidateInventory = gitLines(input.root, ["ls-tree", "-r", "--name-only", head]);
    const baselinePaths = filterDocuments(baselineInventory, input.documentPatterns);
    const candidatePaths = filterDocuments(candidateInventory, input.documentPatterns);
    const changed = gitLines(input.root, ["diff", "--name-only", "--diff-filter=ACDMRT", base, head]);
    return buildPair({
      root: input.root,
      baselineLabel: base,
      candidateLabel: head,
      baselinePaths,
      candidatePaths,
      baselineInputPaths: inputPaths(baselineInventory, baselinePaths),
      candidateInputPaths: inputPaths(candidateInventory, candidatePaths),
      changed,
      invalidationPatterns: input.invalidationPatterns,
      documentRules: input.documentRules ?? [],
      readBaseline: (file) => readGitBlob(input.root, base, file),
      readCandidate: (file) => readGitBlob(input.root, head, file),
    });
  }

  const headExists = hasHead(input.root);
  const baselinePaths = headExists ? filterDocuments(allTracked, input.documentPatterns) : [];
  const readBaseline = (file: RepoPath): Promise<TextBlob> => {
    if (!headExists) {
      throw new UsageError(`no baseline blob for ${file}`);
    }
    return readGitBlob(input.root, "HEAD", file);
  };

  if (input.mode.kind === "staged") {
    const candidatePaths = filterDocuments(allTracked, input.documentPatterns);
    const changed = gitLines(input.root, ["diff", "--cached", "--name-only", "--diff-filter=ACDMRT"]);
    return buildPair({
      root: input.root,
      baselineLabel: headExists ? "HEAD" : "empty",
      candidateLabel: "index",
      baselinePaths,
      candidatePaths,
      baselineInputPaths: inputPaths(allTracked, baselinePaths),
      candidateInputPaths: inputPaths(allTracked, candidatePaths),
      changed,
      invalidationPatterns: input.invalidationPatterns,
      documentRules: input.documentRules ?? [],
      readBaseline,
      readCandidate: (file) => readGitBlob(input.root, ":", file),
    });
  }

  const candidatePaths = [...new Set([...filterDocuments(allTracked, input.documentPatterns), ...workingFiles.map(repoPath)])].sort();
  const workingInventory = [...new Set([...allTracked, ...workingFiles, ...workingYaml])];
  const changed = input.mode.kind === "all" ? candidatePaths : input.mode.paths.map((file) => normalizeRepoPath(input.root, file));
  return buildPair({
    root: input.root,
    baselineLabel: input.mode.kind === "all" ? "empty" : headExists ? "HEAD" : "empty",
    candidateLabel: "working-tree",
    baselinePaths: input.mode.kind === "all" ? [] : baselinePaths,
    candidatePaths,
    baselineInputPaths: input.mode.kind === "all" ? [] : inputPaths(allTracked, baselinePaths),
    candidateInputPaths: inputPaths(workingInventory, candidatePaths),
    changed,
    invalidationPatterns: input.invalidationPatterns,
    documentRules: input.documentRules ?? [],
    readBaseline,
    readCandidate: (file) => readWorkingBlob(input.root, file),
  });
}

export function affectedClosure(input: {
  changed: RepoPath[];
  baselineLinks: ReadonlyMap<RepoPath, RepoPath[]>;
  candidateLinks: ReadonlyMap<RepoPath, RepoPath[]>;
  allDocuments: RepoPath[];
  invalidatesAll: boolean;
}): RepoPath[] {
  return affectedSelection(input).artifacts;
}

function affectedSelection(input: {
  changed: RepoPath[];
  baselineLinks: ReadonlyMap<RepoPath, RepoPath[]>;
  candidateLinks: ReadonlyMap<RepoPath, RepoPath[]>;
  allDocuments: RepoPath[];
  invalidatesAll: boolean;
}): { artifacts: RepoPath[]; impactPaths: Map<RepoPath, RepoPath[]> } {
  const roots = [...new Set(input.changed)].sort();
  if (input.invalidatesAll) {
    const artifacts = [...input.allDocuments].sort();
    const invalidator = roots[0];
    return {
      artifacts,
      impactPaths: new Map(artifacts.map((artifact) => [
        artifact,
        invalidator === undefined || invalidator === artifact ? [artifact] : [invalidator, artifact],
      ])),
    };
  }
  const documents = new Set(input.allDocuments);
  const reverse = new Map<RepoPath, Set<RepoPath>>();
  for (const links of [input.baselineLinks, input.candidateLinks]) {
    for (const [source, targets] of links) {
      for (const target of targets) {
        const dependents = reverse.get(target) ?? new Set<RepoPath>();
        dependents.add(source);
        reverse.set(target, dependents);
      }
    }
  }
  const queue = [...roots];
  const visited = new Set(queue);
  const paths = new Map<RepoPath, RepoPath[]>(roots.map((root) => [root, [root]]));
  const affected = new Set(queue.filter((file) => documents.has(file)));
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    const currentPath = paths.get(current) ?? [current];
    for (const dependent of [...(reverse.get(current) ?? [])].sort()) {
      if (!visited.has(dependent)) {
        visited.add(dependent);
        paths.set(dependent, [...currentPath, dependent]);
        queue.push(dependent);
        if (documents.has(dependent)) {
          affected.add(dependent);
        }
      }
    }
  }
  const artifacts = [...affected].sort();
  return {
    artifacts,
    impactPaths: new Map(artifacts.map((artifact) => [artifact, paths.get(artifact) ?? [artifact]])),
  };
}

export function extractMarkdownLinks(sourcePath: RepoPath, markdown: string): RepoPath[] {
  const root = unified().use(remarkParse).parse(markdown);
  const links: RepoPath[] = [];
  const visit = (node: Root | RootContent): void => {
    if (node.type === "link") {
      const target = normalizeLink(sourcePath, node);
      if (target !== undefined) {
        links.push(target);
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(root);
  return [...new Set(links)].sort();
}

async function buildPair(input: {
  root: string;
  baselineLabel: string;
  candidateLabel: string;
  baselinePaths: RepoPath[];
  candidatePaths: RepoPath[];
  baselineInputPaths: RepoPath[];
  candidateInputPaths: RepoPath[];
  changed: Array<string | RepoPath>;
  invalidationPatterns: string[];
  documentRules: DocumentReferenceRule[];
  readBaseline: (path: RepoPath) => Promise<TextBlob>;
  readCandidate: (path: RepoPath) => Promise<TextBlob>;
}): Promise<SnapshotPair> {
  const [baseline, candidate] = await Promise.all([
    capture(input.baselineLabel, input.baselineInputPaths, input.readBaseline),
    capture(input.candidateLabel, input.candidateInputPaths, input.readCandidate),
  ]);
  const baselineLinks = linkGraph(baseline, input.baselinePaths, input.documentRules);
  const candidateLinks = linkGraph(candidate, input.candidatePaths, input.documentRules);
  const changedRoots = input.changed.map((file) => normalizeRepoPath(input.root, file));
  const allDocuments = [...new Set([...input.baselinePaths, ...input.candidatePaths])].sort();
  const invalidatesAll = changedRoots.some((file) => input.invalidationPatterns.some((pattern) => minimatch(file, pattern, { dot: true })));
  const affected = affectedSelection({ changed: changedRoots, baselineLinks, candidateLinks, allDocuments, invalidatesAll });
  return {
    baseline,
    candidate,
    changedRoots,
    impactPaths: affected.impactPaths,
    readCandidate: input.readCandidate,
    candidatePaths: affected.artifacts,
  };
}

async function capture(label: string, paths: RepoPath[], reader: (path: RepoPath) => Promise<TextBlob>): Promise<Snapshot> {
  const entries = new Map<RepoPath, SnapshotEntry>();
  for (const file of paths) {
    try {
      entries.set(file, await reader(file));
    } catch (error) {
      if (error instanceof MissingBlobError) {
        entries.set(file, { path: file, deleted: true });
      } else {
        throw error;
      }
    }
  }
  const identity = [...entries.values()].map((entry) => "deleted" in entry
    ? [entry.path, "", true]
    : [entry.path, entry.hash, false]);
  return { id: sha256(canonicalJson(identity)), label, entries };
}

function linkGraph(
  snapshot: Snapshot,
  documentPaths: RepoPath[],
  documentRules: DocumentReferenceRule[],
): Map<RepoPath, RepoPath[]> {
  const graph = new Map<RepoPath, RepoPath[]>();
  for (const [file, entry] of snapshot.entries) {
    if ((file.endsWith(".yaml") || file.endsWith(".yml")) && !("deleted" in entry)) {
      graph.set(file, extractYamlLinks(file, entry.content));
    }
  }
  for (const file of documentPaths) {
    const entry = snapshot.entries.get(file);
    if (entry === undefined || "deleted" in entry) {
      graph.set(file, []);
      continue;
    }
    const companionPath = repoPath(file.replace(/\.md$/i, ".yaml"));
    const companion = snapshot.entries.get(companionPath);
    const rule = documentRules.find((candidate) => minimatch(file, candidate.pattern, { dot: true }));
    const defaultVerification = rule === undefined ? [] : referencePath(repoPath("."), rule.verification);
    graph.set(file, [...new Set([
      ...extractMarkdownLinks(file, entry.content),
      companionPath,
      ...defaultVerification,
      ...(companion === undefined || "deleted" in companion ? [] : extractCompanionDependencies(companion.content)),
    ])].sort());
  }
  return graph;
}

async function readWorkingBlob(root: string, file: RepoPath): Promise<TextBlob> {
  const absolute = path.resolve(root, file);
  ensureInside(root, absolute);
  let stat;
  try {
    stat = await lstat(absolute);
  } catch {
    throw new MissingBlobError(file);
  }
  if (stat.isSymbolicLink()) {
    const resolved = await realpath(absolute);
    ensureInside(root, resolved);
  }
  const before = await readFile(absolute);
  const after = await readFile(absolute);
  if (!before.equals(after)) {
    throw new Error(`working-tree file changed during capture: ${file}`);
  }
  return { path: file, content: before.toString("utf8"), hash: sha256(before) };
}

function readGitBlob(root: string, revision: string, file: RepoPath): Promise<TextBlob> {
  try {
    const spec = revision === ":" ? `:${file}` : `${revision}:${file}`;
    const content = execFileSync("git", ["show", spec], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return Promise.resolve({ path: file, content, hash: sha256(content) });
  } catch {
    return Promise.reject(new MissingBlobError(file));
  }
}

function normalizeRepoPath(root: string, file: string): RepoPath {
  const absolute = path.resolve(root, file);
  ensureInside(root, absolute);
  return repoPath(path.relative(root, absolute).split(path.sep).join(path.posix.sep));
}

function ensureInside(root: string, absolute: string): void {
  const relative = path.relative(root, absolute);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new UsageError(`path escapes repository: ${absolute}`);
  }
}

function filterDocuments(paths: string[], patterns: string[]): RepoPath[] {
  return paths
    .filter((file) => patterns.some((pattern) => minimatch(file, pattern, { dot: true })))
    .map(repoPath)
    .sort();
}

function inputPaths(inventory: string[], documents: RepoPath[]): RepoPath[] {
  const yaml = inventory
    .filter((file) => file === ".doc-verify.yaml" || file.endsWith(".yaml") || file.endsWith(".yml"))
    .map(repoPath);
  const companions = documents.map((file) => repoPath(file.replace(/\.md$/i, ".yaml")));
  return [...new Set([...documents, ...yaml, ...companions])].sort();
}

function extractCompanionDependencies(content: string): RepoPath[] {
  try {
    const parsed = z.object({
      document: z.object({ depends_on: z.array(z.string()).optional() }).loose(),
    }).loose().safeParse(YAML.parse(content));
    if (!parsed.success || parsed.data.document.depends_on === undefined) {
      return [];
    }
    return parsed.data.document.depends_on
      .filter((value) => !path.posix.isAbsolute(value) && !value.startsWith("../"))
      .map((value) => repoPath(path.posix.normalize(value)));
  } catch {
    return [];
  }
}

function extractYamlLinks(sourcePath: RepoPath, content: string): RepoPath[] {
  let value: unknown;
  try {
    value = YAML.parse(content);
  } catch {
    return [];
  }
  const parsed = z.object({
    rubrics: z.object({
      inherits: z.union([z.string(), z.array(z.string())]).optional(),
    }).loose().optional(),
    verification: z.object({
      inherits: z.string().optional(),
      rubrics: z.object({
        inherits: z.union([z.string(), z.array(z.string())]).optional(),
      }).loose().optional(),
      profiles: z.object({
        draft: z.object({ rubric: z.string().optional() }).loose().optional(),
        promotion: z.object({ rubric: z.string().optional() }).loose().optional(),
      }).loose().optional(),
    }).loose().optional(),
  }).loose().safeParse(value);
  if (!parsed.success) {
    return [];
  }
  const inherited = parsed.data.rubrics?.inherits;
  const strategyInherited = parsed.data.verification?.inherits;
  const strategyRubrics = parsed.data.verification?.rubrics?.inherits;
  const references = [
    ...(inherited === undefined ? [] : typeof inherited === "string" ? [inherited] : inherited),
    ...(strategyInherited === undefined ? [] : [strategyInherited]),
    ...(strategyRubrics === undefined ? [] : typeof strategyRubrics === "string" ? [strategyRubrics] : strategyRubrics),
  ];
  const profileReferences = [
    parsed.data.verification?.profiles?.draft?.rubric,
    parsed.data.verification?.profiles?.promotion?.rubric,
  ].filter((reference): reference is string => reference !== undefined);
  return [...new Set([
    ...references.flatMap((reference) => referencePath(sourcePath, reference)),
    ...profileReferences.flatMap((reference) => referencePath(repoPath("."), reference)),
  ])].sort();
}

function referencePath(sourcePath: RepoPath, reference: string): RepoPath[] {
  const filePart = reference.split("#", 1)[0];
  if (filePart === undefined || filePart.length === 0 || path.posix.isAbsolute(filePart)) {
    return [];
  }
  const base = sourcePath === "." ? "" : path.posix.dirname(sourcePath);
  const normalized = path.posix.normalize(path.posix.join(base, filePart));
  return normalized === ".." || normalized.startsWith("../") ? [] : [repoPath(normalized)];
}

function gitLines(root: string, args: string[]): string[] {
  return gitText(root, args).split("\n").map((line) => line.trim()).filter(Boolean);
}

function gitText(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function hasHead(root: string): boolean {
  try {
    gitText(root, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

function splitRange(value: string): [string, string] {
  const parts = value.split("...");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new UsageError("--range must be BASE...HEAD");
  }
  const base = parts[0];
  const head = parts[1];
  if (base === undefined || head === undefined) {
    throw new UsageError("--range must be BASE...HEAD");
  }
  return [base, head];
}

function normalizeLink(sourcePath: RepoPath, link: Link): RepoPath | undefined {
  const withoutFragment = link.url.split("#", 1)[0];
  if (withoutFragment === undefined || withoutFragment.length === 0 || !withoutFragment.endsWith(".md")) {
    return undefined;
  }
  if (/^[a-z]+:/i.test(withoutFragment) || withoutFragment.startsWith("/")) {
    return undefined;
  }
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), withoutFragment));
  return normalized.startsWith("../") ? undefined : repoPath(normalized);
}

export class MissingBlobError extends Error {}
