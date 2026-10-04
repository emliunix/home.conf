// The judge boundary (design 04 "Trust boundary holds"): without a key the judge is BLOCKED and
// never faked, a failing judge is BLOCKED without echoing its response, and the pure evaluation
// program can reach neither a judge, an LLM, nor a tool.
import { createMockJevJudgeBackend } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { productionBackend } from "../src/judge.js";
import { assertRestrictedDml, runPureDml } from "../src/engine/prolog.js";
import { BlockedError } from "../src/types.js";
import { moduleText, PURPOSE_ORACLE, run } from "./engine-helpers.js";

const ASKS = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope, rationale]
    severity: error
`);

describe("semantic boundary", () => {
  it("blocks an unavailable required judge instead of faking one", () => {
    const previous = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      expect(() => productionBackend("jev-1.13.0")).toThrow(BlockedError);
    } finally {
      if (previous !== undefined) {
        process.env.TYPESAFE_API_KEY = previous;
      }
    }
  });

  it("blocks a failing judge request without echoing the provider's response", async () => {
    const backend = createMockJevJudgeBackend({ answers: () => Promise.reject(new Error("secret response body")) });
    const report = await run(ASKS, backend);
    expect(report.verdict).toBe("BLOCKED");
    expect(report.failure?.message).toMatch(/judge request for round 1 failed/);
    expect(JSON.stringify(report)).not.toContain("secret response body");
  });

  it("refuses an evaluation program that names a capability beyond pure Prolog", async () => {
    expect(() => assertRestrictedDml('agent_main :- task("escape", X).')).toThrow("prohibited");
    expect(() => assertRestrictedDml('agent_main :- answer("task( is only text here").')).not.toThrow();
    await expect(runPureDml('agent_main :- with_judgment(jev, judge("{}", [])), answer(ok).')).rejects.toThrow(BlockedError);
  });
});
