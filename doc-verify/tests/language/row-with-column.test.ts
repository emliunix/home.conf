// `core.row_with_column(D, R, C)` (kernel-trials round 9, candidate R2): a row's Property and `C`
// cells plus its table's property list, the row's own marked. The three cases the round's plan
// names: an empty Property cell, a single-row table, the row's own property marked.
import { describe, expect, it } from "vitest";

import { documentFacts, rowWithColumnEvidence } from "../../src/engine/facts.js";

const DOC = [
  "# T",
  "",
  "## Verification design",
  "",
  "| Property | Failure witness | Command |",
  "| --- | --- | --- |",
  "| Binding | Two atoms swap answers | `npm test` |",
  "|  | An unnamed row's witness | `npm test` |",
  "| Rounds bounded | A depth-2 program makes 3 rounds | `npm test` |",
  "",
  "## Single",
  "",
  "| Property | Failure witness |",
  "| --- | --- |",
  "| Alone | The only witness |",
  "",
].join("\n");

describe("core.row_with_column evidence", () => {
  const facts = documentFacts({ path: "design/99.md", markdown: DOC });

  it("marks the row's own property in the table-order list, one piece at the row's line", () => {
    const evidence = rowWithColumnEvidence(facts, "verification-design#row3", "Failure witness");
    const text = [
      "Property: Rounds bounded",
      "Failure witness: A depth-2 program makes 3 rounds",
      "",
      "Properties in this table:",
      " - Binding",
      " - (unnamed)",
      " - Rounds bounded (this row)",
      "",
    ].join("\n");
    expect(evidence).toEqual({ sections: ["verification-design"], text, pieces: [{ id: "verification-design#row3", startLine: 9, offset: 0, text }] });
  });

  it("lists an empty Property cell as (unnamed) and drops its Property line, as core.cells", () => {
    const evidence = rowWithColumnEvidence(facts, "verification-design#row2", "Failure witness");
    expect(evidence?.text).toBe([
      "Failure witness: An unnamed row's witness",
      "",
      "Properties in this table:",
      " - Binding",
      " - (unnamed) (this row)",
      " - Rounds bounded",
      "",
    ].join("\n"));
  });

  it("renders a single-row table as the row and a one-line list; no row or no cell yields no evidence", () => {
    const evidence = rowWithColumnEvidence(facts, "single#row1", "Failure witness");
    expect(evidence?.text).toBe("Property: Alone\nFailure witness: The only witness\n\nProperties in this table:\n - Alone (this row)\n");
    expect(evidence?.pieces.map((piece) => [piece.id, piece.startLine])).toEqual([["single#row1", 15]]);
    expect(rowWithColumnEvidence(facts, "single#row9", "Failure witness")).toBeUndefined();
    expect(rowWithColumnEvidence(facts, "single#row1", "Nope")?.text).toBe("Property: Alone\n\nProperties in this table:\n - Alone (this row)\n");
  });
});
