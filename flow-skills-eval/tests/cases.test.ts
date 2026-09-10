import { describe, expect, it } from "vite-plus/test";

import { WARMUP_CASE, casesForProfile, decisionCases, fixtureProblems } from "../src/eval/cases.ts";
import { NEXT_ACTIONS, STATUSES_TO_SET, WRITE_TARGETS } from "../src/eval/decisions.ts";

const KIND_SUFFIXES = ["canonical", "trap", "paraphrase"] as const;

describe("L1 decision-case corpus", () => {
  it("has unique ids whose suffix matches the declared kind", () => {
    const ids = decisionCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of decisionCases) {
      expect(c.id.endsWith(`-${c.kind}`), c.id).toBe(true);
    }
  });

  it("covers every behavior with a full canonical/trap/paraphrase triplet", () => {
    const kindsByBehavior = new Map<string, Set<string>>();
    for (const c of decisionCases) {
      const behavior = c.id.slice(0, c.id.length - c.kind.length - 1);
      const kinds = kindsByBehavior.get(behavior) ?? new Set<string>();
      kinds.add(c.kind);
      kindsByBehavior.set(behavior, kinds);
    }

    // Minimum corpus: 3 gate transitions + 4 routing forks + sweep destination
    // + budget + write-target + defense rejection.
    expect(kindsByBehavior.size).toBeGreaterThanOrEqual(10);
    for (const [behavior, kinds] of kindsByBehavior) {
      expect([...kinds].sort(), behavior).toEqual([...KIND_SUFFIXES].sort());
    }
  });

  it("keeps every fixture well-formed (three heads, valid status word)", () => {
    for (const c of [...decisionCases, WARMUP_CASE]) {
      expect(fixtureProblems(c.fixture), c.id).toEqual([]);
    }
  });

  it("flags malformed fixtures", () => {
    expect(fixtureProblems("no heads here").length).toBeGreaterThan(0);
    expect(
      fixtureProblems(
        ["## Problem statement", "x", "## Scope", "y", "## Rationale", "z", "## Status", "shipped"].join("\n"),
      ),
    ).toContain("missing or invalid ## Status line");
  });

  it("uses only schema enum values in expected decisions", () => {
    for (const c of decisionCases) {
      expect(NEXT_ACTIONS, c.id).toContain(c.expected.next_action);
      expect(STATUSES_TO_SET, c.id).toContain(c.expected.status_to_set);
      expect(WRITE_TARGETS, c.id).toContain(c.expected.write_target);
    }
  });

  it("keeps expected decisions internally coherent", () => {
    for (const c of decisionCases) {
      // A status word may only be produced by set_status, and vice versa.
      expect(c.expected.next_action === "set_status", c.id).toBe(
        c.expected.status_to_set !== "unchanged",
      );
      // Only open_new_design opens a new design.
      expect(c.expected.opens_new_design, c.id).toBe(c.expected.next_action === "open_new_design");
      // Follow-up sweep files pair with draft-followup status and set_status action.
      if (c.expected.write_target === "followup_design_file") {
        expect(c.expected.status_to_set, c.id).toBe("draft-followup");
        expect(c.expected.next_action, c.id).toBe("set_status");
      }
      // draft-followup status only makes sense with a follow-up design file target.
      if (c.expected.status_to_set === "draft-followup") {
        expect(c.expected.write_target, c.id).toBe("followup_design_file");
      }
      // New design files are the architecture-failure route, not the sweep route.
      if (c.expected.write_target === "new_design_file") {
        expect(c.expected.next_action, c.id).toBe("open_new_design");
        expect(c.expected.status_to_set, c.id).toBe("unchanged");
      }
    }
  });

  it("selects canonical cases only for the smoke profile", () => {
    const smoke = casesForProfile("smoke");

    expect(smoke.length).toBeGreaterThan(0);
    expect(smoke.every((c) => c.kind === "canonical")).toBe(true);
    expect(casesForProfile("full")).toEqual(decisionCases);
  });
});
