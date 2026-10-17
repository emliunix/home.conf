/**
 * `doc-verify:core` facts and evidence for one document (design 04 §Facts and evidence).
 *
 * The section tree is a fact derived from heading depth, not a reconstruction from
 * byte spans or from slug prefixes. `own` is the heading plus the text before the first
 * child; `body` is the heading plus the whole subtree.
 */

import path from "node:path";

import GithubSlugger from "github-slugger";
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
  /**
   * Resolve a revision-qualified reference (`<rev>:<path>`): `ok` when both components
   * resolve, otherwise which component did not. Absent means the classifier decides the
   * shape but every such span resolves, matching `exists`.
   */
  resolveSpec?: SpecResolver;
  /**
   * A repository file's text, for the headings a section reference names (round 11). Absent,
   * fragments and `§` references are not checked, and nothing is claimed about them.
   */
  readTarget?: (repoPath: string) => string | undefined;
}

/** Why a `<rev>:<path>` reference did not resolve. */
export type SpecResolution = "ok" | "revision" | "path";
export type SpecResolver = (spec: string) => SpecResolution;

export interface DocumentFacts {
  id: string;
  sections: Section[];
  parents: Map<string, string>;
  facts: Term[];
}

export const CORE_BASE = ["section/3", "heading/3", "depth/3", "order/3", "meta/3", "selected/2", "ref/4", "resolves/2", "section_ref/5"] as const;
export const CORE_DERIVED = ["child/3", "descendant/3", "nests/3", "dangling/4", "spec_unresolved/4"] as const;

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
    ...(document.resolveSpec === undefined ? {} : { resolveSpec: document.resolveSpec }),
    ...(document.readTarget === undefined ? {} : { readTarget: document.readTarget }),
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
    // ⚠ A `<rev>:<path>` NAMES ITS OWN FAILURE, WHICH `dangling` CANNOT. "the path is wrong" and
    // "the revision is wrong" are different repairs, and a reader who is told only "does not
    // exist" cannot choose between them. A parse failure is never reported as a resolution: when
    // no resolver is supplied the span is classified `spec` but is not claimed to resolve, which
    // is why `spec_unresolved(_, _, _, unresolved)` is emitted rather than nothing.
    if (reference.kind === "spec") {
      const parts = specParts(reference.target, context);
      if (parts !== undefined) {
        if (context.resolveSpec !== undefined) {
          const verdict = context.resolveSpec(reference.target);
          if (verdict !== "ok") {
            facts.push(core("spec_unresolved", [D, atom(reference.section), atom(reference.target), atom(verdict)]));
          }
        }
      }
    }
  }
  // Section references (kernel-trials round 11, design/07 phase 0): `core.ref(D, S, T, fragment)`
  // once per reference, `core.section_ref(D, S, T, Line, Closest)` per occurrence (its line, and the
  // target's nearest headings for a repair), `core.dangling(D, S, T, fragment)` on a miss.
  const sectionRefs = new Set<string>();
  for (const reference of sectionReferences(document.markdown, sections, context)) {
    const key = `${reference.section}\u0000${reference.target}`;
    const args = [D, atom(reference.section), atom(reference.target), atom("fragment")];
    if (!sectionRefs.has(key)) {
      sectionRefs.add(key);
      facts.push(core("ref", args));
      if (!reference.resolves) {
        facts.push(core("dangling", args));
      }
    }
    facts.push(core("section_ref", [D, atom(reference.section), atom(reference.target), number(reference.line),
      atom(reference.closest.length === 0 ? "none" : reference.closest.join(", "))]));
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
   * file name (no `/`) that names no one tracked file, so it is a name, not a path; `line`: a code
   * span naming a position by line number, such as `path.ts:123`.
   */
  kind: "link" | "path" | "name" | "line" | "spec";
}

/** What reference extraction may consult about the repository; each part is optional. */
export interface ReferenceContext {
  /** The document's repository path (links and spans resolve relative to its directory). */
  path: string;
  exists?: (repoPath: string) => boolean;
  files?: readonly string[];
  gitRefs?: readonly string[];
  /** Resolves a revision-qualified reference; decides `spec` resolution and its reason. */
  resolveSpec?: SpecResolver;
  /** A repository file's text (memoised by the host); decides `fragment` references. */
  readTarget?: (repoPath: string) => string | undefined;
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
/**
 * `design/103`, `design/21-25`: a numbered document named by its short form, which is how this
 * repository writes a reference to a design. Whether it names a real file is a question only the
 * reference context can answer, so `shorthandStem` below asks it.
 */
const SHORTHAND_STEM = /^[A-Za-z_][A-Za-z0-9_-]*\/[0-9]+(?:-[0-9]+)?$/;
/**
 * A line locator: a stem, then `:` and one or more line numbers or ranges. The tail may list
 * several, separated by `,` or `/` -- `:123`, `:123-456`, `:11,16`, `:280-289,393-400`,
 * `:797/826`, `:119/154` -- because they are one citation of one file.
 */
const LOCATOR_TAIL = "[0-9]+(?:-[0-9]+)?(?:(?:,|/)[0-9]+(?:-[0-9]+)?)*";
/**
 * A line locator whose stem carries a separator: `impl/x/queue.ts:312`,
 * `impl/environment/Dockerfile:38,56-66`. The last segment need not have an extension, because a
 * path already says it is a file.
 */
const LINE_PATH = new RegExp(`^(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+:${LOCATOR_TAIL}$`);
/**
 * A line locator with no separator, so the stem must END IN A KNOWN EXTENSION to be a file:
 * `schema.sql:11,16`, `types.d.ts:286`, `migrations-v2.test.ts:49-62`. This is what keeps
 * `localhost:8080`, `127.0.0.1:5432`, `node:18`, `12:30` and `utf-8:3` out -- they are a port, a
 * version or a time, not a position.
 */
const LINE_BARE = new RegExp(`^[A-Za-z0-9_.-]+\\.(?:${EXTENSIONS}):${LOCATOR_TAIL}$`, "i");
/** A line locator naming a dotfile, which has no separate extension: `.gitignore:3`, `.env:12`. */
const LINE_DOTFILE = new RegExp(`^\\.[A-Za-z0-9_.-]+:${LOCATOR_TAIL}$`);
/**
 * A line locator's stem: everything before the `:` that opens the line tail. `-1` when the span
 * has no such colon.
 */
function locatorStem(value: string): string | undefined {
  const colon = value.indexOf(":");
  return colon <= 0 ? undefined : value.slice(0, colon);
}

/**
 * Whether the span is exactly its stem, a colon, and a line tail. The stem alone is not enough:
 * a resolved file name would otherwise make `Dockerfile:`, `Dockerfile:foo` and `Dockerfile:16abc`
 * locators, which is the port mistake in another costume.
 */
function hasLocatorTail(value: string, stem: string): boolean {
  return new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:${LOCATOR_TAIL}$`).test(value);
}

/**
 * Whether a short-form stem names a repository file: `design/103` is `design/103-*.md`. Only the
 * reference context knows, so without one a shorthand is not a locator -- a guess would make
 * `child/3:1` a citation the moment a `child/3-*.md` happened to exist.
 */
function shorthandResolves(stem: string, context: ReferenceContext | undefined): boolean {
  const exists = context?.exists;
  if (context === undefined || exists === undefined) {
    return false;
  }
  const directory = path.posix.dirname(stem);
  const prefix = `${path.posix.basename(stem)}-`;
  if (directory === "." || !exists(directory)) {
    return false;
  }
  return (context.files ?? []).some(
    (file) => path.posix.dirname(file) === directory && path.posix.basename(file).startsWith(prefix),
  );
}

/**
 * Whether a stem with no `/` and no recognized extension names a repository file (`Dockerfile:16`,
 * `Makefile:12`). A fixed extension list cannot cover every real filename, so the inventory answers
 * it instead: the file resolves beside the document, at the root, or uniquely in the inventory.
 * Without a context nothing resolves here, so a bare stem is never a locator on its own -- which is
 * what keeps `node:18`, `localhost:8080`, `12:30` and `utf-8:3` out.
 */
function bareStemResolves(stem: string, context: ReferenceContext | undefined): boolean {
  if (context === undefined || context.exists === undefined) {
    return false;
  }
  return resolvesTarget(context.path, stem, context.exists) || basenameCount(context.files, stem) === 1;
}

/** Whether a code span is a line locator on any of the stems above. */
function isLineLocator(value: string, context: ReferenceContext | undefined): boolean {
  const stem = locatorStem(value);
  if (stem === undefined) {
    return false;
  }
  // `design/103:55` names a real design document by its short form, so the stem is a file and the
  // span is a locator -- but only when the context says that document exists. `child/3:1` and
  // `design/02:12` name nothing, so they stay out.
  if (SHORTHAND_STEM.test(stem) && shorthandResolves(stem, context)) {
    return hasLocatorTail(value, stem);
  }
  if (!(LINE_PATH.test(value) || LINE_BARE.test(value) || LINE_DOTFILE.test(value))) {
    // No separator and no extension: the stem is a file only if the inventory says so -- and the
    // rest of the span must still be a line tail, or a resolved file name would make every
    // `Dockerfile:foo` and `Dockerfile:` a locator.
    return !stem.includes("/") && bareStemResolves(stem, context) && hasLocatorTail(value, stem);
  }
  // A placeholder stem (`path/X.md:123`, `task/N:5`) is documentation, and a predicate indicator
  // (`child/3:1`) is a signature: neither names a real file, so neither is a locator. The stem is
  // what those two guards describe, so they are tested against it.
  return !PREDICATE_INDICATOR.test(stem) && !PLACEHOLDER_SEGMENT.test(stem);
}
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
 * (`link`), every inline code span that names a repository path (`path`) or a bare file
 * name that is not one (`name`), and every code span that is a line locator (`line`).
 * Code blocks (fenced or indented) and YAML front matter are not read. The rules for a code
 * span, in order (README "Reference facts"):
 *
 * 0. a line locator is a `line`: a position that rots on the next edit above it, never a
 *    reference. The tail is one or more line numbers or ranges separated by `,` or `/`, so
 *    `path.ts:123`, `schema.sql:11,16`, `claim-loop.ts:280-289,393-400` and `facade.ts:119/154`
 *    all qualify. The stem must look like a file: a path with a `/` (`impl/x/queue.ts:312`), a
 *    bare name ending in a known extension (`types.d.ts:286`), a dotfile (`.gitignore:3`), a bare
 *    name the repository holds (`Dockerfile:16`), or a short form naming a real document
 *    (`design/103:55`) -- the last two resolved from the reference context, so neither counts
 *    without one, and resolving the stem never excuses the value: the span must still be exactly
 *    the stem, a colon and a line tail (`Dockerfile:foo` and `Dockerfile:` are not locators);
 *    A colon that is not one of those is no reference at all, so `localhost:8080`,
 *    `127.0.0.1:5432`, `node:18`, `12:30` and `utf-8:3` stay out; nor is a stem the rules below
 *    refuse (`path/X.md:123`, `child/3:1`). A tail with no stem (`:178,184`) is out of scope: it
 *    cannot be told from a port or a ratio list;
 * 1. only `[A-Za-z0-9_./-]`, not a predicate indicator (`child/3`), not a placeholder (`path/X.md`);
 * 2. inside the text of a link that resolves, it is the link's label, not a reference (a line
 *    locator is exempt: rule 0 already claimed it);
 * 3. only extensions (`.md`, `.md/.yaml`) is not a path;
 * 4. a leading `/` is a URL route (`/api/build`), not a repository path;
 * 5. a span with a `/` is a Git ref when it is a branch or tag name, or starts `origin/`,
 *    `archive/`, `exp/` or `refs/` (and that first segment is not a directory);
 * 6. a span with a `/` is a path when it has a known extension, starts `./` or `../`, or its
 *    first segment is an existing directory (at the root or beside the document);
 * 7. a span with no `/` and a known extension is a path when it resolves beside the document or
 *    at the root, or exactly one tracked file has that name; otherwise it is a `name`.
 *
 * Without a context (no `exists`) every span that passes 0, 3 and 4 is a path, as before.
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
    } else if (node.type === "inlineCode") {
      const kind = spanKind(node.value.trim(), context);
      // Rule 1 suppresses a span that is only a link's label, so one link yields one ref. A line
      // locator is NOT suppressed: the label is the reader's visible text and rots like any other
      // citation, and the link's own target is a different kind, so nothing is counted twice.
      if (kind !== undefined && (kind === "line" || !inResolvingLink)) {
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

/**
 * A revision-qualified reference: `<rev>:<path>`. The revision is a 7-40 hex object id, a
 * `HEAD`-relative expression, or a name the reference context lists as a Git ref; the path is a
 * repository path. This is the ONLY kind that binds content to a revision, so `path` never stands
 * in for it: a plain `doc-verify/src/checker.ts` says which file, not which version of it.
 *
 * ⚠ THE REVISION COMPONENT IS TIGHT ON PURPOSE. `doc-verify:verdict/strict` and
 * `https://host/x.md` are full of colons, and the line-locator rule already claims `path:123`.
 * Requiring the left side to be a real object name (or a listed ref) is what keeps this kind from
 * swallowing them; over **all 269 Markdown files at this tree it admits exactly ONE span**, the
 * worked example in `lib/examples/receipt.md`.
 */
const SPEC_HEX = /^[0-9a-f]{7,40}$/;
const SPEC_HEAD = /^HEAD(?:[~^][0-9]*)*$/;

/**
 * Whether `value` is a revision-qualified reference, and if so its two components. The revision
 * must be resolvable *as a name* -- hex, `HEAD`-relative, or a listed ref -- and the path must
 * look like a repository path, so a line locator (`path.ts:123`) and a URL never reach here.
 */
function specParts(value: string, context: ReferenceContext | undefined): { revision: string; path: string } | undefined {
  const colon = value.indexOf(":");
  if (colon <= 0 || colon === value.length - 1) {
    return undefined;
  }
  const revision = value.slice(0, colon);
  const file = value.slice(colon + 1);
  if (!(SPEC_HEX.test(revision) || SPEC_HEAD.test(revision) || (context?.gitRefs?.includes(revision) ?? false))) {
    return undefined;
  }
  if (!PATH_SPAN.test(file) || file.startsWith("/") || ONLY_EXTENSIONS.test(file)) {
    return undefined;
  }
  // A bare `name` on the right is not a path: `rev:main` names a revision and a ref, not a file.
  if (!file.includes("/") && !FILE_EXTENSION.test(file)) {
    return undefined;
  }
  return { revision, path: file };
}

function spanKind(value: string, context: ReferenceContext | undefined): DocumentReference["kind"] | undefined {
  if (isLineLocator(value, context)) {
    return "line";
  }
  // A revision-qualified reference is decided before the path rules, because PATH_SPAN (below)
  // refuses a `:` outright -- which is exactly why `<rev>:<path>` was invisible.
  if (specParts(value, context) !== undefined) {
    return "spec";
  }
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
  // ⚠ A `spec` RESOLVES ONLY THROUGH ITS OWN RESOLVER, NEVER THROUGH `exists`. A path that exists
  // says nothing about whether the REVISION exists, and a revision that exists says nothing about
  // the path -- so letting `resolvesTarget` answer for a spec would report a checked revision that
  // was never checked. With no resolver the capability is absent, and (like `exists`) the fact is
  // then not claimed either way rather than being called a failure.
  if (reference.kind === "spec") {
    return context.resolveSpec === undefined || context.resolveSpec(reference.target) === "ok";
  }
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

/**
 * One checked section reference (kernel-trials round 11, design/07 phase 0): a Markdown link's
 * `#fragment` on a `.md` target, or a document-qualified `§Heading`. `target` is the reference as
 * written (a link's target; for `§`, the binding document as written, ` §`, and the text up to its
 * first punctuation mark); `closest` the target document's nearest headings by string distance.
 */
export interface SectionReference {
  section: string;
  target: string;
  line: number;
  resolves: boolean;
  closest: string[];
}

/** A target document's headings: text (mdast `toString`), folded tokens, document-global slug. */
interface TargetHeading {
  text: string;
  tokens: string[];
  slug: string;
}

/** `#L12`, `#L10-L20`: a line anchor on a rendered file, not a section. */
const LINE_ANCHOR = /^L[0-9]+(?:-L[0-9]+)?$/;
/** A `§` whose first token is an id or a number (`§3`, `§9`, `§C9`, `§C1-receipt`) is never checked. */
const SECTION_ID = /^[A-Za-z]?\d+(?:[.-]\w+)*$/;
/** `design/NN` (not `design/NN-…`, not a longer number): the single `design/NN-*.md`. */
const DESIGN_SHORT = /(?<![A-Za-z0-9_./-])design\/([0-9]{2})(?![-0-9])/g;
/** A path ending `.md`, bare or in backticks. */
const MD_PATH = /(?<![A-Za-z0-9_./-])[A-Za-z0-9_./-]*[A-Za-z0-9_-]\.md(?![A-Za-z0-9_-])/g;
/** Where a `§` citation's text stops for its written form and the short-citation test. */
const CITATION_STOP = /[^\p{L}\p{N}\s'’-]/u;
/** A list item's first line: the start of a sentence. */
const LIST_ITEM = /^[ \t]*(?:[-*+]|[0-9]+[.)])[ \t]/;
/** Inline code inside the masked text: never a citation, a stop for a citation's text. */
const CODE_MASK = "\u0000";

const headingCaches = new WeakMap<(repoPath: string) => string | undefined, Map<string, TargetHeading[] | undefined>>();

/** Case- and punctuation-folded tokens. */
export function foldTokens(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter((token) => token.length > 0);
}

function startsWithTokens(whole: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= whole.length && prefix.every((token, index) => whole[index] === token);
}

/** Headings in document order with GitHub's document-global slugs (`-1`, `-2` on duplicates). */
export function targetHeadings(headingTexts: readonly string[]): TargetHeading[] {
  const slugger = new GithubSlugger();
  return headingTexts.map((text) => ({ text, tokens: foldTokens(text), slug: slugger.slug(text) }));
}

function headingsOf(markdown: string): TargetHeading[] {
  return targetHeadings(segmentMarkdown(markdown).filter((section) => section.depth > 0).map((section) => section.heading));
}

function readHeadings(context: ReferenceContext, repoPath: string): TargetHeading[] | undefined {
  const read = context.readTarget;
  if (read === undefined) {
    return undefined;
  }
  let cache = headingCaches.get(read);
  if (cache === undefined) {
    cache = new Map();
    headingCaches.set(read, cache);
  }
  if (!cache.has(repoPath)) {
    const text = read(repoPath);
    cache.set(repoPath, text === undefined ? undefined : headingsOf(text));
  }
  return cache.get(repoPath);
}

/**
 * Whether a `§` citation names a heading: some heading's tokens are a prefix of the text's tokens
 * up to the sentence end, or the text's tokens up to its first punctuation mark are a non-empty
 * prefix of some heading's tokens (so `§Rule` resolves against any heading beginning `Rule`).
 */
export function citationResolves(headings: readonly { tokens: readonly string[] }[], sentenceText: string, citation: string): boolean {
  const text = foldTokens(sentenceText);
  const cited = foldTokens(citation);
  return headings.some((heading) => (heading.tokens.length > 0 && startsWithTokens(text, heading.tokens))
    || (cited.length > 0 && startsWithTokens(heading.tokens, cited)));
}

/** Whether a `§` citation is an id or a number, which is never checked. */
export function isSectionId(citationText: string): boolean {
  const first = /^\S+/.exec(citationText.trim())?.[0].replace(/[^A-Za-z0-9]+$/, "") ?? "";
  return first.length > 0 && SECTION_ID.test(first);
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Up to three closest candidates by edit distance (over `key`), ties in document order. */
export function closest(wanted: string, candidates: readonly string[], key: (candidate: string) => string = (candidate) => candidate): string[] {
  return [...new Set(candidates)]
    .map((candidate, index) => ({ candidate, index, distance: levenshtein(wanted, key(candidate)) }))
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .slice(0, 3)
    .map((entry) => entry.candidate);
}

/** The repository path a target names (relative to the document, then the root), if any. */
export function resolveTargetPath(documentPath: string, target: string, exists: (repoPath: string) => boolean): string | undefined {
  const raw = target.split("#")[0]?.split("?")[0] ?? "";
  if (raw.length === 0) {
    return undefined;
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep the target as written
  }
  for (const value of new Set([raw, decoded])) {
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(documentPath), value));
    const fromRoot = path.posix.normalize(value.replace(/^\/+/, ""));
    for (const candidate of value.startsWith("/") ? [fromRoot] : [relative, fromRoot]) {
      const clean = candidate.replace(/\/+$/, "");
      if (clean.length > 0 && clean !== "." && !clean.startsWith("../") && clean !== ".." && exists(clean)) {
        return clean;
      }
    }
  }
  return undefined;
}

/** A document a `§` may bind to: where it is written, as written, and the file it names. */
interface DocumentCandidate {
  offset: number;
  text: string;
  resolve: () => string | undefined;
}

/**
 * Section references (round 11): every Markdown link with a `#fragment` on a `.md` target (or a
 * bare `#fragment`, the document itself), and every `§` citation bound to a document named
 * earlier in its sentence. Only with `context.readTarget`: without it nothing is checked, and
 * nothing is reported either way.
 */
export function sectionReferences(markdown: string, sections: Section[], context: ReferenceContext): SectionReference[] {
  const read = context.readTarget;
  if (read === undefined) {
    return [];
  }
  return scanSectionReferences(markdown, sections, context, context.exists ?? ((repoPath: string): boolean => read(repoPath) !== undefined));
}

/**
 * The documents this one names in prose, for the affected closure: each `.md` file a `§` citation
 * binds to, and each repository path a code span names (`DocumentReference` kind `path`). A target
 * is not read: binding needs only `exists` and `files`, so a renamed heading or a deleted file
 * still leaves its edge. Markdown links are the link graph's own (`extractMarkdownLinks`).
 */
export function citedDocuments(markdown: string, context: ReferenceContext & { exists: (repoPath: string) => boolean }): string[] {
  const cited = new Set<string>();
  const { readTarget: _readTarget, ...unread } = context;
  scanSectionReferences(markdown, [], unread, context.exists, (repoPath) => cited.add(repoPath));
  for (const reference of documentReferences(markdown, [], unread)) {
    if (reference.kind === "path") {
      const repoPath = resolveTargetPath(context.path, reference.target, context.exists);
      if (repoPath !== undefined) {
        cited.add(repoPath);
      }
    }
  }
  return [...cited].sort();
}

/**
 * `sectionReferences` without the guard: `onCite` hears every document a `§` citation binds to,
 * before its headings are read (so it hears it even when nothing can be read).
 */
function scanSectionReferences(
  markdown: string,
  sections: Section[],
  context: ReferenceContext,
  exists: (repoPath: string) => boolean,
  onCite?: (repoPath: string) => void,
): SectionReference[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const metadataEnd = frontMatterEnd(markdown);
  const own = targetHeadings(sections.filter((section) => section.depth > 0).map((section) => section.heading));
  const sectionAt = (line: number): string => {
    let current = "@preamble";
    for (const section of sections) {
      if (section.depth > 0 && section.startLine <= line) {
        current = section.id;
      }
    }
    return current;
  };
  const found: Array<SectionReference & { offset: number }> = [];

  // The text with code blocks and front matter blanked (`prose`) and, further, inline code
  // replaced by CODE_MASK (`masked`); offsets and line breaks are kept.
  // One array slot per UTF-16 unit, so offsets stay mdast's.
  const proseChars = markdown.split("");
  const blank = (chars: string[], start: number, end: number, fill: string): void => {
    for (let index = start; index < end && index < chars.length; index += 1) {
      if (chars[index] !== "\n") {
        chars[index] = fill;
      }
    }
  };
  blank(proseChars, 0, metadataEnd, " ");
  const codeSpans: Array<[number, number]> = [];
  const links: Array<{ url: string; offset: number; end: number; line: number }> = [];
  const visit = (node: Root | RootContent): void => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) {
      if ("children" in node) {
        node.children.forEach(visit);
      }
      return;
    }
    if (end <= metadataEnd && metadataEnd > 0) {
      return;
    }
    if (node.type === "code") {
      blank(proseChars, start, end, " ");
      return;
    }
    if (node.type === "inlineCode") {
      codeSpans.push([start, end]);
      return;
    }
    if ((node.type === "link" || node.type === "definition") && node.url.trim().length > 0 && !URL_TARGET.test(node.url.trim())) {
      links.push({ url: node.url.trim(), offset: start, end, line: node.position?.start.line ?? 1 });
    }
    if ("children" in node) {
      node.children.forEach(visit);
    }
  };
  visit(tree);
  const prose = proseChars.join("");
  const maskedChars = [...proseChars];
  for (const [start, end] of codeSpans) {
    blank(maskedChars, start, end, CODE_MASK);
  }
  const masked = maskedChars.join("");
  const lineStarts = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }
  const lineOf = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((lineStarts[middle] ?? 0) <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low + 1;
  };

  // Fragments, on Markdown links only.
  for (const link of links) {
    const hash = link.url.indexOf("#");
    if (hash < 0) {
      continue;
    }
    const fragment = link.url.slice(hash + 1);
    const file = link.url.slice(0, hash).split("?")[0] ?? "";
    if (fragment.length === 0 || LINE_ANCHOR.test(fragment)) {
      continue;
    }
    let headings: TargetHeading[] | undefined;
    if (file.length === 0) {
      headings = own;
    } else {
      let decodedFile = file;
      try {
        decodedFile = decodeURIComponent(file);
      } catch {
        // keep the target as written
      }
      if (!/\.md$/i.test(decodedFile)) {
        continue;
      }
      const repoPath = resolveTargetPath(context.path, file, exists);
      if (repoPath === undefined) {
        continue; // a missing file is the `link` finding, not a fragment one
      }
      headings = readHeadings(context, repoPath);
    }
    if (headings === undefined) {
      continue;
    }
    let decoded = fragment;
    try {
      decoded = decodeURIComponent(fragment);
    } catch {
      // keep the fragment as written
    }
    const slugs = new Set(headings.map((heading) => heading.slug));
    found.push({
      section: sectionAt(link.line),
      target: link.url,
      line: link.line,
      offset: link.offset,
      resolves: slugs.has(fragment) || slugs.has(decoded),
      closest: closest(decoded, headings.map((heading) => heading.slug)).map((slug) => `#${slug}`),
    });
  }

  // `§` citations: sentence boundaries over `masked`.
  const boundaries: number[] = [0];
  for (let index = 0; index < lineStarts.length; index += 1) {
    const start = lineStarts[index] ?? 0;
    const end = lineStarts[index + 1] ?? masked.length + 1;
    const lineText = masked.slice(start, end - 1);
    if (lineText.trim().length === 0 || LIST_ITEM.test(lineText)) {
      boundaries.push(start);
    }
    if (lineText.trim().length === 0) {
      boundaries.push(end - 1);
    }
  }
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index];
    if (char === "|" && masked[index - 1] !== "\\") {
      boundaries.push(index, index + 1);
    } else if ((char === "." || char === "!" || char === "?") && /\s/.test(masked[index + 1] ?? "")) {
      boundaries.push(index + 1);
    }
  }
  boundaries.push(masked.length);
  boundaries.sort((left, right) => left - right);
  const sentenceAt = (offset: number): [number, number] => {
    let start = 0;
    let end = masked.length;
    for (const boundary of boundaries) {
      if (boundary <= offset) {
        start = boundary;
      } else {
        end = boundary;
        break;
      }
    }
    return [start, end];
  };

  // Documents a `§` may bind to: links, `.md` paths (bare or in backticks) and `design/NN`.
  const insideLink = (offset: number): boolean => links.some((link) => link.offset <= offset && offset < link.end);
  const candidates: DocumentCandidate[] = links.map((link) => ({
    offset: link.offset,
    text: link.url,
    resolve: () => resolveTargetPath(context.path, link.url, exists),
  }));
  for (const match of prose.matchAll(MD_PATH)) {
    if (!insideLink(match.index)) {
      candidates.push({ offset: match.index, text: match[0], resolve: () => resolveTargetPath(context.path, match[0], exists) });
    }
  }
  for (const match of prose.matchAll(DESIGN_SHORT)) {
    if (!insideLink(match.index)) {
      const prefix = `design/${match[1] ?? ""}-`;
      candidates.push({
        offset: match.index,
        text: match[0],
        resolve: () => {
          const matches = (context.files ?? []).filter((file) => file.startsWith(prefix) && file.endsWith(".md") && !file.slice(prefix.length).includes("/"));
          return matches.length === 1 ? matches[0] : undefined;
        },
      });
    }
  }
  candidates.sort((left, right) => right.offset - left.offset);

  for (let index = masked.indexOf("§"); index >= 0; index = masked.indexOf("§", index + 1)) {
    const [sentenceStart, sentenceEnd] = sentenceAt(index);
    const rest = masked.slice(index + 1, sentenceEnd);
    if (rest.trimStart().startsWith(CODE_MASK) || isSectionId(rest)) {
      continue;
    }
    const stop = CITATION_STOP.exec(rest);
    const citation = (stop === null ? rest : rest.slice(0, stop.index)).replace(/\s+/g, " ").trim();
    if (citation.length === 0) {
      continue;
    }
    let bound: { candidate: DocumentCandidate; repoPath: string } | undefined;
    for (const candidate of candidates) {
      if (candidate.offset >= index || candidate.offset < sentenceStart) {
        continue;
      }
      const repoPath = candidate.resolve();
      if (repoPath !== undefined) {
        bound = { candidate, repoPath };
        break;
      }
    }
    if (bound === undefined || !/\.md$/i.test(bound.repoPath)) {
      continue;
    }
    onCite?.(bound.repoPath);
    const headings = readHeadings(context, bound.repoPath);
    if (headings === undefined) {
      continue;
    }
    const line = lineOf(index);
    found.push({
      section: sectionAt(line),
      target: `${bound.candidate.text} §${citation}`,
      line,
      offset: index,
      resolves: citationResolves(headings, rest.replaceAll(CODE_MASK, " "), citation),
      closest: closest(foldTokens(citation).join(" "), headings.map((heading) => heading.text), (text) => foldTokens(text).join(" ")),
    });
  }
  return found.sort((left, right) => left.offset - right.offset).map(({ offset: _offset, ...reference }) => reference);
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
