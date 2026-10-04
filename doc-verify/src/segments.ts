import GithubSlugger from "github-slugger";
import type { Heading, Root, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import { unified } from "unified";
import remarkParse from "remark-parse";
import YAML from "yaml";

import { sha256 } from "./hash.js";
import { Section, SectionId, sectionId } from "./types.js";

/**
 * The character offset where a YAML front matter block ends, or 0 when there is none:
 * a first line `---`, then any lines, then a closing `---` (or `...`) line. CommonMark alone reads
 * `---`/`key: v`/`---` as a rule and a setext heading; the block is metadata, part of the preamble.
 * The lines between must parse as a YAML mapping (or be empty).
 */
export function frontMatterEnd(markdown: string): number {
  const match = /^---[ \t]*\r?\n((?:[\s\S]*?\r?\n)?)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(markdown);
  if (match === null) {
    return 0;
  }
  // Only a YAML mapping (or nothing) is front matter; a document that opens with a rule is not.
  try {
    const body = match[1] ?? "";
    if (body.trim().length === 0) {
      return match[0].length;
    }
    const value: unknown = YAML.parse(body);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? match[0].length : 0;
  } catch {
    return 0;
  }
}

export function segmentMarkdown(markdown: string): Section[] {
  const root = unified().use(remarkParse).parse(markdown);
  const metadataEnd = frontMatterEnd(markdown);
  const headings = collectHeadings(root).filter(({ offset }) => offset >= metadataEnd).map(({ node, offset, line }) => ({
    node,
    offset,
    line,
    id: "",
    heading: toString(node),
  }));

  const ancestors: Array<{ depth: number; id: string }> = [];
  const sluggers = new Map<string, GithubSlugger>();
  for (const heading of headings) {
    while ((ancestors.at(-1)?.depth ?? -1) >= heading.node.depth) {
      ancestors.pop();
    }
    const parentId = [...ancestors].reverse().find((ancestor) => ancestor.depth > 1)?.id ?? "";
    let slugger = sluggers.get(parentId);
    if (slugger === undefined) {
      slugger = new GithubSlugger();
      sluggers.set(parentId, slugger);
    }
    const slug = slugger.slug(heading.heading);
    heading.id = parentId.length === 0 ? slug : `${parentId}/${slug}`;
    ancestors.push({ depth: heading.node.depth, id: heading.id });
  }

  const sections: Section[] = [];
  const firstOffset = headings[0]?.offset ?? markdown.length;
  if (firstOffset > 0 || headings.length === 0) {
    sections.push(makeSection({
      markdown,
      id: "@preamble",
      heading: "",
      depth: 0,
      startOffset: 0,
      endOffset: firstOffset,
      startLine: 1,
      endLine: Math.max(1, headings[0]?.line === undefined ? lineAt(markdown, markdown.length) : headings[0].line - 1),
    }));
  }

  for (const [index, heading] of headings.entries()) {
    const next = headings.slice(index + 1).find((candidate) => candidate.node.depth <= heading.node.depth);
    const endOffset = next?.offset ?? markdown.length;
    sections.push(makeSection({
      markdown,
      id: heading.id,
      heading: heading.heading,
      depth: heading.node.depth,
      startOffset: heading.offset,
      endOffset,
      startLine: heading.line,
      endLine: Math.max(heading.line, lineAt(markdown, endOffset)),
    }));
  }
  return sections;
}

function collectHeadings(root: Root): Array<{ node: Heading; offset: number; line: number }> {
  const found: Array<{ node: Heading; offset: number; line: number }> = [];
  const visit = (node: Root | RootContent): void => {
    if (node.type === "heading") {
      const offset = node.position?.start.offset;
      const line = node.position?.start.line;
      if (offset !== undefined && line !== undefined) {
        found.push({ node, offset, line });
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(root);
  return found;
}

function makeSection(input: {
  markdown: string;
  id: string;
  heading: string;
  depth: number;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
}): Section {
  const content = input.markdown.slice(input.startOffset, input.endOffset);
  return {
    id: sectionId(input.id),
    heading: input.heading,
    depth: input.depth,
    startLine: input.startLine,
    endLine: input.endLine,
    startByte: Buffer.byteLength(input.markdown.slice(0, input.startOffset)),
    endByte: Buffer.byteLength(input.markdown.slice(0, input.endOffset)),
    content,
    contentHash: sha256(content),
  };
}

function lineAt(markdown: string, offset: number): number {
  return markdown.slice(0, offset).split("\n").length;
}

/**
 * A section's own text: its heading and its own prose, excluding nested sections.
 * A parent section's `content` already spans its children, so sending the full
 * content repeats every child body once per question -- the defect this exists to
 * avoid. The context path travels separately, so a bounded segment is still
 * readable in place.
 */
export interface OwnSegment {
  id: SectionId;
  /** Ancestor headings, outermost first. */
  headingPath: string[];
  text: string;
}

export function ownSegments(sections: Section[]): OwnSegment[] {
  const stack: Section[] = [];
  const segments: OwnSegment[] = [];
  for (const [index, section] of sections.entries()) {
    while ((stack.at(-1)?.depth ?? -1) >= section.depth) {
      stack.pop();
    }
    const headingPath = stack.map((ancestor) => ancestor.heading).filter((heading) => heading.length > 0);
    const child = sections
      .slice(index + 1)
      .find((candidate) =>
        candidate.depth > section.depth
        && candidate.startByte > section.startByte
        && candidate.startByte < section.endByte);
    const text = child === undefined
      ? section.content
      : section.content.split("\n").slice(0, Math.max(1, child.startLine - section.startLine)).join("\n");
    segments.push({ id: section.id, headingPath, text });
    stack.push(section);
  }
  return segments;
}
