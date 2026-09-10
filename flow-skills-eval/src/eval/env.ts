import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vieval";

export interface ApiConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

/** smoke = L1 canonical cases only; full = all L1 triplets. L0 lint always runs in `vp test`. */
export type EvalProfile = "smoke" | "full";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envKeys = {
  apiKey: [
    "FLOW_SKILLS_EVAL_API_KEY",
    "API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "PROVIDER_API_KEY",
  ],
  baseUrl: [
    "FLOW_SKILLS_EVAL_API_BASE_URL",
    "API_BASE_URL",
    "ANTHROPIC_BASE_URL",
    "OPENAI_BASE_URL",
    "PROVIDER_BASE_URL",
  ],
  model: [
    "FLOW_SKILLS_EVAL_MODEL",
    "MODEL",
    "ANTHROPIC_MODEL",
    "OPENAI_MODEL",
    "PROVIDER_TEST_MODEL",
  ],
} as const;

/** The skills are consumed by Claude agents, so the eval grades against that family by default. */
export const DEFAULT_EVAL_MODEL = "claude-sonnet-4-5";

export function projectEnv(): Record<string, string> {
  return loadEnv("test", projectRoot, "") as Record<string, string>;
}

function firstEnv(env: Record<string, string>, names: readonly string[]): string | undefined {
  return names.map((name) => env[name]?.trim()).find((value): value is string => Boolean(value));
}

export function readApiConfig(env = projectEnv()): ApiConfig {
  const apiKey = firstEnv(env, envKeys.apiKey);
  const baseUrl = firstEnv(env, envKeys.baseUrl);
  const model = firstEnv(env, envKeys.model) ?? DEFAULT_EVAL_MODEL;

  if (!apiKey) throw new Error(`Missing API key in project .env. Set ${envKeys.apiKey[0]}.`);
  if (!baseUrl) throw new Error(`Missing API base URL in project .env. Set ${envKeys.baseUrl[0]}.`);

  return Object.freeze({ apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model });
}

export function readProfile(env: Record<string, string> = {}): EvalProfile {
  const raw = (
    env.FLOW_SKILLS_EVAL_PROFILE ?? process.env.FLOW_SKILLS_EVAL_PROFILE
  )?.trim();
  if (!raw) return "smoke";
  if (raw === "smoke" || raw === "full") return raw;
  throw new Error(`Unknown FLOW_SKILLS_EVAL_PROFILE ${JSON.stringify(raw)} (expected smoke|full)`);
}
