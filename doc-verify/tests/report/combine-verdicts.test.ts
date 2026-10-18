import { describe, expect, it } from "vitest";

import { combineVerdicts } from "../../src/checker.js";
import { exitCodeFor } from "../../src/report.js";

// ⚠ #38: AN EMPTY POPULATION REPORTED `PASS`.
//
// `check --staged` with a clean index finds zero artifacts -- the normal state of a docs-only commit.
// The old implementation was `precedence.find(v => verdicts.includes(v)) ?? "PASS"`, and
// `[].includes(anything)` is false, so the fallback fired and the hook reported a clean pass over a
// population it never examined. A docs hook is asked "are the docs ok?"; answering "yes" because it
// found no docs is the defect.
describe("combineVerdicts", () => {
  it("an empty population is BLOCKED, not PASS", () => {
    expect(combineVerdicts([])).toBe("BLOCKED");
  });

  it("an empty population exits non-zero, so a hook cannot read it as success", () => {
    // the whole point: the verdict must reach a status a caller can act on
    expect(exitCodeFor(combineVerdicts([]))).not.toBe(0);
    expect(exitCodeFor(combineVerdicts([]))).toBe(3);
  });

  it("a real pass is still PASS and still exits 0", () => {
    expect(combineVerdicts(["PASS"])).toBe("PASS");
    expect(exitCodeFor(combineVerdicts(["PASS"]))).toBe(0);
  });

  it("WARN alone does not move the verdict", () => {
    expect(combineVerdicts(["WARN"])).toBe("PASS");
    expect(combineVerdicts(["WARN", "PASS"])).toBe("PASS");
  });

  it("precedence is unchanged: NO-GO beats BLOCKED beats NEEDS-REVIEW beats PASS", () => {
    expect(combineVerdicts(["PASS", "NEEDS-REVIEW"])).toBe("NEEDS-REVIEW");
    expect(combineVerdicts(["PASS", "BLOCKED"])).toBe("BLOCKED");
    expect(combineVerdicts(["PASS", "NO-GO"])).toBe("NO-GO");
    expect(combineVerdicts(["NEEDS-REVIEW", "BLOCKED", "NO-GO"])).toBe("NO-GO");
  });
});
