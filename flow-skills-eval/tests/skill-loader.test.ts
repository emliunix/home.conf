import { describe, expect, it } from "vite-plus/test";

import { FROZEN_EVALUATION_CONTEXT } from "../src/eval/prompt.ts";
import { decisionCases } from "../src/eval/qa.ts";
import { getSkillsRoot, loadSkillDocuments } from "../src/eval/skill-loader.ts";

describe("flow skill loader", () => {
  it("loads the checked-in flow skills in caller-specified order", async () => {
    const skills = await loadSkillDocuments(["flow-retro", "flow-common"]);

    expect(skills.map((skill) => skill.name)).toEqual(["flow-retro", "flow-common"]);
    expect(skills[0]?.path.startsWith(getSkillsRoot())).toBe(true);
    expect(skills[0]?.content).toContain("# Flow: Retro");
    expect(skills[1]?.content).toContain("# Flow: Common");
  });

  it("provides the designated context and DecisionCase corpus without an agent harness", () => {
    expect(FROZEN_EVALUATION_CONTEXT.role).toBe("Flow lifecycle evaluator");
    expect(FROZEN_EVALUATION_CONTEXT.task).toContain("submit_decision");
    expect(FROZEN_EVALUATION_CONTEXT.skills).toHaveLength(3);
    expect(decisionCases.length).toBeGreaterThanOrEqual(9);
    expect(
      decisionCases.every(
        (c) => c.fixture.length > 0 && c.question.length > 0 && c.cite.length > 0 && c.catches.length > 0,
      ),
    ).toBe(true);
  });

  it("normalizes line endings without changing the loaded skill body", async () => {
    const [skill] = await loadSkillDocuments(["flow-grill-review"]);

    expect(skill?.content).not.toContain("\r");
    expect(skill?.content).toContain("reviewer");
  });
});
