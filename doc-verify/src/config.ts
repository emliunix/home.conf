import YAML from "yaml";
import { z } from "zod";

import { rubricBlockSchema } from "./rubric.js";
import { Profile, RepoPath, TextBlob, UsageError, repoPath } from "./types.js";

const documentRuleSchema = z.object({
  pattern: z.string().min(1),
  artifact_kind: z.string().min(1),
  verification: z.string().min(1),
  required_sections: z.array(z.string().min(1)).default([]),
}).strict();

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
  policy: z.object({
    kind: z.literal("semantic-boundary"),
    version: z.number().int().positive(),
    max_evidence_bytes: z.number().int().positive(),
    forbidden_literals: z.array(z.string().min(1)).default([]),
  }).strict(),
}).strict();

export type DocVerifyConfig = z.infer<typeof configSchema>;
export type DocumentRule = z.infer<typeof documentRuleSchema>;

export function parseConfig(blob: TextBlob): DocVerifyConfig {
  const parsed = configSchema.safeParse(YAML.parse(blob.content));
  if (!parsed.success) {
    throw new UsageError(`invalid ${blob.path}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function resolveProfile(input: {
  requested: Profile;
  configured: "draft" | "promotion";
  status?: string;
}): "draft" | "promotion" {
  if (input.requested !== "auto") {
    return input.requested;
  }
  if (input.status !== undefined) {
    return input.status.trim().toLowerCase() === "draft" ? "draft" : "promotion";
  }
  return input.configured;
}

const companionProfileSchema = z.object({
  rubric: z.string().min(1).optional(),
  sections: z.array(z.string().min(1)).min(1).optional(),
  cache: z.enum(["reuse", "refresh"]).optional(),
}).strict();

const strategyProfilesSchema = z.object({
  draft: companionProfileSchema.optional(),
  promotion: companionProfileSchema.optional(),
}).strict();

export const verificationStrategySchema = z.object({
  kind: z.literal("jev-prolog"),
  inherits: z.string().min(1).optional(),
  rubrics: rubricBlockSchema.optional(),
  default_profile: z.enum(["draft", "promotion"]).optional(),
  profiles: strategyProfilesSchema.optional(),
}).strict().refine((value) => value.inherits !== undefined || value.rubrics !== undefined, {
  message: "verification requires inherits or rubrics",
});

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
  verification: verificationStrategySchema,
}).loose();

export type CompanionProfile = z.infer<typeof companionProfileSchema>;
export type VerificationStrategy = z.infer<typeof verificationStrategySchema>;
export interface CompanionMetadata {
  schema_version: 1;
  kind: "document-contract";
  document: {
    path: RepoPath;
    kind: string;
    status?: string;
    depends_on?: RepoPath[];
  };
  verification: VerificationStrategy;
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
    verification: parsed.data.verification,
    document: {
      path: repoPath(parsed.data.document.path),
      kind: parsed.data.document.kind,
      ...(parsed.data.document.status === undefined ? {} : { status: parsed.data.document.status }),
      ...(dependsOn === undefined ? {} : { depends_on: dependsOn.map(repoPath) }),
    },
  };
}
