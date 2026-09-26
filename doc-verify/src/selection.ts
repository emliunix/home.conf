import { minimatch } from "minimatch";

import { RepoPath } from "./types.js";

export interface DocumentSelector {
  pattern: string;
  exclude?: boolean | undefined;
}

export interface SelectorTraceEntry {
  pattern: string;
  action: "include" | "exclude";
}

/**
 * Resolve ordered document selectors with last-match-wins semantics.
 *
 * Includes are the default for existing configurations. An exclusion removes
 * paths selected by an earlier include, and a later include can add one back.
 */
export function resolveDocumentSelector<T extends DocumentSelector>(
  selectors: readonly T[],
  file: RepoPath,
): T | undefined {
  let selected: T | undefined;
  for (const selector of selectors) {
    if (!minimatch(file, selector.pattern, { dot: true })) {
      continue;
    }
    selected = selector.exclude === true ? undefined : selector;
  }
  return selected;
}

export function documentSelectorTrace(
  selectors: readonly DocumentSelector[],
  file: RepoPath,
): SelectorTraceEntry[] {
  return selectors
    .filter((selector) => minimatch(file, selector.pattern, { dot: true }))
    .map((selector) => ({
      pattern: selector.pattern,
      action: selector.exclude === true ? "exclude" : "include",
    }));
}
