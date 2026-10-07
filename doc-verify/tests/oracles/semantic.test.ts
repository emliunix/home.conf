// The judge boundary (design 04 "Trust boundary holds"): without a key the judge is BLOCKED and
// never faked, a failing judge is BLOCKED without echoing its response, and the pure evaluation
// program can reach neither a judge, an LLM, nor a tool.
import { createMockJevJudgeBackend } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { productionBackend } from "../../src/judge.js";
import { runProgram } from "../../src/engine/index.js";
import { assertRestrictedDml, runPureDml } from "../../src/engine/prolog.js";
import { BlockedError } from "../../src/types.js";
import { moduleText, PURPOSE_ORACLE, run } from "../engine-helpers.js";

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

describe("no judge (owner priority 1, 2026-10-05)", () => {
  const MIXED = moduleText(`oracles:
${PURPOSE_ORACLE}rules:
  top(D, S): core.section(D, S, _), core.depth(D, S, 2)
constraints:
  has-appendix:
    forall: core.section(D, _, root)
    require: top(D, S), core.heading(D, S, 'Appendix')
    severity: error
    message: "{D} has no Appendix"
  known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope, rationale]
    severity: error
`);

  it("decides a structural constraint with no backend, and reports a violated one as NO-GO", async () => {
    const report = await runProgram({
      moduleYaml: MIXED, documents: [{ path: "d.md", markdown: "# D\n\n## Problem\n\nP.\n" }],
      backend: undefined, unavailable: "TYPESAFE_API_KEY is unavailable", model: "jev-test",
      policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    expect(report.constraints.find((entry) => entry.id === "has-appendix")?.status).toBe("violated");
    expect(report.constraints.find((entry) => entry.id === "known")?.status).toBe("undetermined");
    expect(report.failure).toEqual({ verdict: "BLOCKED", message: "TYPESAFE_API_KEY is unavailable" });
    expect(report.verdict).toBe("NO-GO");
  });

  it("is BLOCKED, not NO-GO, when every structural constraint holds and an oracle is needed", async () => {
    const report = await runProgram({
      moduleYaml: MIXED, documents: [{ path: "d.md", markdown: "# D\n\n## Appendix\n\nA.\n" }],
      backend: undefined, unavailable: "TYPESAFE_API_KEY is unavailable", model: "jev-test",
      policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    expect(report.constraints.find((entry) => entry.id === "has-appendix")?.status).toBe("satisfied");
    expect(report.verdict).toBe("BLOCKED");
    expect(report.requests).toEqual([]);
  });
});
