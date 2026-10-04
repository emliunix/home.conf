/**
 * `doc-verify:core` facts and evidence for one document (design 04 §Facts and evidence).
 *
 * The section tree is a fact derived from heading depth, not a reconstruction from
 * byte spans or from slug prefixes. `own` is the heading plus the text before the first
 * child; `body` is the heading plus the whole subtree.
 */

import path from "node:path";

import type { Root, RootContent } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";

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
  /**
   * Whether a repository-relative path names a file or directory in the candidate. It decides
   * `resolves(D, Target)`; when absent every reference resolves.
   */
  exists?: (repoPath: string) => boolean;
}

export interface DocumentFacts {
  id: string;
  sections: Section[];
  parents: Map<string, string>;
  facts: Term[];
}

export const CORE_BASE = ["section/3", "heading/3", "depth/3", "order/3", "meta/3", "selected/2", "ref/4", "resolves/2"] as const;
export const CORE_DERIVED = ["child/3", "descendant/3", "nests/3", "dangling/4"] as const;

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
  // References (added 2026-10-05): what the document names, and whether it exists.
  const seen = new Set<string>();
  for (const reference of documentReferences(document.markdown, sections)) {
    const key = `${reference.section}\u0000${reference.target}\u0000${reference.kind}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const args = [D, atom(reference.section), atom(reference.target), atom(reference.kind)];
    facts.push(core("ref", args));
    if (resolvesTarget(id, reference.target, document.exists)) {
      facts.push(core("resolves", [D, atom(reference.target)]));
    } else {
      facts.push(core("dangling", args));
    }
  }
  return { id, sections, parents, facts };
}

export interface DocumentReference {
  /** The innermost section the reference sits in; `@preamble` before the first heading. */
  section: string;
  /** The target as written. */
  target: string;
  kind: "link" | "path";
}

/** A scheme (`https:`, `mailto:`) or a protocol-relative `//host` makes a link a URL. */
const URL_TARGET = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;
const PATH_SPAN = /^[A-Za-z0-9_./-]+$/;
/**
 * A file extension, from a fixed list: `core.body` or `document.path` is a dotted name, not a
 * file, so "ends with an extension" cannot mean any `.word` suffix.
 */
const FILE_EXTENSION = new RegExp(`\\.(?:${[
  "md", "markdown", "txt", "rst", "adoc", "yaml", "yml", "json", "jsonl", "toml", "ini", "cfg", "conf", "env", "lock",
  "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "py", "pyi", "rs", "go", "java", "kt", "c", "h", "cc", "cpp", "hpp",
  "rb", "lua", "sh", "bash", "zsh", "fish", "ps1", "sql", "html", "htm", "css", "scss", "svg", "png", "jpg", "jpeg", "gif",
  "pdf", "csv", "tsv", "xml", "proto", "graphql", "tldr", "tldraw", "ipynb", "pl", "pro",
].join("|")})$`, "i");
/** `name/3` is a predicate indicator (and `design/02` a shorthand), not a path. */
const PREDICATE_INDICATOR = /^[A-Za-z_][A-Za-z0-9_-]*\/[0-9]+$/;
/** `X.md`, `path/X.yaml`, `task/N`: a segment whose stem is one or two capitals is a placeholder. */
const PLACEHOLDER_SEGMENT = /(?:^|\/)[A-Z]{1,2}(?:\.[A-Za-z0-9]+)?(?:\/|$)/;

/**
 * `core.ref` facts: every Markdown link, image or definition target that is not a URL
 * (`link`), and every inline code span that looks like a repository path (`path`): only
 * `[A-Za-z0-9_./-]`, either a `/` or a known file extension, and not a predicate indicator
 * such as `child/3` or a placeholder such as `path/X.md`. Code blocks (fenced or indented) are not read.
 */
export function documentReferences(markdown: string, sections: Section[]): DocumentReference[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const found: DocumentReference[] = [];
  const sectionAt = (line: number | undefined): string => {
    let current = "@preamble";
    for (const section of sections) {
      if (section.depth > 0 && line !== undefined && section.startLine <= line) {
        current = section.id;
      }
    }
    return current;
  };
  const visit = (node: Root | RootContent): void => {
    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      const target = node.url.trim();
      if (target.length > 0 && !URL_TARGET.test(target)) {
        found.push({ section: sectionAt(node.position?.start.line), target, kind: "link" });
      }
    } else if (node.type === "inlineCode") {
      const value = node.value.trim();
      if (PATH_SPAN.test(value) && /[A-Za-z0-9]/.test(value) && !PREDICATE_INDICATOR.test(value)
        && !PLACEHOLDER_SEGMENT.test(value) && (value.includes("/") || FILE_EXTENSION.test(value))) {
        found.push({ section: sectionAt(node.position?.start.line), target: value, kind: "path" });
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(tree);
  return found;
}

/**
 * A target, stripped of any `#fragment` (and percent-decoded), resolves when it names a file
 * or directory relative to the document's directory or to the repository root. A bare
 * fragment names the document itself.
 */
export function resolvesTarget(documentPath: string, target: string, exists: ((repoPath: string) => boolean) | undefined): boolean {
  if (exists === undefined) {
    return true;
  }
  const raw = target.split("#")[0]?.split("?")[0] ?? "";
  if (raw.length === 0) {
    return true;
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep the target as written
  }
  const candidates = new Set<string>();
  for (const value of new Set([raw, decoded])) {
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(documentPath), value));
    const fromRoot = path.posix.normalize(value.replace(/^\/+/, ""));
    for (const candidate of value.startsWith("/") ? [fromRoot] : [relative, fromRoot]) {
      const clean = candidate.replace(/\/+$/, "");
      if (clean.length > 0 && clean !== "." && !clean.startsWith("../") && clean !== "..") {
        candidates.add(clean);
      }
    }
  }
  return [...candidates].some(exists);
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
