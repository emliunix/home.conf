// `core.present/3` (task #190): the candidate-set primitive that lets a v1 `scope: combined`
// rubric item become ONE oracle over the present members of a declared candidate list.
//
// v1's contract, from `rubric.ts`: `combined` unions *whichever listed sections exist*, dropping
// missing names silently. `core.union(D, L)` cannot express that — it requires every listed
// section to exist (`unionEvidence` returns undefined otherwise) — so a fixed-arity `forall`
// over an alternative-bearing list binds NOTHING, which is a vacuous no-op rather than a red.
//
// The seven semantics below are the task's acceptance cases, and each has a committed mutation
// that reddens it (see `doc-verify/tests/language/present.mutations.md`).

import { describe, expect, it } from "vitest";

import { DOC_PATH, moduleText, scriptedJudge } from "../engine-helpers.js";
import { runProgram, type EngineReport } from "../../src/engine/index.js";

type Report = EngineReport;

/** The document declares two of the three candidates: `scope` is absent. */
const TWO_OF_THREE = [
  "# Fixture",
  "",
  "## Problem statement",
  "",
  "Readers cannot find the owner.",
  "",
  "## Rationale",
  "",
  "One index beats three lists.",
  "",
].join("\n");

/** The unit fixture has no companion, so the kind is supplied here the way a rule would. */
const run = (moduleYaml: string, backend: Parameters<typeof runProgram>[0]["backend"], markdown?: string): Promise<EngineReport> =>
  runProgram({
    moduleYaml,
    documents: [{ path: DOC_PATH, markdown: markdown ?? TWO_OF_THREE, meta: { kind: "design" } }],
    backend,
    model: "jev-test",
    policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
  });

/** One v1-style `combined` item: the oracle over the present members, plus the presence guard. */
function combined(candidates: readonly string[]): string {
  const listed = `[${candidates.map((id) => `'${id}'`).join(", ")}]`;
  return moduleText(`oracles:
  combined_ok(D, L):
    ask: The union of the candidate sections is coherent.
    evidence: core.union(D, L)
    threshold: 0
    max_bytes: 16000
constraints:
  combined:
    forall: core.meta(D, kind, design), present(D, ${listed}, P)
    require: combined_ok(D, P)
    severity: error
    population: nonempty
    message: "{D} matches none of its declared candidate sections"
`);
}

const always = (): { value: string } => ({ value: "holds" });

/** The oracle atom text, which carries the BOUND `Present` list — the binding-set observable. */
function atoms(report: Report): string[] {
  return report.oracles.map((oracle) => oracle.atom);
}

/** The oracle atoms the round asked, with the sections each carried. */
function asked(report: Report): Array<{ sections: string[]; bytes: number }> {
  return report.oracles.map((oracle) => ({ sections: oracle.sections, bytes: oracle.bytes }));
}

function status(report: Report, id: string): string | undefined {
  return report.constraints.find((entry) => entry.id === id)?.status;
}

describe("core.present/3", () => {
  it("binds the present members in document order, ignoring candidate order", async () => {
    const { backend } = scriptedJudge(always);
    const forward = await run(combined(["problem-statement", "scope", "rationale"]), backend);
    const reversed = await run(combined(["rationale", "scope", "problem-statement"]), backend);
    expect(asked(forward)).toEqual([{ sections: ["problem-statement", "rationale"], bytes: expect.any(Number) as number }]);
    // Candidate order is irrelevant; document order is authoritative, so the two agree exactly.
    expect(asked(reversed)).toEqual(asked(forward));
  });

  it("binds Present in DOCUMENT order even when the candidate list is reversed", async () => {
    // The observable is the BOUND list in the atom, not `oracle.sections`: `unionEvidence` filters
    // `document.sections`, so it re-orders whatever it is given and cannot witness this property.
    // Candidates are reversed against the document, so a primitive that bound candidate order
    // passes the test above and fails here.
    const { backend } = scriptedJudge(always);
    const report = await run(combined(["rationale", "problem-statement"]), backend);
    expect(atoms(report)[0]).toContain("[problem-statement, rationale]");
  });

  it("omits a missing candidate rather than failing to bind", async () => {
    const { backend } = scriptedJudge(always);
    const report = await run(combined(["problem-statement", "scope", "rationale"]), backend);
    expect(status(report, "combined")).toBe("satisfied");
    expect(asked(report)[0]?.sections).toEqual(["problem-statement", "rationale"]);
  });

  it("feeds exactly one oracle for the item, preserving the combined judgement", async () => {
    const { backend, requests } = scriptedJudge(always);
    const report = await run(combined(["problem-statement", "scope", "rationale"]), backend);
    expect(asked(report)).toHaveLength(1);
    // One round, one request: the item is judged ONCE over the union, not once per section.
    expect(requests).toHaveLength(1);
  });

  it("reports a deterministic missing-coverage failure when no candidate is present, and asks nothing", async () => {
    const { backend, requests } = scriptedJudge(always);
    const report = await run(combined(["ns-alpha", "ns-beta"]), backend);
    expect(status(report, "combined")).toBe("violated");
    // Not a silent green and not an empty judge call: the failure is structural.
    expect(asked(report)).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it("keeps the round bounded for two- and six-member candidate lists", async () => {
    const { backend } = scriptedJudge(always);
    const two = await run(combined(["problem-statement", "rationale"]), backend);
    const six = await run(combined(["problem-statement", "scope", "rationale", "a", "b", "c"]), backend);
    expect(asked(two)[0]?.sections).toEqual(["problem-statement", "rationale"]);
    expect(asked(six)[0]?.sections).toEqual(["problem-statement", "rationale"]);
    // One request each, whatever the list length.
    expect(asked(two)).toHaveLength(1);
    expect(asked(six)).toHaveLength(1);
  });

  it("is bounded to the named document: another document's sections never bind", async () => {
    const { backend } = scriptedJudge(always);
    const report = await runProgram({
      moduleYaml: combined(["problem-statement", "rationale"]),
      documents: [
        { path: DOC_PATH, markdown: TWO_OF_THREE, meta: { kind: "design" } },
        { path: "design/08-other.md", markdown: "# Other\n\n## Decisions\n\nNone yet.\n", meta: { kind: "design" } },
      ],
      backend,
      model: "jev-test",
      policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    // Only ONE document is reported for this constraint, and it is the document that declares the
    // candidates; the second document's Present never receives the first document's sections.
    const rows = report.constraints.filter((constraint) => constraint.id === "combined");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("satisfied");
    expect(rows[0]?.bindings.every((binding) => (binding.values.D ?? "") === DOC_PATH)).toBe(true);
    expect(asked(report)).toHaveLength(1);
    expect(asked(report)[0]?.sections).toEqual(["problem-statement", "rationale"]);
  });
});

/** The static refusals (semantics 5 and 6): a malformed candidate list never evaluates. */
describe("core.present/3 static checks", () => {
  const runText = async (moduleYaml: string): Promise<string> => {
    const { backend } = scriptedJudge(always);
    try {
      await runProgram({
        moduleYaml,
        documents: [{ path: DOC_PATH, markdown: TWO_OF_THREE, meta: { kind: "design" } }],
        backend,
        model: "jev-test",
        policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
      });
      return "accepted";
    } catch (error) {
      return (error as Error).message;
    }
  };

  it("refuses a duplicate candidate", async () => {
    const message = await runText(combined(["rationale", "rationale"]));
    expect(message).toMatch(/listed twice/u);
  });

  it("refuses a non-list candidate argument", async () => {
    const message = await runText(moduleText(`constraints:
  c:
    forall: core.meta(D, kind, _)
    require: present(D, rationale, P)
    severity: error
    message: m
`));
    expect(message).toMatch(/list of section ids/u);
  });

  it("refuses an empty candidate list", async () => {
    const message = await runText(moduleText(`constraints:
  c:
    forall: core.meta(D, kind, _)
    require: present(D, [], P)
    severity: error
    message: m
`));
    expect(message).toMatch(/non-empty candidate list/u);
  });

  it("refuses a non-atom candidate", async () => {
    const message = await runText(moduleText(`constraints:
  c:
    forall: core.meta(D, kind, _)
    require: present(D, [1], P)
    severity: error
    message: m
`));
    expect(message).toMatch(/not a section id/u);
  });
});
