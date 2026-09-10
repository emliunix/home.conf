import { describe, expect, it } from "vite-plus/test";

import {
  FROZEN_EVALUATION_CONTEXT,
  buildTier2CasePrompt,
  assertFrozenPromptLock,
  createFrozenPrompt,
  readFrozenPromptLock,
} from "../src/eval/prompt.ts";

describe("frozen evaluation prompt", () => {
  it("keeps the designated role, task, and skill order in a stable prefix", () => {
    const first = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
    const second = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);

    expect(first.hash).toBe(second.hash);
    expect(first.text).toContain("<tier_1_frozen_context>");
    expect(first.text).toContain("<role>Flow lifecycle evaluator</role>");
    expect(first.text).toContain("<task>Decide the single next flow action");
    expect(first.skillNames).toEqual(["flow-common", "flow-grill-review", "flow-retro"]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.skillNames)).toBe(true);
  });

  it("inlines the full skill bodies as the cacheable frozen prefix", () => {
    const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);

    expect(frozen.text).toContain('<skill name="flow-common" path="skills/flow-common/SKILL.md"');
    expect(frozen.text).toContain('<skill name="flow-grill-review" path="skills/flow-grill-review/SKILL.md"');
    expect(frozen.text).toContain('<skill name="flow-retro" path="skills/flow-retro/SKILL.md"');
    expect(frozen.text).toContain("# Flow: Common");
    expect(frozen.text).toContain("# Flow: Grill Review");
    expect(frozen.text).toContain("# Flow: Retro");
  });

  it("never mentions the deleted read_skill ritual", () => {
    const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);

    expect(frozen.text).not.toContain("read_skill");
    expect(frozen.text).toContain("submit_decision");
  });

  it("matches the checked-in lock so accidental prefix drift is visible", () => {
    const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);

    expect(assertFrozenPromptLock(frozen, readFrozenPromptLock())).toBe(true);
  });

  it("rejects a lock when a recorded prefix field drifts", () => {
    const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
    const lock = readFrozenPromptLock();

    expect(() => assertFrozenPromptLock(frozen, { ...lock, promptHash: "drifted" })).toThrow(
      "Frozen prompt lock drift detected",
    );
  });

  it("appends only the fixture and question after the frozen prefix", () => {
    const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
    const first = buildTier2CasePrompt("Fixture one", "Question one");
    const second = buildTier2CasePrompt("Fixture two", "Question two");

    expect(first.startsWith(frozen.text)).toBe(false);
    expect(second.startsWith(frozen.text)).toBe(false);
    expect(first).toContain("<tier_2_case_context>");
    expect(second).toContain("<tier_2_case_context>");
    expect(first).toContain("<fixture>Fixture one</fixture>");
    expect(first).toContain("<question>Question one</question>");
    expect(second).toContain("<fixture>Fixture two</fixture>");
    expect(second).toContain("<question>Question two</question>");
    expect(first).not.toContain("Question two");
    expect(second).not.toContain("Question one");
  });
});
