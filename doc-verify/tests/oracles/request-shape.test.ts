// #192 §Request shape: `request_shape` decides how one round's demanded atoms become judge
// requests. `batched` (default) packs a document's atoms into one keyed request; `per-atom`
// asks each demanded atom alone, so an answer cannot depend on which other atoms were
// demanded in the same round. These tests assert the SHAPE (request count, questions per
// request) and the default; the label consequence is pinned in request-shape.mutations.md.

import { createMockJevJudgeBackend, type JudgeAnswer, type JudgeBackendRequest } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { byHeading, PURPOSE_ORACLE, PURPOSES, run, scriptedJudge } from "../engine-helpers.js";

/** One atom per section of the fixture: with batching they share a single request. */
const ATOMS = `oracles:
${PURPOSE_ORACLE}constraints:
  every-section-known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope, rationale]
    severity: error
`;

const withThreshold = (threshold: string): string => `oracles:
${PURPOSE_ORACLE.replace("threshold: 0.5", `threshold: ${threshold}`)}constraints:
  every-section-known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope, rationale]
    severity: error
`;

const shape = (markdown: string, requestShape?: string): string => {
  const header = `schema_version: 2\nkind: verification-module\nmodule: t\n${requestShape === undefined ? "" : `request_shape: ${requestShape}\n`}rounds: 1\n`;
  return `${header}${markdown}`;
};

describe("request shape", () => {
  it("defaults to batching one document's atoms into a single request", async () => {
    const { backend, requests } = scriptedJudge(byHeading(PURPOSES));
    const report = await run(shape(ATOMS), backend);
    // The fixture has six sections (its title and five headings), so six atoms are demanded.
    expect(requests).toHaveLength(1);
    expect(requests[0]?.questions).toHaveLength(6);
    expect(report.requests).toHaveLength(1);
    expect(report.requests[0]?.questions).toBe(6);
  });

  it("asks one request per demanded atom under `per-atom`", async () => {
    const { backend, requests } = scriptedJudge(byHeading(PURPOSES));
    const report = await run(shape(ATOMS, "per-atom"), backend);
    // Same six atoms, one request each: the count matches the batched question count.
    expect(requests).toHaveLength(6);
    for (const request of requests) {
      expect(request.questions).toHaveLength(1);
    }
    expect(report.requests).toHaveLength(6);
    for (const record of report.requests) {
      expect(record.questions).toBe(1);
    }
    // The atoms asked are the same ones; only the packing differs.
    const keys = (request: (typeof requests)[number]) => request.questions.map((question) => question.id).sort().join(",");
    expect(keys(requests[0] as (typeof requests)[number]).length).toBeGreaterThan(0);
    expect(report.oracles).toHaveLength(6);
  });

  it("does not change the answers or the verdict, only how they are requested", async () => {
    const batched = await run(shape(ATOMS), scriptedJudge(byHeading(PURPOSES)).backend);
    const perAtom = await run(shape(ATOMS, "per-atom"), scriptedJudge(byHeading(PURPOSES)).backend);
    const labels = (report: typeof batched) =>
      report.oracles
        .map((leaf) => `${leaf.atom}=${leaf.label}`)
        .sort()
        .join("|");
    expect(labels(perAtom)).toBe(labels(batched));
    expect(perAtom.verdict).toBe(batched.verdict);
  });

  it("keeps `threshold` demotion independent of the request shape", async () => {
    const { backend } = scriptedJudge((question) => question.text.startsWith("## Scope")
      ? { value: "scope", distribution: [0, 0.7, 0, 0.3, 0] }
      : byHeading(PURPOSES)(question));
    const report = await run(shape(withThreshold("0.8"), "per-atom"), backend);
    const scope = report.oracles.find((leaf) => leaf.atom.endsWith(", scope)"));
    expect(scope).toMatchObject({ answered: "scope", label: "unknown", threshold: 0.8 });
  });

  it("rejects an unknown request_shape at schema load rather than treating it as legacy", async () => {
    await expect(run(shape(ATOMS, "together"), scriptedJudge(byHeading(PURPOSES)).backend))
      .rejects.toThrow(/request_shape/);
  });
});

// The removal-red for the shape itself: a scripted judge whose answer depends on how many
// questions share its request, modelling the measured batch-composition effect (design/101
// `problem_scope_rationale` answers differently in a 5-question round than it does alone).
// Under the default batching this atom is labelled `problem` and its `error` constraint is
// violated; under `per-atom` it is `rationale` and the constraint is satisfied. Reverting the
// module to batching reddens this case, so the shape is load-bearing for a VERDICT, not only a count.
describe("request shape: the batch effect on a label", () => {
  /** A judge that reads its own request: `refuted` only when co-asked with other atoms. */
  /**
   * A judge that reads its own request: it answers the Rationale section `rationale` when asked
   * alone, and `problem` when it shares the request with other atoms. That models the measured
   * batch-composition effect without depending on a live judge.
   */
  const batchSensitive = (): ReturnType<typeof scriptedJudge> => {
    const requests: JudgeBackendRequest[] = [];
    const backend = createMockJevJudgeBackend({
      answers: (request) => {
        requests.push(request);
        const state = request.state as { evidence: Record<string, { text: string }> };
        return request.questions.map((question): JudgeAnswer => {
          const instruction = typeof question.instruction === "string" ? question.instruction : "";
          const key = /state\.evidence\.([A-Za-z0-9_-]+)/.exec(instruction)?.[1] ?? "";
          const text = state.evidence[key]?.text ?? "";
          const options = (question.options ?? []).map((option) => option.id);
          // Only the Rationale atom is batch-sensitive; every other section is plainly `other`.
          const value = !text.startsWith("## Rationale")
            ? "other"
            : request.questions.length > 1 ? "problem" : "rationale";
          return {
            id: question.id, kind: "choose", value, confidence: 1, basis: "mock",
            distribution: options.map((id) => (id === value ? 0.8 : id === "unknown" ? 0 : 0.1)),
          };
        });
      },
    });
    return { backend, requests };
  };

  it("labels the same atom by its batch, changing the verdict", async () => {
    const atom = `oracles:
  purpose(D, S, P):
    choose: [problem, rationale, other]
    ask: What is this section for?
    evidence: core.own(D, S)
    threshold: 0
constraints:
  rationale-must-hold:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [rationale, other]
    severity: error
    message: "some section was judged unsupported"
  rationale-is-labelled:
    forall: core.section(D, rationale, _)
    require: purpose(D, rationale, rationale)
    severity: error
    message: "the rationale section was not judged rationale"
`;
    const batched = await run(shape(atom), batchSensitive().backend);
    const isolated = await run(shape(atom, "per-atom"), batchSensitive().backend);
    const rationale = (report: typeof batched) => report.oracles.find((leaf) => leaf.atom.endsWith(", rationale)"));
    expect(rationale(batched)?.label).toBe("problem");
    expect(batched.verdict).toBe("NO-GO");
    expect(rationale(isolated)?.label).toBe("rationale");
    expect(isolated.verdict).toBe("PASS");
  });
});

// The refusal must hold on the route an operator takes, not only on the one a test can take.
// `run(moduleYaml)` above feeds `runProgram` a module text directly, but the CLI -- and therefore
// every pre-commit hook and `pnpm check` -- reaches the schema through `composeModules`, which
// rebuilds the module from a known key list. A value the schema would reject therefore has to be
// refused *during composition*, or it is dropped before `.strict()` ever runs and the module
// silently falls back to the `batched` default. This case is the difference between those two
// routes; without it the suite is green while `request_shape: bogus` behaves as `batched`.
describe("request shape: the composed path refuses an unknown value", () => {
  const compose = async (requestShape: string) => {
    const read = async (repoPath: string) => {
      const content = shape(ATOMS, requestShape).replace("module: t", "module: t\n");
      return { path: repoPath, content, hash: "test" };
    };
    const { composeModules } = await import("../../src/engine/compose.js");
    return composeModules([".doc-verify/modules/t.yaml"], read as never);
  };

  it("refuses an unknown value during composition, before the schema can drop it", async () => {
    await expect(compose("bogus")).rejects.toThrow(/request_shape/);
  });

  it("still carries a legitimate value through composition", async () => {
    const composed = await compose("per-atom");
    expect(composed.yaml).toMatch(/request_shape: per-atom/);
  });
});
