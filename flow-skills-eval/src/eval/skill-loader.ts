import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillName = "flow-common" | "flow-grill-review" | "flow-retro";

export interface SkillDocument {
  readonly name: SkillName;
  readonly path: string;
  readonly content: string;
}

export function isSkillName(value: string): value is SkillName {
  return value === "flow-common" || value === "flow-grill-review" || value === "flow-retro";
}
const skillsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../skills");

/** Load the exact checked-in flow skill documents in the requested order. */
export async function loadSkillDocuments(
  names: readonly SkillName[],
): Promise<readonly SkillDocument[]> {
  const documents = await Promise.all(
    names.map(async (name) => {
      const path = resolve(skillsRoot, name, "SKILL.md");
      const content = (await readFile(path, "utf8")).replace(/\r\n/g, "\n").trimEnd();

      return Object.freeze({ name, path, content });
    }),
  );

  return Object.freeze(documents);
}

export function getSkillsRoot(): string {
  return skillsRoot;
}
