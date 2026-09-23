import { describe, expect, it } from "vitest";

import { segmentMarkdown } from "../src/segments.js";

describe("Markdown segments", () => {
  it("uses AST headings, parent paths, and stable duplicate slugs", () => {
    const source = [
      "preamble",
      "# Title",
      "## Risk",
      "one",
      "```md",
      "## not a heading",
      "```",
      "### Detail",
      "two",
      "## Risk",
      "three",
      "",
    ].join("\n");
    const sections = segmentMarkdown(source);
    expect(sections.map((section) => section.id)).toEqual([
      "@preamble",
      "title",
      "risk",
      "risk/detail",
      "risk-1",
    ]);
    expect(sections[2]?.content).toContain("## not a heading");
    expect(sections[2]?.content).toContain("### Detail");
    expect(sections[2]?.endByte).toBe(Buffer.byteLength(source.slice(0, source.lastIndexOf("## Risk"))));
  });

  it("reports UTF-8 byte offsets rather than JavaScript character offsets", () => {
    const source = "é\n# One\ntext\n";
    const sections = segmentMarkdown(source);
    expect(sections[1]?.startByte).toBe(Buffer.byteLength("é\n"));
  });
});
