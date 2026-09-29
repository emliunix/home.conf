// Design 04 §Rule syntax: the runtime's Prolog reader parses every body, then the
// checker rejects what would make evaluation unsafe, infinite or unexplainable.

import { describe, expect, it } from "vitest";

import { compileModule, ModuleError } from "../src/engine/index.js";
import { moduleText, PURPOSE_ORACLE } from "./engine-helpers.js";

async function issues(body: string, rounds = 1): Promise<string> {
  try {
    await compileModule(moduleText(body, rounds));
  } catch (error) {
    if (error instanceof ModuleError) {
      return error.issues.join("\n");
    }
    throw error;
  }
  return "";
}

const MENTIONS_ORACLE = `  mentions(D, S):
    ask: The section names an owner.
    evidence: core.body(D, S)
`;

describe("module loading", () => {
  it("accepts a well-formed module and reads its bodies with the runtime's reader", async () => {
    const program = await compileModule(moduleText(`params:
  classes: [problem, scope]
oracles:
${PURPOSE_ORACLE}rules:
  classed(D, S): core.section(D, S, _), purpose(D, S, P), P in $classes
  unclassed(D, S): core.section(D, S, _), not classed(D, S)
constraints:
  all-classed:
    forall: core.section(D, S, _)
    require: classed(D, S)
    severity: error
`));
    expect(program.rules.map((rule) => rule.predicate)).toEqual(["t::classed", "t::unclassed"]);
    expect(program.strata.get("t::unclassed")).toBeGreaterThan(program.strata.get("t::classed") ?? 0);
    expect(program.oracles[0]).toMatchObject({ predicate: "t::purpose", inputs: [0, 1], labels: ["problem", "scope", "rationale", "other"] });
    const membership = program.rules[0]?.body.at(-1);
    expect(membership).toMatchObject({ kind: "in", list: { kind: "compound", functor: "." } });
  });

  it("rejects a syntax error and names the text", async () => {
    expect(await issues(`rules:
  bad(D): core.section(D, P
`)).toMatch(/rules\.bad\(D\)\.body: syntax error/);
  });

  it("rejects an unknown param reference", async () => {
    expect(await issues(`rules:
  r(D, S): core.section(D, S, _), S in $nothing
`)).toMatch(/unknown param \$nothing/);
  });
});

describe("static checks", () => {
  it("rejects a predicate that is neither declared, imported nor built in", async () => {
    expect(await issues(`rules:
  r(D, S): core.section(D, S, _), elsewhere(D, S)
`)).toMatch(/t\.elsewhere\/2 is neither declared, imported, nor a built-in/);
    expect(await issues(`rules:
  r(D, S): core.sections(D, S, _)
`)).toMatch(/core\.sections\/3 is neither declared/);
  });

  it("rejects a wrong arity", async () => {
    expect(await issues(`rules:
  r(D, S): core.section(D, S)
`)).toMatch(/core\.section takes 3 arguments, not 2/);
  });

  it("rejects an oracle whose inputs are not bound by earlier positive literals", async () => {
    expect(await issues(`oracles:
${MENTIONS_ORACLE}rules:
  r(D, S): mentions(D, S), core.section(D, S, _)
`)).toMatch(/oracle mentions needs it bound/);
    expect(await issues(`oracles:
${PURPOSE_ORACLE}rules:
  r(D, S): core.section(D, S, _), purpose(D, _, S)
`)).toMatch(/anonymous input/);
  });

  it("allows an oracle's label to be bound by the oracle itself", async () => {
    expect(await issues(`oracles:
${PURPOSE_ORACLE}rules:
  r(D, S, P): core.section(D, S, _), purpose(D, S, P)
`)).toBe("");
  });

  it("rejects an unsafe variable in a head, a negation or a comparison", async () => {
    expect(await issues(`rules:
  r(D, X): core.section(D, _, _)
`)).toMatch(/X is unsafe/);
    expect(await issues(`rules:
  r(D): core.section(D, _, _), not core.child(D, Y, _)
`)).toMatch(/Y is unsafe/);
    expect(await issues(`rules:
  r(D): core.section(D, _, _), N > 2
`)).toMatch(/N is unsafe/);
  });

  it("rejects negation through a recursive cycle", async () => {
    expect(await issues(`rules:
  p(D, S): core.section(D, S, _), not q(D, S)
  q(D, S): core.section(D, S, _), not p(D, S)
`)).toMatch(/negation or count over/);
  });

  it("rejects an oracle inside a recursive cycle", async () => {
    expect(await issues(`oracles:
${MENTIONS_ORACLE}rules:
  reach(D, S): core.section(D, S, root)
  reach(D, C): reach(D, S), core.child(D, S, C), mentions(D, C)
`, 5)).toMatch(/oracle inside a recursive cycle/);
  });

  it("rejects an oracle deeper than rounds", async () => {
    const body = `oracles:
${PURPOSE_ORACLE}${MENTIONS_ORACLE}rules:
  scope_item(D, C): core.section(D, P, _), purpose(D, P, scope), core.child(D, P, C)
  noted(D, C): scope_item(D, C), mentions(D, C)
`;
    expect(await issues(body, 1)).toMatch(/depth 2 is deeper than rounds \(1\)/);
    expect(await issues(body, 2)).toBe("");
  });

  it("rejects a label constant the oracle cannot return, and a listed unknown", async () => {
    expect(await issues(`oracles:
${PURPOSE_ORACLE}rules:
  r(D, S): core.section(D, S, _), purpose(D, S, scoped)
`)).toMatch(/scoped is not a label of purpose/);
    expect(await issues(`oracles:
  purpose(D, S, P):
    choose: [problem, unknown]
    ask: What is this section for?
    evidence: core.own(D, S)
`)).toMatch(/the engine adds unknown/);
  });

  it("rejects a question placeholder that is not an input, and evidence over non-inputs", async () => {
    expect(await issues(`oracles:
  purpose(D, S, P):
    choose: [problem, other]
    ask: Is {P} right?
    evidence: core.own(D, S)
`)).toMatch(/\{P\} is not an input argument/);
    expect(await issues(`oracles:
  purpose(D, S, P):
    choose: [problem, other]
    ask: What is it?
    evidence: core.own(D, P)
`)).toMatch(/evidence is core\.own/);
  });

  it("rejects a constraint with both or neither of require and forbid", async () => {
    expect(await issues(`constraints:
  c:
    forall: core.section(D, S, _)
    severity: error
`)).toMatch(/exactly one of require or forbid/);
  });
});
