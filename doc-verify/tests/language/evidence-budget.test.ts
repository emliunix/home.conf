// Task #196: the migrated v2 item caps must be calibrated for the v2 EVIDENCE SHAPE.
//
// WHY THIS CASE EXISTS. The v2 migration changed a `combined` item's evidence from v1's OWN prose
// (`ownSegments`; `rubric.ts` never read the declared `source`) to the FULL SECTION SUBTREE
// (`core.present/3` -> `unionEvidence` -> `section.content`). The caps came across unchanged, so the
// same number now bounds a larger text: measured over the governed corpus, over-cap item-INSTANCES
// went 1 -> 8, and a one-line edit to `docs/modules/runtime/README.md` was BLOCKed by the staged hook
// (`18,562 B > 16,000`) -- a live commit blocker whose message named the ITEM, not the uncalibrated cap.
//
// This is the ENGINE half of a two-layer red. The consumer half lives in `agent-substrate` and
// asserts the live document emits no `above max_bytes` finding through the pinned CLI; this half
// proves the ENGINE behaviour the cap depends on -- that a union over the boundary judges under it
// and BLOCKs over it -- so a regression is caught where the rule lives, without the consumer's repo.
//
// ⚠⚠ THE RULE BELOW WAS DERIVED FROM THE LANDED ENGINE, NOT FROM THE CARD, and the first draft of
// this file got it wrong in a way worth recording. `runProgram` CATCHES `BlockedError` and turns it
// into `report.failure` with `verdict: "BLOCKED"` (index.ts:80-86) -- it does not throw. A case that
// awaited a throw therefore read `blocked: undefined` on a genuinely blocked run and would have
// "passed" its `toBeDefined()` only if the engine had changed. The assertions below read the REPORT,
// which is what a consumer reads.
//
// Two engine limits fire before any judge request, so both rows are judge-independent and offline:
//   oracles.ts:149  evidence > oracle.max_bytes            -> `above max_bytes <n>`
//   oracles.ts:313  evidence > min(policy.maxEvidenceBytes, stateTokenBudget) -> `above the effective budget of <n>`
// `stateTokenBudget` is compared against BYTES despite its name (oracles.ts:306), which is why the
// calibration cannot simply raise the item cap without bound.

import { describe, expect, it } from "vitest";

import { DOC_PATH, moduleText, scriptedJudge } from "../engine-helpers.js";
import { runProgram, type EngineReport } from "../../src/engine/index.js";

/** A section body of exactly `bytes` bytes, so the cap is exercised at a chosen boundary. */
function bodyOf(bytes: number): string {
  const lead = "The section states the contract and its invariants. ";
  const filler = "x";
  return lead + filler.repeat(Math.max(0, bytes - lead.length - 1)) + "\n";
}

function documentWith(sectionBytes: number): string {
  return ["# Fixture", "", "## Problem statement", "", bodyOf(sectionBytes), ""].join("\n");
}

const CAP = 32_000;

/** An oracle whose evidence is the union over its present-set, with a chosen cap. */
const moduleYaml = (maxBytes: number): string =>
  moduleText(`oracles:
  problem_statement(D, L):
    ask: Does the design state one material problem?
    evidence: core.union(D, L)
    threshold: 0
    max_bytes: ${String(maxBytes)}
constraints:
  statements:
    forall: core.meta(D, kind, design), present(D, ['problem-statement'], P)
    require: problem_statement(D, P)
    severity: error
    population: nonempty
    profiles: [promotion]
    message: "{D} has no 'problem-statement' section"
`);

type Outcome = { report: EngineReport; failure: string | undefined; evidenceBytes: number };

async function run(markdown: string, maxBytes: number, policyCap = 48_000): Promise<Outcome> {
  const { backend, requests } = scriptedJudge(() => ({ value: "supported" }));
  const report = await runProgram({
    moduleYaml: moduleYaml(maxBytes),
    documents: [{ path: DOC_PATH, markdown, meta: { kind: "design" } }],
    backend,
    model: "jev-test",
    policy: { maxEvidenceBytes: policyCap, forbiddenLiterals: [] },
  });
  const state = (requests[0]?.state as { evidence?: Record<string, { text: string }> } | undefined)?.evidence ?? {};
  return { report, failure: report.failure?.message, evidenceBytes: Buffer.byteLength(Object.values(state)[0]?.text ?? "", "utf8") };
}

describe("the v2 item cap bounds the rendered union evidence (#196)", () => {
  it("judges a union just under the calibrated cap", async () => {
    // The observed governed maximum is 30,928 B (`design/124`), so a 30,000-byte section must be
    // JUDGED under the uniform 32,000 cap. This is the row the inherited 16,000 cap failed.
    const { report, failure, evidenceBytes } = await run(documentWith(30_000), CAP);
    expect(failure, failure).toBeUndefined();
    expect(report.verdict).not.toBe("BLOCKED");
    expect(report.requests.length).toBeGreaterThan(0);
    expect(evidenceBytes).toBeGreaterThan(29_000);
  });

  it("BLOCKs a union above the calibrated cap, naming max_bytes rather than the item", async () => {
    const { report, failure, evidenceBytes } = await run(documentWith(33_000), CAP);
    expect(report.verdict).toBe("BLOCKED");
    expect(failure).toContain("above max_bytes 32000");
    expect(report.requests).toHaveLength(0);
    expect(evidenceBytes).toBe(0);
  });

  it("still BLOCKs the same section under the OLD 16,000 cap: the removal-red", async () => {
    // ⚠⚠ THE REMOVAL-RED, AND IT IS THE POINT OF THE CARD. 30,000 B is a REAL governed size
    // (`design/124`'s verification-design measures 30,928 B) and under the inherited cap it is
    // BLOCKED. A case that only ever saw the calibrated cap cannot show the defect it fixes: this
    // row is what fails if someone restores 16,000, and it is deliberately identical to row 1 except
    // for the cap.
    const { report, failure } = await run(documentWith(30_000), 16_000);
    expect(report.verdict).toBe("BLOCKED");
    expect(failure).toContain("above max_bytes 16000");
  });

  it("keeps the cap BELOW the judge's state ceiling, so the cap is the binding rule", async () => {
    // ⚠⚠ THE BOUNDARY THE CARD REQUIRES RECORDED. The engine also compares the rendered state against
    // `min(policy.maxEvidenceBytes, stateTokenBudget)` and reports the tighter one. The cap must sit
    // at or below that ceiling, or a section can clear the item cap and still BLOCK under a message
    // naming the JUDGE instead of the corpus -- a blocker whose text does not point at the cap at all.
    // Raising the item cap to 48,000 here therefore changes the FAILURE, not the verdict: the same
    // 33,000-byte section blocks, and the message names the state budget. That is why the calibration
    // is a CAP DERIVATION, not "raise the number".
    const { report, failure } = await run(documentWith(33_000), 48_000, 48_000);
    expect(report.verdict).toBe("BLOCKED");
    expect(failure).toContain("above the effective budget of 32000");
    expect(failure).toContain("state budget 32000");
  });
});
