import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import type { SkillDocument, SkillName } from "./skill-loader.ts";
import { loadSkillDocuments } from "./skill-loader.ts";

export interface EvaluationContext {
  readonly role: string;
  readonly task: string;
  readonly skillNames: readonly SkillName[];
  readonly skills: readonly SkillDocument[];
}

export interface FrozenPrompt {
  readonly hash: string;
  readonly role: string;
  readonly task: string;
  readonly skillNames: readonly SkillName[];
  readonly skillHashes: readonly string[];
  readonly text: string;
}

export interface FrozenPromptLock {
  readonly version: number;
  readonly role: string;
  readonly task: string;
  readonly skillNames: readonly SkillName[];
  readonly skillHashes: readonly string[];
  readonly promptHash: string;
}

const SKILL_NAMES: readonly SkillName[] = ["flow-common", "flow-grill-review", "flow-retro"];

const loadedSkills = await loadSkillDocuments(SKILL_NAMES);

export const FROZEN_EVALUATION_CONTEXT: EvaluationContext = Object.freeze({
  role: "Flow lifecycle evaluator",
  task: "Call submit_decision with the single Decision the flow skills prescribe for the Tier 2 fixture.",
  skillNames: Object.freeze([...SKILL_NAMES]),
  skills: loadedSkills,
});

function skillHash(skill: SkillDocument): string {
  return createHash("sha256").update(skill.content).digest("hex");
}

export function createFrozenPrompt(context: EvaluationContext): FrozenPrompt {
  const text = [
    "<tier_1_frozen_context>",
    `<role>${context.role}</role>`,
    `<task>${context.task}</task>`,
    "<skills>",
    ...context.skills.map(
      (skill) =>
        `<skill name="${skill.name}" path="skills/${skill.name}/SKILL.md" sha256="${skillHash(skill)}">\n${skill.content}\n</skill>`,
    ),
    "</skills>",
    "<tier_1_agent_instructions>",
    "Treat Tier 1 as the governing context. Answer the Tier 2 case by calling submit_decision with the single Decision the flow skills prescribe. Do not claim to have performed actions that are not present in the fixture.",
    "</tier_1_agent_instructions>",
    "</tier_1_frozen_context>",
  ].join("\n");

  return Object.freeze({
    hash: createHash("sha256").update(text).digest("hex"),
    role: context.role,
    task: context.task,
    skillNames: Object.freeze([...context.skillNames]),
    skillHashes: Object.freeze(context.skills.map(skillHash)),
    text,
  });
}

export function buildTier2CasePrompt(fixture: string, question: string): string {
  return [
    "<tier_2_case_context>",
    `<fixture>${fixture.trim()}</fixture>`,
    `<question>${question.trim()}</question>`,
    "</tier_2_case_context>",
  ].join("\n");
}

const LOCK_PATH = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
  "frozen-prefix.lock.json",
);

export function readFrozenPromptLock(path = LOCK_PATH): FrozenPromptLock {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<FrozenPromptLock>;

  if (
    parsed.version !== 1 ||
    typeof parsed.role !== "string" ||
    typeof parsed.task !== "string" ||
    !Array.isArray(parsed.skillNames) ||
    !parsed.skillNames.every((name): name is SkillName => typeof name === "string") ||
    !Array.isArray(parsed.skillHashes) ||
    !parsed.skillHashes.every((hash): hash is string => typeof hash === "string") ||
    typeof parsed.promptHash !== "string"
  ) {
    throw new Error(`Invalid frozen prompt lock: ${path}`);
  }

  return Object.freeze({
    version: parsed.version,
    role: parsed.role,
    task: parsed.task,
    skillNames: Object.freeze([...parsed.skillNames]),
    skillHashes: Object.freeze([...parsed.skillHashes]),
    promptHash: parsed.promptHash,
  });
}

export function assertFrozenPromptLock(frozen: FrozenPrompt, lock: FrozenPromptLock): true {
  const expected = [
    ["version", 1, lock.version],
    ["role", frozen.role, lock.role],
    ["task", frozen.task, lock.task],
    ["skillNames", frozen.skillNames.join(","), lock.skillNames.join(",")],
    ["skillHashes", frozen.skillHashes.join(","), lock.skillHashes.join(",")],
    ["promptHash", frozen.hash, lock.promptHash],
  ] as const;

  const drift = expected
    .filter(([, current, recorded]) => current !== recorded)
    .map(
      ([field, current, recorded]) =>
        `${field}: current=${JSON.stringify(current)} recorded=${JSON.stringify(recorded)}`,
    );

  if (drift.length > 0) {
    throw new Error(`Frozen prompt lock drift detected in ${LOCK_PATH}\n${drift.join("\n")}`);
  }

  return true;
}
