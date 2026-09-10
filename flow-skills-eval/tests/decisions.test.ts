import { describe, expect, it } from "vite-plus/test";

import {
  NEXT_ACTIONS,
  STATUSES_TO_SET,
  WRITE_TARGETS,
  compareDecision,
  parseDecision,
  type Decision,
} from "../src/eval/decisions.ts";

const expected: Decision = Object.freeze({
  next_action: "set_status",
  status_to_set: "reviewed",
  write_target: "design_body",
  opens_new_design: false,
});

describe("parseDecision", () => {
  it("parses a valid submit_decision payload", () => {
    const decision = parseDecision(
      JSON.stringify({
        next_action: "set_status",
        status_to_set: "reviewed",
        write_target: "design_body",
        opens_new_design: false,
      }),
    );

    expect(decision).toEqual(expected);
    expect(Object.isFrozen(decision)).toBe(true);
  });

  it("accepts the follow-up sweep enum values", () => {
    const decision = parseDecision(
      JSON.stringify({
        next_action: "set_status",
        status_to_set: "draft-followup",
        write_target: "followup_design_file",
        opens_new_design: false,
      }),
    );

    expect(decision).toEqual({
      next_action: "set_status",
      status_to_set: "draft-followup",
      write_target: "followup_design_file",
      opens_new_design: false,
    });
  });

  it("rejects out-of-enum fields with the offending value", () => {
    expect(() =>
      parseDecision(
        JSON.stringify({
          next_action: "set_status",
          status_to_set: "half-landed",
          write_target: "design_body",
          opens_new_design: false,
        }),
      ),
    ).toThrow("status_to_set");

    expect(() =>
      parseDecision(
        JSON.stringify({
          next_action: "set_status",
          status_to_set: "reviewed",
          write_target: "design_body",
          opens_new_design: "no",
        }),
      ),
    ).toThrow("opens_new_design");
  });

  it("exposes every valid enum value in the public arrays", () => {
    expect(NEXT_ACTIONS).toContain("set_status");
    expect(STATUSES_TO_SET).toContain("draft-followup");
    expect(WRITE_TARGETS).toContain("followup_design_file");
  });
});

describe("compareDecision", () => {
  it("matches identical decisions field-by-field", () => {
    const comparison = compareDecision(expected, { ...expected });

    expect(comparison.matched).toBe(true);
    expect(comparison.divergedFields).toEqual([]);
    expect(comparison.score).toBe(1);
  });

  it("reports exactly which field diverged", () => {
    const comparison = compareDecision(expected, {
      ...expected,
      status_to_set: "unchanged",
      write_target: "worklog",
    });

    expect(comparison.matched).toBe(false);
    expect(comparison.divergedFields).toEqual(["status_to_set", "write_target"]);
    expect(comparison.score).toBeCloseTo(2 / 4);
  });
});
