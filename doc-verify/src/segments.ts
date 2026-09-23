import GithubSlugger from "github-slugger";
import type { Heading, Root, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import { unified } from "unified";
import remarkParse from "remark-parse";

import { sha256 } from "./hash.js";
import { Section, sectionId } from "./types.js";

export function segmentMarkdown(markdown: string): Section[] {
  const root = unified().use(remarkParse).parse(markdown);
  const headings = collectHeadings(root).map(({ node, offset, line }) => ({
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
