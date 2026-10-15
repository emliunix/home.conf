// A constraint places its finding at a document line only when it says which forall variable holds
// that line (`line: Var`). A variable that merely happens to be named `Line` moves nothing; a
// `line:` naming a variable the forall does not bind is refused when the module loads.

import { describe, expect, it } from "vitest";

import { compileModule, ModuleError } from "../../src/engine/index.js";
import { moduleText, run, scriptedJudge } from "../engine-helpers.js";

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

/** Every section violates it; `core.order/3`'s third argument stands in for a line number. */
const constraint = (extra: string): string => `constraints:
  placed:
    forall: core.order(D, S, Line)
    forbid: core.section(D, S, _)
    severity: error
${extra}`;

describe("a constraint's finding line", () => {
  it("is the value of the forall variable that `line:` names", async () => {
    const { backend } = scriptedJudge(() => ({ value: "other" }));
    const report = await run(moduleText(constraint("    line: Line\n")), backend);
    const bindings = report.constraints.find((entry) => entry.id === "placed")?.bindings ?? [];
    expect(bindings.length).toBeGreaterThan(0);
    for (const binding of bindings) {
      expect(binding.line).toBe(Number(binding.values.Line));
    }
  });

  it("is unset when the constraint names no `line:`, whatever its variables are called", async () => {
    const { backend } = scriptedJudge(() => ({ value: "other" }));
    const report = await run(moduleText(constraint("")), backend);
    const bindings = report.constraints.find((entry) => entry.id === "placed")?.bindings ?? [];
    expect(bindings.length).toBeGreaterThan(0);
    expect(bindings.every((binding) => binding.line === undefined)).toBe(true);
  });

  it("refuses a `line:` that names no binding variable of the forall", async () => {
    expect(await issues(constraint("    line: Where\n"))).toMatch(/constraints\.placed\.line: Where is not a binding variable of the forall/);
  });
});
