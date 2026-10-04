import YAML from "yaml";
import { z } from "zod";

import { documentSelectorTrace, resolveDocumentSelector } from "./selection.js";
import { RepoPath, TextBlob, UsageError, repoPath } from "./types.js";

const documentIncludeRuleSchema = z.object({
  pattern: z.string().min(1),
  exclude: z.literal(false).optional(),
  artifact_kind: z.string().min(1),
  /**
   * Design-04 verification modules, composed in order (later modules extend earlier ones; a name
   * defined twice is refused). Each is a repository path or an engine library `doc-verify:NAME`.
   */
  modules: z.array(z.string().min(1)).min(1),
  /** Where the document keeps its status for the `meta(D, status, W)` fact: a `## Status` section (default) or its title suffix. */
  status_from: z.enum(["section", "title"]).optional(),
  required_sections: z.array(z.string().min(1)).default([]),
}).strict();

const documentExcludeRuleSchema = z.object({
  pattern: z.string().min(1),
  exclude: z.literal(true),
}).strict();

const documentRuleSchema = z.union([
  documentIncludeRuleSchema,
  documentExcludeRuleSchema,
]);

const configSchema = z.object({
  schema_version: z.literal(1),
  kind: z.literal("document-verification"),
  documents: z.array(documentRuleSchema).min(1),
  invalidation_patterns: z.array(z.string().min(1)).default([]),
  judge: z.object({
    kind: z.literal("jev"),
    model: z.string().min(1),
    client_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    attestation_max_age_seconds: z.number().int().positive(),
  }).strict(),
  /**
   * Per-profile settings (design 04 §Modules and references). `cache: refresh` asks every oracle
   * again and rewrites its cache entry; `reuse` (the default) answers from the cache when it can.
   */
  profiles: z.object({
    draft: z.object({ cache: z.enum(["reuse", "refresh"]).optional() }).strict().optional(),
    promotion: z.object({ cache: z.enum(["reuse", "refresh"]).optional() }).strict().optional(),
  }).strict().optional(),
  policy: z.object({
    kind: z.literal("semantic-boundary"),
    version: z.number().int().positive(),
    max_evidence_bytes: z.number().int().positive(),
    forbidden_literals: z.array(z.string().min(1)).default([]),
  }).strict(),
}).strict();

export type DocVerifyConfig = z.infer<typeof configSchema>;
export type DocumentRule = z.infer<typeof documentRuleSchema>;
export type DocumentIncludeRule = z.infer<typeof documentIncludeRuleSchema>;

export function documentRuleFor(
  rules: readonly DocumentRule[],
  file: RepoPath,
): DocumentIncludeRule | undefined {
  const selected = resolveDocumentSelector(rules, file);
  return selected !== undefined && "artifact_kind" in selected ? selected : undefined;
}

export function documentTraceFor(
  rules: readonly DocumentRule[],
  file: RepoPath,
): ReturnType<typeof documentSelectorTrace> {
  return documentSelectorTrace(rules, file);
}

/** The README section a v1 consumer follows to move a rule onto modules. */
export const MIGRATION_HINT = "the v1 rubric reader was removed; replace `verification:` with `modules: [...]` " +
  "naming design-04 verification modules (repository paths or engine libraries such as doc-verify:design); " +
  "see \"Migrating from v1 rubrics\" in the doc-verify README";

export function parseConfig(blob: TextBlob): DocVerifyConfig {
  const value: unknown = YAML.parse(blob.content);
  refuseV1Rules(blob.path, value);
  const parsed = configSchema.safeParse(value);
  if (!parsed.success) {
    throw new UsageError(`invalid ${blob.path}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

function refuseV1Rules(file: string, value: unknown): void {
  const documents = (value as { documents?: unknown } | null)?.documents;
  if (!Array.isArray(documents)) {
    return;
  }
  const v1 = documents.flatMap((rule: unknown, index) => {
    if (rule === null || typeof rule !== "object" || !("verification" in rule)) {
      return [];
    }
    const pattern = (rule as { pattern?: unknown }).pattern;
    return [`documents[${String(index)}] (pattern ${JSON.stringify(typeof pattern === "string" ? pattern : "?")})`];
  });
  if (v1.length > 0) {
    throw new UsageError(`invalid ${file}: ${v1.join(", ")} ${v1.length === 1 ? "names" : "name"} a v1 \`verification:\` strategy; ${MIGRATION_HINT}`);
  }
}

const documentMetadataSchema = z.object({
  path: z.string().min(1),
  kind: z.string().min(1),
  status: z.string().min(1).optional(),
  depends_on: z.array(z.string().min(1)).optional(),
}).loose();

export const companionSchema = z.object({
  schema_version: z.literal(1),
  kind: z.literal("document-contract"),
  document: documentMetadataSchema,
  /**
   * A v1 strategy block. It is ignored: what verifies a document is its rule's `modules`. The
   * checker reports a `metadata.legacy-verification` warning so the dead block can be removed.
   */
  verification: z.unknown().optional(),
}).loose();

export interface CompanionMetadata {
  schema_version: 1;
  kind: "document-contract";
  document: {
    path: RepoPath;
    kind: string;
    status?: string;
    depends_on?: RepoPath[];
  };
  /** The companion still carries a v1 `verification:` block, which is ignored. */
  legacyVerification: boolean;
}

export function parseCompanion(blob: TextBlob): CompanionMetadata {
  let value: unknown;
  try {
    value = YAML.parse(blob.content);
  } catch {
    throw new UsageError(`invalid ${blob.path}: malformed YAML`);
  }
  const parsed = companionSchema.safeParse(value);
  if (!parsed.success) {
    throw new UsageError(`invalid ${blob.path}: ${z.prettifyError(parsed.error)}`);
  }
  const expectedDocument = blob.path.replace(/\.ya?ml$/i, ".md");
  if (parsed.data.document.path !== expectedDocument) {
    throw new UsageError(`invalid ${blob.path}: document.path must be ${expectedDocument}`);
  }
  const { depends_on: dependsOn } = parsed.data.document;
  return {
    schema_version: parsed.data.schema_version,
    kind: parsed.data.kind,
    legacyVerification: parsed.data.verification !== undefined,
    document: {
      path: repoPath(parsed.data.document.path),
      kind: parsed.data.document.kind,
      ...(parsed.data.document.status === undefined ? {} : { status: parsed.data.document.status }),
      ...(dependsOn === undefined ? {} : { depends_on: dependsOn.map(repoPath) }),
    },
  };
}
