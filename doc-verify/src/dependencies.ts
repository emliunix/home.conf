import { existsSync } from "node:fs";
import path from "node:path";

import { documentFacts, type InventoryQuery } from "./engine/facts.js";

/**
 * What a document's check read of the repository, recorded while the check's own fact extraction
 * runs (`observeDocument`). A `path` is a file or directory asked about by name (whether it exists,
 * its text); an `InventoryQuery` is a question asked of the file list.
 */
export type Dependency = { kind: "path"; path: string } | InventoryQuery;

/**
 * Whether a repository path is a file or directory of a snapshot: in its tree (a directory when
 * some file lies under it) or, when the working tree is part of the snapshot, on disk. The check
 * and its closure observation answer `exists` with this one function, so they read the same paths.
 */
export function inventoryExists(root: string, inventory: readonly string[], workingTree: boolean): (repoPath: string) => boolean {
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

/**
 * Run a document's fact extraction against a snapshot and record every repository question it
 * asks. Nothing is read: a cited document's text is the empty string (its headings decide only
 * the cited section's resolution, never what else is asked), and a revision-qualified reference
 * resolves without Git, its path component recorded. Since the check is a function of the document
 * and these answers, a document none of whose dependencies changed reaches the same verdict.
 */
export function observeDocument(input: {
  path: string;
  markdown: string;
  exists: (repoPath: string) => boolean;
  files: readonly string[];
  gitRefs: readonly string[];
}): Dependency[] {
  const seen = new Map<string, Dependency>();
  const record = (dependency: Dependency): void => {
    seen.set(JSON.stringify(dependency), dependency);
  };
  const exists = (repoPath: string): boolean => {
    record({ kind: "path", path: repoPath });
    return input.exists(repoPath);
  };
  documentFacts({
    path: input.path,
    markdown: input.markdown,
    exists,
    files: input.files,
    gitRefs: input.gitRefs,
    resolveSpec: (spec) => {
      const file = spec.slice(spec.indexOf(":") + 1);
      if (file.length > 0) {
        record({ kind: "path", path: file });
      }
      return "ok";
    },
    readTarget: (repoPath) => exists(repoPath) ? "" : undefined,
    onInventoryQuery: record,
  });
  return [...seen.values()];
}

/** A snapshot's tree as the check sees it: its file list and its `exists`. */
export interface Tree {
  files: readonly string[];
  exists: (repoPath: string) => boolean;
}

/**
 * Which documents a changed file can affect through what their checks read. A `path` the check
 * named hears its own path on any change; a directory it asked about hears a file under it only
 * when the directory's existence differs between the two trees, and an inventory question hears a
 * file it matches only when its answer differs (a count read as none, one or several; the one
 * match itself). A change that leaves every answer a check read unchanged cannot change its verdict.
 */
export class DependencyIndex {
  private readonly byPath = new Map<string, Set<string>>();
  private readonly byBasename = new Map<string, Set<string>>();
  private readonly byDirectory = new Map<string, Map<string, Set<string>>>();
  private readonly sides: readonly [TreeAnswers, TreeAnswers];

  constructor(baseline: Tree, candidate: Tree) {
    this.sides = [new TreeAnswers(baseline), new TreeAnswers(candidate)];
  }

  add(document: string, dependencies: readonly Dependency[]): void {
    for (const dependency of dependencies) {
      switch (dependency.kind) {
        case "path":
          addTo(this.byPath, dependency.path, document);
          break;
        case "basename":
          addTo(this.byBasename, dependency.name, document);
          break;
        case "prefix": {
          const prefixes = this.byDirectory.get(dependency.directory) ?? new Map<string, Set<string>>();
          addTo(prefixes, dependency.prefix, document);
          this.byDirectory.set(dependency.directory, prefixes);
          break;
        }
      }
    }
  }

  /** The documents whose recorded reads `file`'s change can answer differently, sorted. */
  hearers(file: string): string[] {
    const [baseline, candidate] = this.sides;
    const found = new Set(this.byPath.get(file) ?? []);
    const hear = (documents: Iterable<string> | undefined): void => {
      for (const document of documents ?? []) {
        found.add(document);
      }
    };
    for (let index = file.lastIndexOf("/"); index > 0; index = file.lastIndexOf("/", index - 1)) {
      const directory = file.slice(0, index);
      if (this.byPath.has(directory) && baseline.exists(directory) !== candidate.exists(directory)) {
        hear(this.byPath.get(directory));
      }
    }
    const directory = path.posix.dirname(file);
    const base = path.posix.basename(file);
    if (this.byBasename.has(base) && baseline.basename(base) !== candidate.basename(base)) {
      hear(this.byBasename.get(base));
    }
    for (const [prefix, documents] of this.byDirectory.get(directory) ?? []) {
      if (base.startsWith(prefix) && baseline.prefix(directory, prefix) !== candidate.prefix(directory, prefix)) {
        hear(documents);
      }
    }
    return [...found].sort();
  }
}

/** One tree's answers to the inventory questions, as the check distinguishes them. */
class TreeAnswers {
  private basenames: Map<string, string[]> | undefined;

  constructor(private readonly tree: Tree) {}

  exists(repoPath: string): boolean {
    return this.tree.exists(repoPath);
  }

  /** How many files have this name, as the check reads it: none, one, or several. */
  basename(name: string): string {
    return bucket(this.byBasename().get(name) ?? []);
  }

  /** The files directly in `directory` whose names begin `prefix`: none, the one, or several. */
  prefix(directory: string, prefix: string): string {
    return bucket(this.tree.files.filter((file) => path.posix.dirname(file) === directory && path.posix.basename(file).startsWith(prefix)));
  }

  private byBasename(): Map<string, string[]> {
    if (this.basenames === undefined) {
      this.basenames = new Map();
      for (const file of this.tree.files) {
        const base = path.posix.basename(file);
        this.basenames.set(base, [...(this.basenames.get(base) ?? []), file]);
      }
    }
    return this.basenames;
  }
}

function bucket(files: readonly string[]): string {
  return files.length === 0 ? "none" : files.length === 1 ? `one:${files[0] ?? ""}` : "several";
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}
