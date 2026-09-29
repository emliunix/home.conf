/**
 * `doc-verify:core` facts and evidence for one document (design 04 §Facts and evidence).
 *
 * The section tree is a fact derived from heading depth, not a reconstruction from
 * byte spans or from slug prefixes. `own` is the heading plus the text before the first
 * child; `body` is the heading plus the whole subtree.
 */

import { segmentMarkdown } from "../segments.js";
import type { Section } from "../types.js";
import { atom, compound, number, type Term } from "./terms.js";

export interface DocumentInput {
  path: string;
  markdown: string;
  /** `meta(D, Key, Value)` facts from the companion's `document` block. */
  meta?: Record<string, string>;
  /** Section ids selected by the CLI or profile; every section when absent. */
  selected?: string[];
}

export interface DocumentFacts {
  id: string;
  sections: Section[];
  parents: Map<string, string>;
  facts: Term[];
}

export const CORE_BASE = ["section/3", "heading/3", "depth/3", "order/3", "meta/3", "selected/2"] as const;
export const CORE_DERIVED = ["child/3", "descendant/3", "nests/3"] as const;

export function documentFacts(document: DocumentInput): DocumentFacts {
  const sections = segmentMarkdown(document.markdown).filter((section) => section.depth > 0);
  const id = document.path;
  const D = atom(id);
  const parents = new Map<string, string>();
  const stack: Section[] = [];
  const facts: Term[] = [];
  const selected = new Set(document.selected ?? sections.map((section) => section.id));

  for (const [index, section] of sections.entries()) {
    while ((stack.at(-1)?.depth ?? 0) >= section.depth) {
      stack.pop();
    }
    const parent = stack.at(-1)?.id ?? "root";
    parents.set(section.id, parent);
    stack.push(section);
    const S = atom(section.id);
    facts.push(
      core("section", [D, S, atom(parent)]),
      core("heading", [D, S, atom(section.heading)]),
      core("depth", [D, S, number(section.depth)]),
      core("order", [D, S, number(index + 1)]),
    );
    if (selected.has(section.id)) {
      facts.push(core("selected", [D, S]));
    }
  }
  for (const [key, value] of Object.entries(document.meta ?? {})) {
    facts.push(core("meta", [D, atom(key), atom(value)]));
  }

  // Derived relations, computed once here: child/3, descendant/3 and nests/3.
  const ancestors = (sectionId: string): string[] => {
    const chain: string[] = [];
    let cursor = parents.get(sectionId);
    while (cursor !== undefined && cursor !== "root") {
      chain.push(cursor);
      cursor = parents.get(cursor);
    }
    return chain;
  };
  for (const section of sections) {
    const parent = parents.get(section.id);
    if (parent !== undefined && parent !== "root") {
      facts.push(core("child", [D, atom(parent), atom(section.id)]));
    }
    for (const ancestor of ancestors(section.id)) {
      facts.push(core("descendant", [D, atom(ancestor), atom(section.id)]));
      if (selected.has(ancestor) && selected.has(section.id)) {
        facts.push(core("nests", [D, atom(ancestor), atom(section.id)]));
      }
    }
  }
  return { id, sections, parents, facts };
}

function core(name: string, args: Term[]): Term {
  return compound(`core::${name}`, args);
}

export interface EvidenceText {
  sections: string[];
  text: string;
}

/** `core.body(D, S)`: the heading plus the whole subtree. */
export function bodyEvidence(document: DocumentFacts, sectionId: string): EvidenceText | undefined {
  const section = document.sections.find((candidate) => candidate.id === sectionId);
  return section === undefined ? undefined : { sections: [sectionId], text: section.content };
}

/** `core.own(D, S)`: the heading plus the text before the first child. */
export function ownEvidence(document: DocumentFacts, sectionId: string): EvidenceText | undefined {
  const index = document.sections.findIndex((candidate) => candidate.id === sectionId);
  const section = document.sections[index];
  if (section === undefined) {
    return undefined;
  }
  const firstChild = document.sections.slice(index + 1).find((candidate) => document.parents.get(candidate.id) === sectionId);
  if (firstChild === undefined) {
    return { sections: [sectionId], text: section.content };
  }
  const ownBytes = Buffer.from(section.content).subarray(0, firstChild.startByte - section.startByte);
  return { sections: [sectionId], text: ownBytes.toString() };
}

/** `core.union(D, [S1, ...])`: listed bodies in document order; a nested section adds nothing. */
export function unionEvidence(document: DocumentFacts, sectionIds: string[]): EvidenceText | undefined {
  const wanted = new Set(sectionIds);
  const chosen = document.sections.filter((section) => wanted.has(section.id));
  if (chosen.length !== wanted.size) {
    return undefined;
  }
  const ancestors = (sectionId: string): Set<string> => {
    const chain = new Set<string>();
    let cursor = document.parents.get(sectionId);
    while (cursor !== undefined && cursor !== "root") {
      chain.add(cursor);
      cursor = document.parents.get(cursor);
    }
    return chain;
  };
  const outer = chosen.filter((section) => [...ancestors(section.id)].every((ancestor) => !wanted.has(ancestor)));
  return { sections: outer.map((section) => section.id), text: outer.map((section) => section.content).join("") };
}
