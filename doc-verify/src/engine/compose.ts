/**
 * Composes design-04 verification modules into one program (design 04 §Modules and references,
 * `extends`), resolved at load time from repository files.
 *
 * A module may name `extends: [path, ...]`, relative to its own file. Those modules are
 * composed first, depth-first, then the module itself. A document rule's `modules` list is
 * composed the same way, in order. Params, oracles, rules and constraints are unioned. A name
 * defined twice is refused, never silently overridden, because a later definition that
 * quietly replaces an earlier one is the global-namespace defect design 04 exists to remove.
 * `rounds` and `warning_threshold` take the strictest value across the chain.
 */
import path from "node:path";

import YAML from "yaml";

import { RepoPath, TextBlob, repoPath } from "../types.js";
import { ModuleError } from "./module.js";

const MERGED = ["params", "oracles", "rules", "constraints"] as const;

export interface ComposedModule {
  /** The single module text `loadModule` accepts (no `extends`). */
  yaml: string;
  /** Every module file in the order it was composed. */
  sources: RepoPath[];
}

export async function composeModules(
  files: string[],
  readBlob: (file: RepoPath) => Promise<TextBlob>,
): Promise<ComposedModule> {
  const merged: Record<string, Record<string, unknown>> = Object.fromEntries(MERGED.map((key) => [key, {}]));
  const owner: Record<string, string> = {};
  const sources: RepoPath[] = [];
  const done = new Set<string>();
  const active: string[] = [];
  let rounds = 1;
  let warningThreshold: number | undefined;
  let name = "composed";

  const visit = async (file: RepoPath): Promise<void> => {
    if (active.includes(file)) {
      throw new ModuleError([`extends cycle: ${[...active, file].join(" -> ")}`]);
    }
    if (done.has(file)) {
      return;
    }
    active.push(file);
    const blob = await readBlob(file);
    let parsed: unknown;
    try {
      parsed = YAML.parse(blob.content);
    } catch {
      throw new ModuleError([`${file}: malformed YAML`]);
    }
    if (parsed === null || typeof parsed !== "object" || (parsed as { kind?: unknown }).kind !== "verification-module") {
      throw new ModuleError([`${file}: not a verification-module`]);
    }
    const source = parsed as Record<string, unknown>;
    for (const parent of (source.extends as string[] | undefined) ?? []) {
      await visit(repoPath(path.posix.normalize(path.posix.join(path.posix.dirname(file), parent))));
    }
    for (const key of MERGED) {
      for (const [entry, value] of Object.entries((source[key] as Record<string, unknown> | undefined) ?? {})) {
        const qualified = `${key}.${entry}`;
        if (qualified in owner) {
          throw new ModuleError([`${file}: ${qualified} is already defined by ${owner[qualified]}`]);
        }
        owner[qualified] = file;
        (merged[key] as Record<string, unknown>)[entry] = value;
      }
    }
    if (typeof source.rounds === "number") {
      rounds = Math.max(rounds, source.rounds);
    }
    if (typeof source.warning_threshold === "number") {
      warningThreshold = warningThreshold === undefined ? source.warning_threshold : Math.max(warningThreshold, source.warning_threshold);
    }
    if (typeof source.module === "string") {
      name = source.module;
    }
    sources.push(file);
    done.add(file);
    active.pop();
  };

  for (const file of files) {
    await visit(repoPath(path.posix.normalize(file)));
  }

  const out: Record<string, unknown> = {
    schema_version: 2,
    kind: "verification-module",
    module: name,
    imports: { core: "doc-verify:core" },
    rounds,
    ...(warningThreshold === undefined ? {} : { warning_threshold: warningThreshold }),
  };
  for (const key of MERGED) {
    if (Object.keys(merged[key] as object).length > 0) {
      out[key] = merged[key];
    }
  }
  return { yaml: YAML.stringify(out), sources };
}
