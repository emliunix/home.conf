import { describe, expect, it } from "vite-plus/test";

import { loadSkillDocuments } from "../src/eval/skill-loader.ts";

describe("L0 contract lint", () => {
  it("write-target sections named by flow-common exist in flow-grill-review's design/worklog split", async () => {
    const [common, grill] = await loadSkillDocuments(["flow-common", "flow-grill-review"]);
    expect(common?.content).toContain("worklog/NN-<same-topic>.md");
    expect(grill?.content).toContain("worklog/NN-<same-topic>.md");
    expect(grill?.content).toContain("Design **Review**");
    expect(grill?.content).toContain("Design **Status**");
  });

  it("each lifecycle word is set by exactly one owner in flow-common's table", async () => {
    const [common, grill, retro] = await loadSkillDocuments([
      "flow-common",
      "flow-grill-review",
      "flow-retro",
    ]);
    const table = common?.content.split("## Lifecycle")[1]?.split("## Roles")[0] ?? "";
    const owners = {
      draft: [...table.matchAll(/\|\s*`draft`\s*\|[^|]*\|\s*([^|]+)\|/g)].map((m) => m[1]?.trim()),
      reviewed: [...table.matchAll(/\|\s*`reviewed`\s*\|[^|]*\|\s*([^|]+)\|/g)].map((m) =>
        m[1]?.trim(),
      ),
      "pending-retro": [...table.matchAll(/\|\s*`pending-retro`\s*\|[^|]*\|\s*([^|]+)\|/g)].map((m) =>
        m[1]?.trim(),
      ),
      landed: [...table.matchAll(/\|\s*`landed`\s*\|[^|]*\|\s*([^|]+)\|/g)].map((m) => m[1]?.trim()),
    };

    expect(owners.draft).toEqual(["drafter"]);
    expect(owners.reviewed).toEqual(["`flow-grill-review` (review gate)"]);
    expect(owners["pending-retro"]).toEqual(["the implementation gate (this skill)"]);
    expect(owners.landed).toEqual(["`flow-retro` (closing pass)"]);

    expect(grill?.content).toContain("Set `Status: reviewed`");
    expect(common?.content).toContain("set `Status: pending-retro`");
    expect(retro?.content).toContain("set `Status: landed`");
  });
});
