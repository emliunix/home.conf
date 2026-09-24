import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import { RepoPath, Section, SectionId, TextBlob, UsageError, repoPath, sectionId } from "./types.js";

export type SemanticAnswer = "supported" | "refuted" | "unknown";

const itemSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_.-]*$/),
  artifact_kinds: z.array(z.string().min(1)).min(1),
  applies_to: z.object({
    sections: z.array(z.string().min(1)).min(1),
    scope: z.enum(["each", "combined"]),
  }).strict(),
  evidence: z.object({
    source: z.literal("section_body"),
    max_bytes: z.number().int().positive(),
  }).strict(),
  question: z.object({
    kind: z.literal("choose"),
    instruction: z.string().min(1),
    options: z.tuple([
      z.literal("supported"),
      z.literal("refuted"),
      z.literal("unknown"),
    ]),
  }).strict(),
  critical: z.boolean(),
  weight: z.number().positive(),
  scores: z.object({
    supported: z.number().min(0).max(1),
    refuted: z.number().min(0).max(1),
    unknown: z.number().min(0).max(1),
  }).strict(),
}).strict();

export type RubricItem = z.infer<typeof itemSchema>;

export const rubricBlockSchema = z.object({
  kind: z.literal("jev"),
  inherits: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
  threshold: z.number().min(0).max(1).optional(),
  items: z.array(itemSchema).default([]),
}).strict();

const fileSchema = z.object({
  schema_version: z.literal(1),
}).loose();

export interface RubricSource {
  path: RepoPath;
  fragment: string;
  hash: string;
}

export interface ResolvedRubric {
  threshold: number;
  items: RubricItem[];
  chain: RubricSource[];
}

export interface ExpandedQuestion {
  id: string;
  item: RubricItem;
  sectionIds: SectionId[];
  evidence: string;
}

export type BlobReader = (path: RepoPath) => Promise<TextBlob>;

export async function resolveRubric(input: {
  root: string;
  reference: string;
  readBlob: BlobReader;
  declaringPath?: RepoPath;
}): Promise<ResolvedRubric> {
  return resolveRubrics({
    root: input.root,
    roots: [{
      reference: input.reference,
      ...(input.declaringPath === undefined ? {} : { declaringPath: input.declaringPath }),
    }],
    readBlob: input.readBlob,
  });
}

export async function resolveRubrics(input: {
  root: string;
  roots: Array<{ reference: string; declaringPath?: RepoPath }>;
  readBlob: BlobReader;
}): Promise<ResolvedRubric> {
  const active = new Set<string>();
  const seenIds = new Set<string>();
  const chain: RubricSource[] = [];
  const items: RubricItem[] = [];
  let threshold = 0;

  const walk = async (reference: string, declaringPath: RepoPath | undefined): Promise<void> => {
    const parsed = parseReference(input.root, reference, declaringPath);
    const key = `${parsed.path}#${parsed.fragment}`;
    if (active.has(key)) {
      throw new UsageError(`rubric inheritance cycle at ${key}`);
    }
    active.add(key);
    const blob = await input.readBlob(parsed.path);
    const document = fileSchema.parse(YAML.parse(blob.content));
    const block = rubricBlockSchema.parse(resolveFragment(document, parsed.fragment));
    const parents = block.inherits === undefined
      ? []
      : typeof block.inherits === "string"
        ? [block.inherits]
        : block.inherits;
    for (const parent of parents) {
      await walk(parent, parsed.path);
    }
    if (block.threshold !== undefined) {
      if (block.threshold < threshold) {
        throw new UsageError(`${key} lowers inherited threshold ${threshold}`);
      }
      threshold = block.threshold;
    }
    for (const item of block.items) {
      if (seenIds.has(item.id)) {
        throw new UsageError(`duplicate rubric item id: ${item.id}`);
      }
      seenIds.add(item.id);
      items.push(item);
    }
    chain.push({ path: parsed.path, fragment: parsed.fragment, hash: blob.hash });
    active.delete(key);
  };

  for (const root of input.roots) {
    await walk(root.reference, root.declaringPath);
  }
  if (items.length === 0) {
    throw new UsageError("resolved rubric has no items");
  }
  return { threshold, items, chain };
}

export function expandRubric(input: {
  rubric: ResolvedRubric;
  artifactKind: string;
  sections: Section[];
  selectedIds?: SectionId[];
}): ExpandedQuestion[] {
  const available = new Map(input.sections.map((section) => [section.id, section]));
  const explicit = input.selectedIds;
  const scope = explicit === undefined
    ? input.sections
    : explicit.map((id) => {
        const section = available.get(id);
        if (section === undefined) {
          throw new UsageError(`unknown section ${id}; valid sections: ${[...available.keys()].join(", ")}`);
        }
        return section;
      });
  const scopeIds = new Set(scope.map((section) => section.id));
  const expanded: ExpandedQuestion[] = [];

  for (const item of input.rubric.items) {
    if (!item.artifact_kinds.includes(input.artifactKind)) {
      continue;
    }
    const matched = item.applies_to.sections.includes("@selected")
      ? scope
      : item.applies_to.sections
          .map((id) => available.get(sectionId(id)))
          .filter((section): section is Section => section !== undefined)
          .filter((section) => scopeIds.has(section.id));
    if (matched.length === 0) {
      if (explicit === undefined && item.critical) {
        throw new MissingCriticalSectionError(item.id, item.applies_to.sections);
      }
      continue;
    }
    if (item.applies_to.scope === "each") {
      for (const section of matched) {
        expanded.push(makeQuestion(item, [section]));
      }
    } else {
      expanded.push(makeQuestion(item, matched));
    }
  }

  if (expanded.length === 0) {
    throw new UsageError("the selected sections have no applicable rubric item");
  }
  return expanded;
}

export class MissingCriticalSectionError extends Error {
  constructor(readonly itemId: string, readonly expectedSections: string[]) {
    super(`critical rubric item ${itemId} has no matching section`);
  }
}

function makeQuestion(item: RubricItem, sections: Section[]): ExpandedQuestion {
  const firstSection = sections[0];
  if (firstSection === undefined) {
    throw new UsageError(`rubric item ${item.id} has no evidence section`);
  }
  const evidence = sections.map((section) => section.content).join("\n");
  if (Buffer.byteLength(evidence) > item.evidence.max_bytes) {
    throw new EvidenceBudgetError(item.id, item.evidence.max_bytes);
  }
  return {
    id: item.applies_to.scope === "each" ? `${item.id}@${firstSection.id}` : item.id,
    item,
    sectionIds: sections.map((section) => section.id),
    evidence,
  };
}

export class EvidenceBudgetError extends Error {
  constructor(readonly itemId: string, readonly maxBytes: number) {
    super(`evidence for ${itemId} exceeds ${maxBytes} bytes`);
  }
}

function parseReference(root: string, reference: string, declaringPath: RepoPath | undefined): {
  path: RepoPath;
  fragment: string;
} {
  const hashIndex = reference.indexOf("#");
  if (hashIndex < 1 || hashIndex === reference.length - 1) {
    throw new UsageError(`rubric reference must be PATH#FRAGMENT: ${reference}`);
  }
  const filePart = reference.slice(0, hashIndex);
  const fragment = reference.slice(hashIndex + 1);
  if (path.isAbsolute(filePart)) {
    throw new UsageError(`absolute rubric path is not allowed: ${filePart}`);
  }
  const base = declaringPath === undefined ? "" : path.posix.dirname(declaringPath);
  const relative = path.posix.normalize(path.posix.join(base, filePart));
  if (relative === ".." || relative.startsWith("../")) {
    throw new UsageError(`rubric path escapes repository: ${reference}`);
  }
  const absolute = path.resolve(root, relative);
  const relativeCheck = path.relative(root, absolute);
  if (relativeCheck === ".." || relativeCheck.startsWith(`..${path.sep}`) || path.isAbsolute(relativeCheck)) {
    throw new UsageError(`rubric path escapes repository: ${reference}`);
  }
  return { path: repoPath(relative.split(path.sep).join(path.posix.sep)), fragment };
}

function resolveFragment(document: unknown, fragment: string): unknown {
  const rawParts = fragment.startsWith("/") ? fragment.slice(1).split("/") : [fragment];
  if (rawParts.some((part) => part.length === 0)) {
    throw new UsageError(`invalid rubric fragment: #${fragment}`);
  }
  let value = document;
  for (const rawPart of rawParts) {
    const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new UsageError(`rubric fragment is not a mapping path: #${fragment}`);
    }
    const record = z.record(z.string(), z.unknown()).parse(value);
    if (!(part in record)) {
      throw new UsageError(`rubric fragment does not exist: #${fragment}`);
    }
    value = record[part];
  }
  return value;
}
