import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import type { SkillDocument, SkillName } from "./skill-loader.ts";
import { isSkillName, loadSkillDocuments } from "./skill-loader.ts";

export interface EvaluationContext {
  readonly role: string;
  readonly task: string;
  readonly skillNames: readonly SkillName[];
  readonly skills: readonly SkillDocument[];
}

/** Tier 1: immutable, shared across every evaluation case. */
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

/**
 * The designated context is deliberately independent of a case fixture,
 * question, timestamp, or run matrix. Every decision case supplies a separate,
 * non-frozen Tier 2 context so providers can reuse the Tier 1 prefix cache
 * across repeated runs.
 */
export const FROZEN_EVALUATION_CONTEXT: EvaluationContext = Object.freeze({
  role: "Flow lifecycle evaluator",
  task: "Decide the single next flow action for one repo-state case and submit it as a structured decision.",
  skillNames: Object.freeze([...SKILL_NAMES]),
  skills: loadedSkills,
});

function skillHash(skill: SkillDocument): string {
  return createHash("sha256").update(skill.content).digest("hex");
}

/**
 * Tier 1 is deliberately independent of a case fixture, question, timestamp, or
 * run matrix. The full skill bodies are inlined here — they are the cacheable
 * frozen prefix — so each case costs exactly one API call and providers can
 * reuse the Tier 1 prefix cache across cases and runs.
 */
export function createFrozenPrompt(context: EvaluationContext): FrozenPrompt {
  const text = [
    "<tier_1_frozen_context>",
    `<role>${context.role}</role>`,
    `<task>${context.task}</task>`,
    "<skills>",
    "The full checked-in text of every flow skill follows. This is the complete governing contract for every Tier 2 case; you need no other files.",
    ...context.skills.flatMap((skill) => [
      `<skill name="${skill.name}" path="skills/${skill.name}/SKILL.md" sha256="${skillHash(skill)}">`,
      skill.content,
      `</skill>`,
    ]),
    "</skills>",
    "<tier_1_agent_instructions>",
    "Treat Tier 1 as the governing context. For each Tier 2 case, decide the single next flow action from the fixture and question, and answer only by calling the submit_decision tool. Do not narrate, do not ask for files, and do not claim actions that are not present in the Tier 2 fixture.",
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

/** Build Tier 2 only. It is intentionally not concatenated into Tier 1. */
export function buildTier2CasePrompt(fixture: string, question: string): string {
  return [
    "<tier_2_case_context>",
    "This is the non-frozen context for one decision evaluation case. Decide using Tier 1 and answer with the submit_decision tool.",
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
    !parsed.skillNames.every((name): name is SkillName => isSkillName(name)) ||
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
