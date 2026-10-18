import { describe, expect, it } from "vitest";

import { applyStagePolicy } from "../../src/stage-policy.js";

// ⚠ #38, @CowBoy's finding: `BLOCKED` IS NOT A SYNONYM FOR "EMPTY SELECTION".
//
// The first version gated the external override on `status === 3` alone, so EVERY BLOCKED commit was
// allowed. But `BLOCKED` has two causes, and only one of them may not fail a commit:
//
//   zero artifacts     the staged selection matched no document -- nothing was ASKED to be checked.
//                      An empty selection is not a finding.
//   non-empty artifacts  a document WAS selected and its oracle could not be consulted (no judge, a
//                      missing `.env.doc-verify`, an over-budget round). Nothing was EVALUATED, and
//                      allowing the commit is a false green over a document nobody checked.
//
// The artifact count is the discriminator; the verdict alone cannot tell them apart.
describe("external stage: an empty selection is not a finding", () => {
  it("BLOCKED with zero artifacts does not fail the commit", () => {
    expect(applyStagePolicy(3, "external", "BLOCKED", 0)).toBe(0);
  });

  it("BLOCKED with a non-empty population still fails: a selected document went unevaluated", () => {
    expect(applyStagePolicy(3, "external", "BLOCKED", 1)).toBe(3);
    expect(applyStagePolicy(3, "external", "BLOCKED", 14)).toBe(3);
  });

  it("a real finding is refused exactly as before", () => {
    expect(applyStagePolicy(1, "external", "NO-GO", 1)).toBe(1);
    expect(applyStagePolicy(2, "external", "NEEDS-REVIEW", 1)).toBe(2);
    expect(applyStagePolicy(0, "external", "PASS", 3)).toBe(0);
  });
});

describe("local stages are untouched by the external exception", () => {
  it("pre-commit refuses nothing", () => {
    for (const [status, artifacts] of [[0, 0], [1, 1], [2, 1], [3, 0], [3, 1]] as const) {
      expect(applyStagePolicy(status!, "pre-commit", "X", artifacts!)).toBe(0);
    }
  });

  it("pre-push blocks NO-GO and NEEDS-REVIEW but reports BLOCKED", () => {
    expect(applyStagePolicy(1, "pre-push", "NO-GO", 1)).toBe(1);
    expect(applyStagePolicy(2, "pre-push", "NEEDS-REVIEW", 1)).toBe(2);
    expect(applyStagePolicy(3, "pre-push", "BLOCKED", 1)).toBe(0);
  });

  it("no stage at all passes the status through", () => {
    expect(applyStagePolicy(3, undefined, "BLOCKED", 0)).toBe(3);
    expect(applyStagePolicy(1, undefined, "NO-GO", 1)).toBe(1);
  });
});
