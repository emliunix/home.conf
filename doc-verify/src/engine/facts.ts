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

import { frontMatterEnd, segmentMarkdown } from "../segments.js";
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
  /** Every file of the candidate's tree: where a bare file name such as `ir.py` may live. */
  files?: readonly string[];
  /** Branch and tag names (`git for-each-ref`): a span naming one is not a path. */
  gitRefs?: readonly string[];
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
  const context: ReferenceContext = {
    path: id,
    ...(document.exists === undefined ? {} : { exists: document.exists }),
    ...(document.files === undefined ? {} : { files: document.files }),
    ...(document.gitRefs === undefined ? {} : { gitRefs: document.gitRefs }),
  };
  for (const reference of documentReferences(document.markdown, sections, context)) {
    const key = `${reference.section}\u0000${reference.target}\u0000${reference.kind}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const args = [D, atom(reference.section), atom(reference.target), atom(reference.kind)];
    facts.push(core("ref", args));
    if (referenceResolves(reference, context)) {
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
  /**
   * `link`: a Markdown link target; `path`: a code span naming a repository path; `name`: a bare
   * file name (no `/`) that names no one tracked file, so it is a name, not a path.
   */
  kind: "link" | "path" | "name";
}

/** What reference extraction may consult about the repository; each part is optional. */
export interface ReferenceContext {
  /** The document's repository path (links and spans resolve relative to its directory). */
  path: string;
  exists?: (repoPath: string) => boolean;
  files?: readonly string[];
  gitRefs?: readonly string[];
}

/** A scheme (`https:`, `mailto:`) or a protocol-relative `//host` makes a link a URL. */
const URL_TARGET = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;
const PATH_SPAN = /^[A-Za-z0-9_./-]+$/;
/**
 * File extensions, from a fixed list: `core.body` or `document.path` is a dotted name, not a
 * file, so "ends with an extension" cannot mean any `.word` suffix.
 */
const EXTENSIONS = [
  "md", "markdown", "txt", "rst", "adoc", "yaml", "yml", "json", "jsonl", "toml", "ini", "cfg", "conf", "env", "lock",
  "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "py", "pyi", "rs", "go", "java", "kt", "c", "h", "cc", "cpp", "hpp",
  "rb", "lua", "sh", "bash", "zsh", "fish", "ps1", "sql", "html", "htm", "css", "scss", "svg", "png", "jpg", "jpeg", "gif",
  "pdf", "csv", "tsv", "xml", "proto", "graphql", "tldr", "tldraw", "ipynb", "pl", "pro",
].join("|");
const FILE_EXTENSION = new RegExp(`\\.(?:${EXTENSIONS})$`, "i");
/** Rule 2: `.md`, or `.md/.yaml`: only extensions, no file. */
const ONLY_EXTENSIONS = new RegExp(`^\\.(?:${EXTENSIONS})(?:/\\.(?:${EXTENSIONS}))*$`, "i");
/** `name/3` is a predicate indicator (and `design/02` a shorthand), not a path. */
const PREDICATE_INDICATOR = /^[A-Za-z_][A-Za-z0-9_-]*\/[0-9]+$/;
/** `X.md`, `path/X.yaml`, `task/N`: a segment whose stem is one or two capitals is a placeholder. */
const PLACEHOLDER_SEGMENT = /(?:^|\/)[A-Z]{1,2}(?:\.[A-Za-z0-9]+)?(?:\/|$)/;
/** Rule 5: the namespaces of Git refs as people write them. */
const GIT_REF_PREFIX = /^(?:origin|archive|exp|refs)\//;

/**
 * `core.ref` facts: every Markdown link, image or definition target that is not a URL
 * (`link`), and every inline code span that names a repository path (`path`) or a bare file
 * name that is not one (`name`). Code blocks (fenced or indented) and YAML front matter are not
 * read. The rules for a code span, in order (README "Reference facts"):
 *
 * 0. only `[A-Za-z0-9_./-]`, not a predicate indicator (`child/3`), not a placeholder (`path/X.md`);
 * 1. inside the text of a link that resolves, it is the link's label, not a reference;
 * 2. only extensions (`.md`, `.md/.yaml`) is not a path;
 * 3. a leading `/` is a URL route (`/api/build`), not a repository path;
 * 4. a span with a `/` is a Git ref when it is a branch or tag name, or starts `origin/`,
 *    `archive/`, `exp/` or `refs/` (and that first segment is not a directory);
 * 5. a span with a `/` is a path when it has a known extension, starts `./` or `../`, or its
 *    first segment is an existing directory (at the root or beside the document);
 * 6. a span with no `/` and a known extension is a path when it resolves beside the document or
 *    at the root, or exactly one tracked file has that name; otherwise it is a `name`.
 *
 * Without a context (no `exists`) every span that passes 0, 2 and 3 is a path, as before.
 */
export function documentReferences(markdown: string, sections: Section[], context?: ReferenceContext): DocumentReference[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const metadataEnd = frontMatterEnd(markdown);
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
  const visit = (node: Root | RootContent, inResolvingLink: boolean): void => {
    if ((node.position?.end.offset ?? metadataEnd) <= metadataEnd && metadataEnd > 0) {
      return; // inside the front matter
    }
    let labelOnly = inResolvingLink;
    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      const target = node.url.trim();
      if (target.length > 0 && !URL_TARGET.test(target)) {
        found.push({ section: sectionAt(node.position?.start.line), target, kind: "link" });
        labelOnly ||= context === undefined || resolvesTarget(context.path, target, context.exists);
      } else if (target.length > 0) {
        labelOnly = true; // a URL's label names the URL, not a repository file
      }
    } else if (node.type === "inlineCode" && !inResolvingLink) {
      const kind = spanKind(node.value.trim(), context);
      if (kind !== undefined) {
        found.push({ section: sectionAt(node.position?.start.line), target: node.value.trim(), kind });
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child, labelOnly);
      }
    }
  };
  visit(tree, false);
  return found;
}

function spanKind(value: string, context: ReferenceContext | undefined): DocumentReference["kind"] | undefined {
  if (!PATH_SPAN.test(value) || !/[A-Za-z0-9]/.test(value) || PREDICATE_INDICATOR.test(value) || PLACEHOLDER_SEGMENT.test(value)) {
    return undefined;
  }
  if (ONLY_EXTENSIONS.test(value) || value.startsWith("/")) {
    return undefined;
  }
  const exists = context?.exists;
  if (value.includes("/")) {
    const first = value.split("/")[0] ?? "";
    const firstIsDirectory = exists !== undefined && first.length > 0 && first !== "." && first !== ".."
      && (exists(first) || exists(path.posix.join(path.posix.dirname(context?.path ?? ""), first)));
    if ((context?.gitRefs?.includes(value) ?? false) || (!firstIsDirectory && GIT_REF_PREFIX.test(value))) {
      return undefined;
    }
    if (exists === undefined || FILE_EXTENSION.test(value) || value.startsWith("./") || value.startsWith("../") || firstIsDirectory) {
      return "path";
    }
    return undefined;
  }
  if (!FILE_EXTENSION.test(value)) {
    return undefined;
  }
  if (exists === undefined || context === undefined) {
    return "path";
  }
  return resolvesTarget(context.path, value, exists) || basenameCount(context.files, value) === 1 ? "path" : "name";
}

const basenameIndexes = new WeakMap<readonly string[], Map<string, number>>();

/** How many tracked files have this file name. */
function basenameCount(files: readonly string[] | undefined, name: string): number {
  if (files === undefined) {
    return 0;
  }
  let index = basenameIndexes.get(files);
  if (index === undefined) {
    index = new Map();
    for (const file of files) {
      const base = path.posix.basename(file);
      index.set(base, (index.get(base) ?? 0) + 1);
    }
    basenameIndexes.set(files, index);
  }
  return index.get(name) ?? 0;
}

/**
 * Whether a reference resolves: a link or path by `resolvesTarget`; a bare file name also when
 * some tracked file has that name (exactly one for a `path`, any number for a `name`).
 */
export function referenceResolves(reference: DocumentReference, context: ReferenceContext): boolean {
  if (resolvesTarget(context.path, reference.target, context.exists)) {
    return true;
  }
  return reference.kind !== "link" && !reference.target.includes("/") && basenameCount(context.files, reference.target) > 0;
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

/**
 * One contiguous slice of the document an evidence expression read. Its `startLine` is the
 * first line of `text` in the document and `offset` is where it begins in the concatenated
 * evidence text, so a sentence inside the evidence maps back to a real line range.
 */
export interface EvidencePiece {
  id: string;
  startLine: number;
  offset: number;
  text: string;
}

export interface EvidenceText {
  sections: string[];
  text: string;
  pieces: EvidencePiece[];
}

/** `core.body(D, S)`: the heading plus the whole subtree. */
export function bodyEvidence(document: DocumentFacts, sectionId: string): EvidenceText | undefined {
  const section = document.sections.find((candidate) => candidate.id === sectionId);
  return section === undefined
    ? undefined
    : { sections: [sectionId], text: section.content,
        pieces: [{ id: sectionId, startLine: section.startLine, offset: 0, text: section.content }] };
}

/** `core.own(D, S)`: the heading plus the text before the first child. */
export function ownEvidence(document: DocumentFacts, sectionId: string): EvidenceText | undefined {
  const index = document.sections.findIndex((candidate) => candidate.id === sectionId);
  const section = document.sections[index];
  if (section === undefined) {
    return undefined;
  }
  const firstChild = document.sections.slice(index + 1).find((candidate) => document.parents.get(candidate.id) === sectionId);
  const text = firstChild === undefined
    ? section.content
    : Buffer.from(section.content).subarray(0, firstChild.startByte - section.startByte).toString();
  return { sections: [sectionId], text, pieces: [{ id: sectionId, startLine: section.startLine, offset: 0, text }] };
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
  const pieces: EvidencePiece[] = [];
  let offset = 0;
  for (const section of outer) {
    pieces.push({ id: section.id, startLine: section.startLine, offset, text: section.content });
    offset += section.content.length;
  }
  return { sections: outer.map((section) => section.id), text: pieces.map((piece) => piece.text).join(""), pieces };
}
