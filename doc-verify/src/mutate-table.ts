import { readFileSync } from "node:fs";

import YAML from "yaml";
import { z } from "zod";

import { UsageError } from "./types.js";

const rowSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["kill", "keep", "gap"]),
  expect: z.string().min(1).optional(),
  note: z.string().optional(),
  leg: z.enum(["judge"]).optional(),
  from: z.string().min(1).optional(),
  to: z.string().optional(),
  /** Drop this needle and everything after it. Must occur exactly once. */
  cut_from: z.string().min(1).optional(),
}).strict();

const tableSchema = z.object({
  schema_version: z.literal(1),
  kind: z.literal("mutation-table"),
  document: z.string().min(1),
  module: z.string().min(1),
  artifact_kind: z.string().min(1),
  /**
   * Authored lock of constraint ids. Compared to the engine-loaded live set, so a
   * constraint deleted from the module cannot drop out of the census silently.
   */
  constraints: z.array(z.string().min(1)).min(1),
  uncovered: z.record(z.string(), z.string().min(1)).default({}),
  rows: z.array(rowSchema).min(1),
}).strict();

export type MutationRow = z.infer<typeof rowSchema>;
export type MutationTable = z.infer<typeof tableSchema>;

export function loadMutationTable(path: string): MutationTable {
  let raw: unknown;
  try {
    raw = YAML.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new UsageError(`mutate table ${path}: ${(error as Error).message}`);
  }
  const parsed = tableSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new UsageError(`mutate table ${path}: ${first?.path.join(".") ?? "invalid"}: ${first?.message ?? "invalid"}`);
  }
  const ids = parsed.data.rows.map((row) => row.id);
  const duplicateId = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicateId !== undefined) {
    throw new UsageError(`mutate table ${path}: duplicate row id ${duplicateId}`);
  }
  const pin = parsed.data.constraints;
  const duplicatePin = pin.find((id, index) => pin.indexOf(id) !== index);
  if (duplicatePin !== undefined) {
    throw new UsageError(`mutate table ${path}: duplicate constraints: entry ${duplicatePin}`);
  }
  for (const row of parsed.data.rows) {
    if ((row.kind === "kill" || row.kind === "gap") && row.expect === undefined) {
      throw new UsageError(`mutate table ${path}: row ${row.id} (${row.kind}) needs expect:`);
    }
    const edits = [row.from !== undefined, row.cut_from !== undefined].filter(Boolean).length;
    if (edits !== 1) {
      throw new UsageError(`mutate table ${path}: row ${row.id} needs exactly one of from: or cut_from:`);
    }
    if (row.from !== undefined && row.to === undefined) {
      throw new UsageError(`mutate table ${path}: row ${row.id} has from: but no to:`);
    }
    if (row.cut_from !== undefined && row.to !== undefined) {
      throw new UsageError(`mutate table ${path}: row ${row.id} has cut_from: and to:; cut_from drops the needle and everything after it`);
    }
  }
  return parsed.data;
}

/** Constraint ids declared on the named module file itself, not its `extends` chain. */
export function ownConstraintIds(yamlText: string, label: string): string[] {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch (error) {
    throw new UsageError(`mutate ${label}: ${(error as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UsageError(`mutate ${label}: not a verification-module`);
  }
  const record = parsed as { kind?: unknown; constraints?: unknown };
  if (record.kind !== "verification-module") {
    throw new UsageError(`mutate ${label}: not a verification-module`);
  }
  if (record.constraints === undefined || record.constraints === null || typeof record.constraints !== "object" || Array.isArray(record.constraints)) {
    throw new UsageError(`mutate ${label}: has no constraints map`);
  }
  return Object.keys(record.constraints as Record<string, unknown>).sort();
}

export function occurrences(text: string, needle: string): number {
  let n = 0;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) n += 1;
  return n;
}

export type EditResult =
  | { ok: true; text: string }
  | { ok: false; detail: string };

export function applyEdit(base: string, row: MutationRow): EditResult {
  if (row.cut_from !== undefined) {
    const n = occurrences(base, row.cut_from);
    if (n !== 1) return { ok: false, detail: `cut_from found ${String(n)}x (need exactly 1)` };
    return { ok: true, text: base.slice(0, base.indexOf(row.cut_from)) };
  }
  const from = row.from ?? "";
  const n = occurrences(base, from);
  if (n !== 1) return { ok: false, detail: `anchor found ${String(n)}x (need exactly 1)` };
  return { ok: true, text: base.replace(from, row.to ?? "") };
}
