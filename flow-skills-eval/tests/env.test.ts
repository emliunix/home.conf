import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_EVAL_MODEL, readApiConfig, readProfile } from "../src/eval/env.ts";

describe("project .env API configuration", () => {
  it("reads the project-specific endpoint, key, and model without hardcoding values", () => {
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
      extraBody: {},
    });
  });

  it("accepts the Anthropic env names as fallbacks", () => {
    expect(
      readApiConfig({
        ANTHROPIC_BASE_URL: "https://anthropic.example/v1",
        ANTHROPIC_API_KEY: "anthropic-key",
        ANTHROPIC_MODEL: "claude-opus-4-1",
      }),
    ).toEqual({
      apiKey: "anthropic-key",
      baseUrl: "https://anthropic.example/v1",
      model: "claude-opus-4-1",
      extraBody: {},
    });
  });

  it("defaults to the Claude model family that consumes the skills", () => {
    const config = readApiConfig({
      FLOW_SKILLS_EVAL_API_BASE_URL: "https://provider.example/v1",
      FLOW_SKILLS_EVAL_API_KEY: "key",
    });

    expect(config.model).toBe(DEFAULT_EVAL_MODEL);
    expect(config.model).toContain("claude");
  });

  it("reads provider-specific request fields as a JSON object", () => {
    const config = readApiConfig({
      FLOW_SKILLS_EVAL_API_BASE_URL: "https://provider.example/v1",
      FLOW_SKILLS_EVAL_API_KEY: "key",
      FLOW_SKILLS_EVAL_EXTRA_BODY: '{"thinking":{"type":"disabled"}}',
    });

    expect(config.extraBody).toEqual({ thinking: { type: "disabled" } });
  });

  it("refuses extra request fields that are not a JSON object", () => {
    const base = { FLOW_SKILLS_EVAL_API_BASE_URL: "https://provider.example/v1", FLOW_SKILLS_EVAL_API_KEY: "key" };
    expect(() => readApiConfig({ ...base, FLOW_SKILLS_EVAL_EXTRA_BODY: "not json" })).toThrow("not valid JSON");
    expect(() => readApiConfig({ ...base, FLOW_SKILLS_EVAL_EXTRA_BODY: "[1]" })).toThrow("JSON object");
  });

  it("fails with a project .env hint when the endpoint is absent", () => {
    expect(() => readApiConfig({ FLOW_SKILLS_EVAL_API_KEY: "key" })).toThrow("project .env");
  });
});

describe("eval profile selection", () => {
  it("defaults to smoke and accepts explicit profile names", () => {
    expect(readProfile({})).toBe("smoke");
    expect(readProfile({ FLOW_SKILLS_EVAL_PROFILE: "smoke" })).toBe("smoke");
    expect(readProfile({ FLOW_SKILLS_EVAL_PROFILE: " full " })).toBe("full");
  });

  it("rejects unknown profile names", () => {
    expect(() => readProfile({ FLOW_SKILLS_EVAL_PROFILE: "nightly" })).toThrow("smoke|full");
  });
});
