// Outbound policy: a local-only canary or a generic secret pattern in the evidence stops the
// round before the adapter sees anything, and the verdict is NO-GO.
import { createMockJevJudgeBackend } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { DOC, moduleText, PURPOSE_ORACLE, run } from "../engine-helpers.js";

const ASKS = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope, rationale]
    severity: error
`);

describe("confidentiality policy", () => {
  it.each([
    ["a configured local-only canary", `${DOC}\nLOCAL-ONLY-CANARY\n`, ["local-only-canary"]],
    ["a generic credential pattern", `${DOC}\nTYPESAFE_API_KEY=abc\n`, []],
    ["a home-directory path", `${DOC}\nsee /Users/someone/notes\n`, []],
  ])("keeps %s outside the adapter", async (_name, markdown, forbiddenLiterals) => {
    let captured = "";
    const backend = createMockJevJudgeBackend({
      answers: (request) => {
        captured = JSON.stringify(request);
        return [];
      },
    });
    const report = await run(ASKS, backend, { markdown, policy: { maxEvidenceBytes: 20_000, forbiddenLiterals } });
    expect(report.verdict).toBe("NO-GO");
    expect(report.failure?.message).toBe("semantic evidence contains prohibited data");
    expect(captured).toBe("");
  });
});
