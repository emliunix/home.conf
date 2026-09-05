import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { readApiConfig } from "../src/eval/env.ts";

describe("project .env API configuration", () => {
  it("reads the three FLOW_SKILLS_EVAL keys and refuses missing model", () => {
    expect(
      readApiConfig({
        FLOW_SKILLS_EVAL_API_BASE_URL: "https://provider.example/v1/",
        FLOW_SKILLS_EVAL_API_KEY: " local-key ",
        FLOW_SKILLS_EVAL_MODEL: "local-model",
      }),
    ).toEqual({
      apiKey: "local-key",
      baseUrl: "https://provider.example/v1",
      model: "local-model",
    });
  });

  it("fails when any of the three keys is absent", () => {
    expect(() =>
      readApiConfig({
        FLOW_SKILLS_EVAL_API_KEY: "key",
        FLOW_SKILLS_EVAL_MODEL: "model",
      }),
    ).toThrow("FLOW_SKILLS_EVAL_API_BASE_URL");
    expect(() =>
      readApiConfig({
        FLOW_SKILLS_EVAL_API_BASE_URL: "https://example/v1",
        FLOW_SKILLS_EVAL_API_KEY: "key",
      }),
    ).toThrow("FLOW_SKILLS_EVAL_MODEL");
  });

  it("does not read alias env names", () => {
    expect(() =>
      readApiConfig({
        API_KEY: "alias-key",
        OPENAI_API_KEY: "openai-key",
        FLOW_SKILLS_EVAL_API_BASE_URL: "https://example/v1",
        FLOW_SKILLS_EVAL_MODEL: "model",
      }),
    ).toThrow("FLOW_SKILLS_EVAL_API_KEY");
  });

  it("vieval.config.ts calls readApiConfig", () => {
    const path = resolve(fileURLToPath(new URL("..", import.meta.url)), "vieval.config.ts");
    expect(readFileSync(path, "utf8")).toContain("readApiConfig");
  });
});
