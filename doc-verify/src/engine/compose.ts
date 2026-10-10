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
 *
 * A reference is a repository path or an engine library `doc-verify:NAME` (design 04 §Modules
 * and references). A library is a module file shipped with the engine in `doc-verify/lib/`,
 * versioned with it, and read from the engine's own install, never from the repository. A
 * library's `extends` may name only other libraries.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { sha256 } from "../hash.js";
import { RepoPath, TextBlob, repoPath } from "../types.js";
import { ModuleError, type RequestShape } from "./module.js";

const LIBRARY_PREFIX = "doc-verify:";
const LIBRARY_NAME = /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/;
/** `doc-verify/lib`, from both `src/engine` (tests) and `dist/engine` (the built CLI). */
const LIBRARY_DIR = fileURLToPath(new URL("../../lib/", import.meta.url));

/** The engine libraries this install ships, by `doc-verify:NAME`. */
export function engineLibraries(): string[] {
  const names: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(path.join(LIBRARY_DIR, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith(".yaml")) {
        names.push(`${LIBRARY_PREFIX}${prefix}${entry.name.slice(0, -".yaml".length)}`);
      }
    }
  };
  try {
    walk("", "");
  } catch {
    return [];
  }
  return names.sort();
}

function isLibrary(reference: string): boolean {
  return reference.startsWith(LIBRARY_PREFIX);
}

function readLibrary(reference: string): TextBlob {
  const name = reference.slice(LIBRARY_PREFIX.length);
  const known = engineLibraries();
  if (!LIBRARY_NAME.test(name) || !known.includes(reference)) {
    throw new ModuleError([`${reference}: no such engine library; this engine ships ${known.join(", ") || "none"}`]);
  }
  const content = readFileSync(path.join(LIBRARY_DIR, `${name}.yaml`), "utf8");
  return { path: repoPath(reference), content, hash: sha256(content) };
}

/** The YAML body of an engine library `doc-verify:NAME`, read from this install. */
export function readEngineLibrary(reference: string): TextBlob {
  return readLibrary(reference);
}

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
  let requestShape: RequestShape | undefined;
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
    const blob = isLibrary(file) ? readLibrary(file) : await readBlob(file);
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
      if (isLibrary(parent)) {
        await visit(repoPath(parent));
      } else if (isLibrary(file)) {
        throw new ModuleError([`${file}: an engine library may extend only doc-verify: libraries, not ${parent}`]);
      } else {
        await visit(repoPath(path.posix.normalize(path.posix.join(path.posix.dirname(file), parent))));
      }
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
    // `per-atom` is the stricter shape: once any module in the chain asks atoms alone, the
    // composed module does too, so a child cannot silently re-batch its parent's oracles.
    //
    // An unrecognised value is refused HERE, not only by `moduleSchema`, because composition
    // rebuilds the module from a known key list (`MERGED`) and would otherwise drop the key
    // before the schema could see it: `request_shape: bogus` would silently behave as the
    // `batched` default instead of failing, and the schema's `.strict()` would never run.
    if (source.request_shape !== undefined) {
      if (source.request_shape !== "batched" && source.request_shape !== "per-atom") {
        throw new ModuleError([
          `${file}: request_shape must be "batched" or "per-atom", not ${JSON.stringify(source.request_shape)}`,
        ]);
      }
      if (source.request_shape === "per-atom") {
        requestShape = "per-atom";
      }
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
    await visit(repoPath(isLibrary(file) ? file : path.posix.normalize(file)));
  }

  const out: Record<string, unknown> = {
    schema_version: 2,
    kind: "verification-module",
    module: name,
    imports: { core: "doc-verify:core" },
    rounds,
    ...(requestShape === undefined ? {} : { request_shape: requestShape }),
    ...(warningThreshold === undefined ? {} : { warning_threshold: warningThreshold }),
  };
  for (const key of MERGED) {
    if (Object.keys(merged[key] as object).length > 0) {
      out[key] = merged[key];
    }
  }
  return { yaml: YAML.stringify(out), sources };
}
