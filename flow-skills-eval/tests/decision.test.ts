import { describe, expect, it } from "vite-plus/test";

import { usageMetrics } from "../src/eval/agent.ts";
import {
  compareDecision,
  conjunctionViolations,
  parseDecision,
  type Decision,
} from "../src/eval/decision.ts";

const legal: Decision = {
  next_action: "open_new_design",
  status_to_set: "unchanged",
  write_target: "new_design_file",
};

describe("Decision parse and compare", () => {
  it("parses a legal submit_decision payload", () => {
    const result = parseDecision(JSON.stringify(legal));
    expect(result).toEqual({ kind: "ok", decision: legal });
  });

  it("returns invalid_arguments for bad JSON, bad enums, and conjunction violations", () => {
    expect(parseDecision("not-json").kind).toBe("invalid_arguments");
    expect(parseDecision(JSON.stringify({ ...legal, next_action: "nope" })).kind).toBe(
      "invalid_arguments",
    );
    expect(
      parseDecision(
        JSON.stringify({
          next_action: "open_new_design",
          status_to_set: "draft",
          write_target: "new_design_file",
        }),
      ).kind,
    ).toBe("invalid_arguments");
  });

  it("compares field-by-field", () => {
    const actual: Decision = {
      next_action: "set_status",
      status_to_set: "draft",
      write_target: "worklog",
    };
    const divergences = compareDecision(legal, actual);
    expect(divergences.map((d) => d.field)).toEqual(["next_action", "status_to_set", "write_target"]);
  });

  it("lists no conjunction violations for the named e2e tuple", () => {
    expect(conjunctionViolations(legal)).toEqual([]);
  });
});

describe("usage metrics", () => {
  it("reads prompt_tokens_details.cached_tokens and uses 0 when absent", () => {
    expect(
      usageMetrics({
        prompt_tokens: 10,
        completion_tokens: 3,
        prompt_tokens_details: { cached_tokens: 7 },
      }),
    ).toEqual({ prompt_tokens: 10, completion_tokens: 3, cached_tokens: 7 });
    expect(usageMetrics({ prompt_tokens: 10, completion_tokens: 3 })).toEqual({
      prompt_tokens: 10,
      completion_tokens: 3,
      cached_tokens: 0,
    });
    expect(usageMetrics({ cached_tokens: 99 })).toEqual({
      prompt_tokens: 0,
      completion_tokens: 0,
      cached_tokens: 0,
    });
  });
});
