import { describe, expect, it } from "vite-plus/test";

import {
  FROZEN_EVALUATION_CONTEXT,
  buildTier2CasePrompt,
  assertFrozenPromptLock,
  createFrozenPrompt,
  readFrozenPromptLock,
} from "../src/eval/prompt.ts";

describe("frozen evaluation prompt", () => {
  it("inlines skill bodies in a stable prefix", () => {
    const first = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
    const second = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);

    expect(first.hash).toBe(second.hash);
    expect(first.text).toContain("<tier_1_frozen_context>");
    expect(first.text).toContain("<role>Flow lifecycle evaluator</role>");
    expect(first.text).toContain("submit_decision");
    expect(first.text).toContain("# Flow: Common");
    expect(first.text).toContain("# Flow: Grill Review");
    expect(first.text).toContain("# Flow: Retro");
    expect(first.skillNames).toEqual(["flow-common", "flow-grill-review", "flow-retro"]);
    expect(Object.isFrozen(first)).toBe(true);
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

  it("puts fixture and question only in Tier 2", () => {
    const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
    const first = buildTier2CasePrompt("fixture A", "Question one");
    const second = buildTier2CasePrompt("fixture B", "Question two");

    expect(first.startsWith(frozen.text)).toBe(false);
    expect(first).toContain("<fixture>fixture A</fixture>");
    expect(first).toContain("<question>Question one</question>");
    expect(second).toContain("<question>Question two</question>");
    expect(first).not.toContain("Question two");
  });
});
