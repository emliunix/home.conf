import YAML from "yaml";
import { z } from "zod";

import { Profile, RepoPath, TextBlob, UsageError } from "./types.js";

const documentRuleSchema = z.object({
  pattern: z.string().min(1),
  artifact_kind: z.string().min(1),
  rubric: z.string().min(1),
  required_sections: z.array(z.string().min(1)).default([]),
  semantic_profile: z.enum(["draft", "promotion"]),
});

const configSchema = z.object({
  schema_version: z.literal(1),
  documents: z.array(documentRuleSchema).min(1),
  invalidation_patterns: z.array(z.string().min(1)).default([]),
  judge: z.object({
    model: z.string().min(1),
    client_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    attestation_max_age_seconds: z.number().int().positive(),
  }),
  policy: z.object({
    version: z.number().int().positive(),
    max_evidence_bytes: z.number().int().positive(),
    forbidden_literals: z.array(z.string().min(1)).default([]),
  }),
});

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

export interface CompanionMetadata {
  rubrics?: { inherits: string };
  depends_on?: RepoPath[];
}

const companionSchema = z.object({
  rubrics: z.object({ inherits: z.string().min(1) }).optional(),
  depends_on: z.array(z.string().min(1)).optional(),
}).loose();

export function parseCompanion(blob: TextBlob): CompanionMetadata {
  const parsed = companionSchema.safeParse(YAML.parse(blob.content));
  if (!parsed.success) {
    throw new UsageError(`invalid ${blob.path}: ${z.prettifyError(parsed.error)}`);
  }
  const dependsOn = parsed.data.depends_on;
  return {
    ...(parsed.data.rubrics === undefined ? {} : { rubrics: parsed.data.rubrics }),
    ...(dependsOn === undefined ? {} : { depends_on: dependsOn as RepoPath[] }),
  };
}
