// Task #191: refuse a `core.union` oracle asked over a literal empty section list.
//
// `unionEvidence` returns `{ sections: [], text: "", pieces: [] }` when the wanted set is empty,
// because its `chosen.length === wanted.size` guard is `0 === 0`. Nothing downstream rejects it, so
// the judge is asked to label *nothing* and any answer it returns is fabricated. Measured at the
// landed #190 SHA `c7073093`: a module whose constraint calls `q(D, [])` produced one judge request
// over 0 bytes of evidence — and the verdict class differed between two runs of the same route
// (`NEEDS-REVIEW` in one script, `PASS` in another), which is exactly why the acceptance below
// asserts `requests.length === 0` rather than a verdict class.
//
// The live route is the CALL SITE, not the declaration: `evidence: core.union(D, [])` is already
// refused by the existing evidence-shape validation, because the union shape requires the list
// argument to be a *variable* over the oracle's inputs. So the refusal lives in the call-site
// literal resolution, scoped by the oracle's `union` evidence form and argument index.
//
// This is `core.union`'s own validation question and is separate from `core.present/3`, whose
// zero-present guard is load-bearing and already reddens (`present.test.ts`).

import { describe, expect, it } from "vitest";

import { DOC_PATH, moduleText, scriptedJudge } from "../engine-helpers.js";
import { ModuleError, runProgram, type EngineReport } from "../../src/engine/index.js";

const DOC = ["# Fixture", "", "## Problem statement", "", "Readers cannot find the owner.", ""].join("\n");

/** An oracle whose evidence is the union of its second argument. */
const UNION_ORACLE = `oracles:
  union_of(D, L):
    ask: The union of the listed sections is coherent.
    evidence: core.union(D, L)
    threshold: 0
    max_bytes: 16000
`;

/** Runs a module over one document and reports the refusal or the judge requests it made. */
async function run(moduleYaml: string): Promise<{ refused: string | undefined; report: EngineReport | undefined; judgeRequests: number; evidenceLens: number[] }> {
  const { backend, requests } = scriptedJudge(() => ({ value: "supported" }));
  try {
    const report = await runProgram({
      moduleYaml,
      documents: [{ path: DOC_PATH, markdown: DOC, meta: { kind: "design" } }],
      backend,
      model: "jev-test",
      policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    const evidence = ((requests[0]?.state as { evidence?: Record<string, { text: string }> } | undefined)?.evidence) ?? {};
    return { refused: undefined, report, judgeRequests: requests.length, evidenceLens: Object.values(evidence).map((entry) => entry.text.length) };
  } catch (error) {
    if (error instanceof ModuleError) {
      return { refused: error.issues.join("\n"), report: undefined, judgeRequests: requests.length, evidenceLens: [] };
    }
    throw error;
  }
}

describe("core.union over an empty section list (#191)", () => {
  it("refuses a literal empty list at the call site and makes ZERO judge requests", async () => {
    const result = await run(moduleText(`${UNION_ORACLE}constraints:
  via-empty:
    forall: core.meta(D, kind, design)
    require: union_of(D, [])
    severity: error
`));
    expect(result.refused).toMatch(/union_of is asked over an empty section list/);
    // The assertion is the refusal BEFORE any judge call. A verdict class would not distinguish
    // this from the fabricated label the hole produces.
    expect(result.judgeRequests).toBe(0);
  });

  it("refuses the same empty list from every call site: a rule body, a negation, a qualified call", async () => {
    const fromRuleBody = await run(moduleText(`${UNION_ORACLE}rules:
  used(D): core.meta(D, kind, design), union_of(D, [])
constraints:
  via-rule:
    forall: used(D)
    require: core.meta(D, kind, design)
    severity: error
`));
    expect(fromRuleBody.refused).toMatch(/union_of is asked over an empty section list/);
    expect(fromRuleBody.judgeRequests).toBe(0);

    const fromNegation = await run(moduleText(`${UNION_ORACLE}rules:
  unused(D): core.meta(D, kind, design), not union_of(D, [])
constraints:
  via-negation:
    forall: unused(D)
    require: core.meta(D, kind, design)
    severity: error
`));
    expect(fromNegation.refused).toMatch(/union_of is asked over an empty section list/);
    expect(fromNegation.judgeRequests).toBe(0);

    const fromQualified = await run(moduleText(`${UNION_ORACLE}constraints:
  via-qualified:
    forall: core.meta(D, kind, design)
    require: t:union_of(D, [])
    severity: error
`));
    expect(fromQualified.refused).toMatch(/union_of is asked over an empty section list/);
    expect(fromQualified.judgeRequests).toBe(0);
  });

  it("still accepts a non-empty literal list, and binds its evidence", async () => {
    const result = await run(moduleText(`${UNION_ORACLE}constraints:
  via-listed:
    forall: core.meta(D, kind, design)
    require: union_of(D, ['problem-statement'])
    severity: error
`));
    expect(result.refused).toBeUndefined();
    expect(result.judgeRequests).toBeGreaterThan(0);
    // The refusal must be scoped to the EMPTY list: a non-empty literal still reaches the judge
    // with its section's text bound, so the guard cannot be passing by refusing every literal.
    expect(result.evidenceLens.every((length) => length > 0)).toBe(true);
  });

  it("refuses only the union's OWN section argument, not any empty list an oracle takes", async () => {
    // The guard is scoped to the argument index the union evidence form consumes. An oracle may
    // legitimately take an empty list elsewhere, so a rule keyed on "any oracle argument that is an
    // empty list" would forbid valid modules; this case reddens under that widening.
    const result = await run(moduleText(`oracles:
  union_of(D, L, X):
    ask: The union of the listed sections is coherent.
    evidence: core.union(D, L)
    threshold: 0
    max_bytes: 16000
constraints:
  via-other-arg:
    forall: core.meta(D, kind, design)
    require: union_of(D, ['problem-statement'], [])
    severity: error
`));
    expect(result.refused).toBeUndefined();
    expect(result.judgeRequests).toBeGreaterThan(0);
  });

  it("still accepts a variable list, so `core.present/3` (task #190) is untouched", async () => {
    // The present primitive binds `P` to the present members and hands the VARIABLE to the union
    // oracle. A refusal keyed on the term being a literal rather than on its emptiness would break
    // this route; this case reddens if the guard reaches through the variable.
    const result = await run(moduleText(`oracles:
  union_of(D, L):
    ask: The union of the listed sections is coherent.
    evidence: core.union(D, L)
    threshold: 0
    max_bytes: 16000
constraints:
  via-present:
    forall: core.meta(D, kind, design), present(D, ['problem-statement', 'scope'], P)
    require: union_of(D, P)
    severity: error
    population: nonempty
`));
    expect(result.refused).toBeUndefined();
    expect(result.judgeRequests).toBeGreaterThan(0);
  });
});
