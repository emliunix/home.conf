import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vieval";

export interface ApiConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const KEY = {
  apiKey: "FLOW_SKILLS_EVAL_API_KEY",
  baseUrl: "FLOW_SKILLS_EVAL_API_BASE_URL",
  model: "FLOW_SKILLS_EVAL_MODEL",
} as const;

export function projectEnv(): Record<string, string> {
  return loadEnv("test", projectRoot, "") as Record<string, string>;
}

function requiredEnv(env: Record<string, string>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in project .env.`);
  return value;
}

export function readApiConfig(env = projectEnv()): ApiConfig {
  return Object.freeze({
    apiKey: requiredEnv(env, KEY.apiKey),
    baseUrl: requiredEnv(env, KEY.baseUrl).replace(/\/$/, ""),
    model: requiredEnv(env, KEY.model),
  });
}
