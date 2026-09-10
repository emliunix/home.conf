import { describe, expect, it } from "vite-plus/test";

import { loadSkillDocuments } from "../src/eval/skill-loader.ts";

/**
 * L0 contract lint (design/01-fact-based-eval.md, ref-eval-design-guide.md):
 * cross-skill invariants asserted against the checked-in SKILL.md texts. Zero
 * model calls; runs in every `vp test`.
 */

const [common, grill, retro] = await loadSkillDocuments([
  "flow-common",
  "flow-grill-review",
  "flow-retro",
]);
const skills = [common, grill, retro] as const;

function frontmatter(content: string): string {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) throw new Error("skill is missing frontmatter");
  return match[1]!;
}

function body(content: string): string {
  return content.slice(frontmatter(content).length + 8);
}

const STATUS_WORDS = ["draft", "reviewed", "pending-retro", "landed"] as const;

describe("L0 contract lint: lifecycle status words", () => {
  it("flow-common's lifecycle table lists each status word exactly once with one owner", () => {
    const expectedOwners: Record<(typeof STATUS_WORDS)[number], string> = {
      draft: "drafter",
      reviewed: "flow-grill-review",
      "pending-retro": "implementation gate",
      landed: "flow-retro",
    };

    for (const word of STATUS_WORDS) {
      const row = new RegExp(`^\\| \`${word}\` \\|[^\\n]*$`, "m");
      const matches = common!.content.match(new RegExp(row.source, "gm")) ?? [];
      expect(matches, word).toHaveLength(1);
      expect(matches[0]!, word).toContain(expectedOwners[word]);
    }
  });

  it("each status word is set by exactly one gate across the skills", () => {
    // The review gate sets reviewed; the implementation gate (flow-common,
    // followed by flow-grill-review) sets pending-retro; flow-retro sets landed.
    expect(grill!.content).toContain("Set `Status: reviewed`");
    expect(common!.content).toContain("set `Status: pending-retro`");
    expect(retro!.content).toContain("set `Status: landed`");

    // No skill claims a status owned by another gate.
    expect(grill!.content).not.toMatch(/set `Status: landed`/i);
    expect(grill!.content).toContain("`Status: landed` belong to `flow-retro`");
    expect(retro!.content).not.toMatch(/set `Status: (draft|reviewed)`/i);
    // flow-grill-review's pending-retro mention delegates to flow-common's gate.
    expect(grill!.content).toMatch(
      /implementation gate[^.\n]*is `flow-common`'s[\s\S]*?setting `Status: pending-retro`/,
    );
  });
});

describe("L0 contract lint: write-target split", () => {
  it("write targets referenced by flow-common and flow-retro exist in flow-grill-review's section map", () => {
    // flow-common records the round count in the worklog and keeps the design
    // body canon; both targets must exist per flow-grill-review's split.
    expect(common!.content).toContain("worklog/NN-<same-topic>.md");
    expect(common!.content).toContain("design body stays canon");
    expect(grill!.content).toContain("Worklog `worklog/NN-<same-topic>.md`");
    expect(grill!.content).toContain("Design **Review**");
    expect(grill!.content).toContain("Design **Status**");

    // flow-retro's retro record targets the same worklog the section map owns.
    expect(retro!.content).toContain("worklog/NN-<same-topic>.md");
  });

  it("prose ledgers are banned from the design body on both sides of the split", () => {
    expect(grill!.content).toContain("Do not paste angles, findings, or defense into the design");
    expect(retro!.content).toContain("Do not paste retro prose into the design body");
  });
});

describe("L0 contract lint: dispatch phrases and skill mentions", () => {
  it("every dispatch phrase claimed in a body is mentioned by some frontmatter description", () => {
    const phrases = new Set<string>();
    for (const skill of skills) {
      for (const match of body(skill.content).matchAll(/flow:[a-z][a-z-]*/g)) {
        phrases.add(match[0]);
      }
    }

    expect(phrases.size).toBeGreaterThan(0);
    const descriptions = skills.map((skill) => frontmatter(skill.content)).join("\n");
    for (const phrase of phrases) {
      expect(descriptions, phrase).toContain(phrase);
    }
  });

  it("flow:impl is explicitly declared to imply no separate skill file", () => {
    expect(common!.content).toMatch(/flow:impl[\s\S]*?never implies a separate skill file/);
  });

  it("every composed or referenced skill mention resolves to a checked-in skill", async () => {
    // Status words and design-file name prefixes are not skill mentions.
    const nonSkillTokens = new Set(["pending-retro", "draft-followup", "goal-", "ref-"]);
    const mentions = new Set<string>();
    for (const skill of skills) {
      for (const match of skill.content.matchAll(/`([a-z][a-z-]+)`/g)) {
        const token = match[1]!;
        if (!nonSkillTokens.has(token) && token.includes("-")) mentions.add(token);
      }
    }

    const { readdir } = await import("node:fs/promises");
    const { getSkillsRoot } = await import("../src/eval/skill-loader.ts");
    const checkedIn = new Set(await readdir(getSkillsRoot()));
    for (const mention of mentions) {
      expect(checkedIn.has(mention), mention).toBe(true);
    }
  });

  it("frontmatter names match the skill directory names", () => {
    for (const skill of skills) {
      expect(frontmatter(skill.content)).toContain(`name: ${skill.name}`);
    }
  });
});
