// `matches(X, 'regex')`: a non-binding filter, like `in`. X must already be bound;
// the pattern is a quoted atom or string compiled once as a Unicode JS RegExp.
// Matching is unanchored. Unknown or undetermined X is undetermined, never satisfied.

import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { compileModule, ModuleError, runProgram, type EngineReport } from "../../src/engine/index.js";
import { runMutate } from "../../src/mutate.js";
import { DOC_PATH, moduleText, PURPOSE_ORACLE, run, scriptedJudge } from "../engine-helpers.js";

const MATCHES_TABLE = fileURLToPath(new URL("./matches.mutations.yaml", import.meta.url));

const PREFIX_DOC = [
  "# Matches fixture",
  "",
  "## work - planner",
  "",
  "A work body.",
  "",
  "### verification - compile",
  "",
  "A verification body.",
  "",
].join("\n");

const PREFIX_MODULE = moduleText(`rules:
  h2(D, S, H): core.heading(D, S, H), core.depth(D, S, 2)
  h3(D, S, H): core.heading(D, S, H), core.depth(D, S, 3)
constraints:
  work-prefix:
    forall: h2(D, S, H)
    require: matches(H, '^work - ')
    severity: error
  verification-prefix:
    forall: h3(D, S, H)
    require: matches(H, '^verification - ')
    severity: error
  ids-kebab:
    forall: core.section(D, S, _)
    require: not matches(S, '_')
    severity: error
  no-underscore-heading:
    forall: core.heading(D, S, H)
    forbid: matches(H, '_')
    severity: error
`);

function statuses(report: EngineReport): Record<string, string | undefined> {
  return Object.fromEntries(report.constraints.map((entry) => [entry.id, entry.status]));
}

function bindings(report: EngineReport, id: string): Record<string, string> {
  const constraint = report.constraints.find((entry) => entry.id === id);
  return Object.fromEntries((constraint?.bindings ?? []).map((binding) => [binding.values.S ?? binding.values.H ?? "", binding.status]));
}

async function issues(body: string): Promise<string> {
  try {
    await compileModule(moduleText(body));
  } catch (error) {
    if (error instanceof ModuleError) {
      return error.issues.join("\n");
    }
    throw error;
  }
  return "";
}

describe("matches/2 static checks", () => {
  it("accepts a bound item and compiles the pattern once as a u-flag RegExp", async () => {
    const program = await compileModule(moduleText(`rules:
  prefixed(D, S, H): core.heading(D, S, H), matches(H, '^work - ')
  kebab(D, S): core.section(D, S, _), not matches(S, '_')
`));
    const filter = program.rules[0]?.body.at(-1);
    expect(filter).toMatchObject({ kind: "matches", pattern: "^work - ", negated: false });
    expect(filter && filter.kind === "matches" ? filter.regex : undefined).toBeInstanceOf(RegExp);
    expect(filter && filter.kind === "matches" ? filter.regex.flags : "").toContain("u");
    const negated = program.rules[1]?.body.at(-1);
    expect(negated).toMatchObject({ kind: "matches", pattern: "_", negated: true });
  });

  it("rejects an unbound item, a non-literal pattern, and an invalid regex", async () => {
    expect(await issues(`rules:
  r(D): matches(X, 'a')
`)).toMatch(/X is unsafe/);
    expect(await issues(`rules:
  r(D, S): core.heading(D, S, H), matches(H, P)
`)).toMatch(/pattern of matches is a quoted atom or string/);
    expect(await issues(`rules:
  r(D, S): core.heading(D, S, H), matches(H, 12)
`)).toMatch(/pattern of matches is a quoted atom or string/);
    expect(await issues(`rules:
  r(D, S): core.heading(D, S, H), matches(H, '[')
`)).toMatch(/not a valid regular expression/);
  });

  it("lets not wrap matches, and still refuses not over in", async () => {
    expect(await issues(`rules:
  r(D, S): core.heading(D, S, H), not matches(H, '_')
`)).toBe("");
    expect(await issues(`rules:
  r(D, S): core.heading(D, S, H), not (H in [a])
`)).toMatch(/not applies to a predicate or matches/);
  });
});

describe("matches/2 heading prefixes and kebab ids", () => {
  it("holds for work and verification prefixes and kebab ids, and fails the other way", async () => {
    const { backend } = scriptedJudge(() => ({ value: "unknown" }));
    const good = await run(PREFIX_MODULE, backend, { markdown: PREFIX_DOC });
    expect(statuses(good)).toEqual({
      "work-prefix": "satisfied",
      "verification-prefix": "satisfied",
      "ids-kebab": "satisfied",
      "no-underscore-heading": "satisfied",
    });

    const workGone = await run(PREFIX_MODULE, backend, {
      markdown: PREFIX_DOC.replace("## work - planner", "## task - planner"),
    });
    expect(statuses(workGone)["work-prefix"]).toBe("violated");
    expect(statuses(workGone)["verification-prefix"]).toBe("satisfied");
    expect(statuses(workGone)["ids-kebab"]).toBe("satisfied");

    const verificationGone = await run(PREFIX_MODULE, backend, {
      markdown: PREFIX_DOC.replace("### verification - compile", "### check - compile"),
    });
    expect(statuses(verificationGone)["verification-prefix"]).toBe("violated");
    expect(statuses(verificationGone)["work-prefix"]).toBe("satisfied");

    const underscoreId = await run(PREFIX_MODULE, backend, {
      markdown: PREFIX_DOC.replace("## work - planner", "## work - agenvo_upgrade"),
    });
    expect(statuses(underscoreId)["work-prefix"]).toBe("satisfied");
    expect(statuses(underscoreId)["verification-prefix"]).toBe("satisfied");
    expect(statuses(underscoreId)["ids-kebab"]).toBe("violated");
    expect(statuses(underscoreId)["no-underscore-heading"]).toBe("violated");
  });

  it("is unanchored: a mid-string needle holds, and ^...$ is required for a full match", async () => {
    const { backend } = scriptedJudge(() => ({ value: "unknown" }));
    const module = moduleText(`constraints:
  contains-work:
    forall: core.heading(D, S, H), core.depth(D, S, 2)
    require: matches(H, 'work - ')
    severity: error
  starts-work:
    forall: core.heading(D, S, H), core.depth(D, S, 2)
    require: matches(H, '^work - ')
    severity: error
`);
    const rework = await run(module, backend, { markdown: "# Doc\n\n## rework - planner\n\nBody.\n" });
    expect(statuses(rework)).toEqual({ "contains-work": "satisfied", "starts-work": "violated" });
    const work = await run(module, backend, { markdown: "# Doc\n\n## work - planner\n\nBody.\n" });
    expect(statuses(work)).toEqual({ "contains-work": "satisfied", "starts-work": "satisfied" });
  });
});

describe("matches/2 three-valued behaviour", () => {
  it("never satisfies require or forbid over an unknown oracle label", async () => {
    const program = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  purpose-is-problem:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: purpose(D, S, P), matches(P, '^prob')
    severity: error
  purpose-not-problem:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    forbid: purpose(D, S, P), matches(P, '^prob')
    severity: error
`);
    const { backend } = scriptedJudge(() => ({ value: "unknown" }));
    const report = await run(program, backend);
    expect(new Set(Object.values(bindings(report, "purpose-is-problem")))).toEqual(new Set(["undetermined"]));
    expect(new Set(Object.values(bindings(report, "purpose-not-problem")))).toEqual(new Set(["undetermined"]));
    expect(report.constraints.find((entry) => entry.id === "purpose-is-problem")?.status).toBe("undetermined");
    expect(report.constraints.find((entry) => entry.id === "purpose-not-problem")?.status).toBe("undetermined");
  });

  it("reads a count interval as undetermined, never satisfied", async () => {
    const program = moduleText(`oracles:
  mentions(D, S):
    ask: The section names an owner.
    evidence: core.body(D, S)
constraints:
  count-digit:
    forall: core.section(D, T, root)
    require: "count(S, (core.section(D, S, _), mentions(D, S)), N), matches(N, '.')"
    severity: error
`);
    const unknown = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(unknown.constraints[0]?.status).toBe("undetermined");
    const holds = await run(program, scriptedJudge(() => ({ value: "holds" })).backend);
    expect(holds.constraints[0]?.status).toBe("satisfied");
    const fails = await run(program, scriptedJudge(() => ({ value: "fails" })).backend);
    expect(fails.constraints[0]?.status).toBe("satisfied");
  });

  it("does not treat a ground list's printed form as matchable text", async () => {
    const { backend } = scriptedJudge(() => ({ value: "holds" }));
    const report = await runProgram({
      moduleYaml: moduleText(`constraints:
  list-is-not-text:
    forall: core.meta(D, kind, design), present(D, ['problem-statement', 'rationale'], P)
    require: matches(P, 'rationale')
    severity: error
`),
      documents: [{
        path: DOC_PATH,
        markdown: "# Fixture\n\n## Problem statement\n\nA.\n\n## Rationale\n\nB.\n",
        meta: { kind: "design" },
      }],
      backend,
      model: "jev-test",
      policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    expect(report.constraints[0]?.status).toBe("violated");
  });
});

describe("matches/2 mutation table", () => {
  it("kills a prefix rename and an underscore id, and keeps a still-prefixed heading", async () => {
    const report = await runMutate(MATCHES_TABLE);
    expect(report.exitCode).toBe(0);
    expect(report.results.map((row) => `${row.id}:${row.status}`)).toEqual([
      "M1:RED", "M2:RED", "M3:RED", "K1:KEPT", "K2:KEPT",
    ]);
  });
});
