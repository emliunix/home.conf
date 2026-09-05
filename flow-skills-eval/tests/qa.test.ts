import { describe, expect, it } from "vite-plus/test";

import { conjunctionViolations } from "../src/eval/decision.ts";
import { decisionCases, smokeCases } from "../src/eval/qa.ts";

describe("DecisionCase corpus", () => {
  it("exports one array whose expected tuples satisfy required conjunctions", () => {
    for (const c of decisionCases) {
      expect(conjunctionViolations(c.expected), c.id).toEqual([]);
    }
  });

  it("smoke is the arch-failure triplet sharing one expected", () => {
    expect(smokeCases.map((c) => c.id)).toEqual([
      "arch-failure-canonical",
      "arch-failure-trap",
      "arch-failure-paraphrase",
    ]);
    const expected = smokeCases[0]?.expected;
    expect(smokeCases.every((c) => c.expected === expected || JSON.stringify(c.expected) === JSON.stringify(expected))).toBe(
      true,
    );
  });

  it("canonical fixtures for the named e2e include Status and three heads", () => {
    const named = decisionCases.find((c) => c.id === "arch-failure-canonical");
    expect(named?.fixture).toContain("## Problem statement");
    expect(named?.fixture).toContain("## Scope — what we touch");
    expect(named?.fixture).toContain("## Rationale");
    expect(named?.fixture).toContain("## Status");
    expect(named?.fixture).toContain("pending-retro");
    expect(named?.expected).toEqual({
      next_action: "open_new_design",
      status_to_set: "unchanged",
      write_target: "new_design_file",
    });
  });
});
