import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { buildRequestBody, runDecisionCase, runProvenance } from "../src/eval/agent.ts";
import type { ApiConfig } from "../src/eval/env.ts";
import { FROZEN_EVALUATION_CONTEXT, createFrozenPrompt } from "../src/eval/prompt.ts";

const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
const decisionCase = { fixture: "Fixture", question: "Question" };
const config: ApiConfig = Object.freeze({
  apiKey: "key",
  baseUrl: "https://provider.example/v1",
  model: "harness-model",
  extraBody: Object.freeze({
    thinking: { type: "disabled" },
    model: "override-model",
    temperature: 1,
    tool_choice: "auto",
  }),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decision request", () => {
  it("keeps extra fields but lets the harness's own fields win", () => {
    const body = buildRequestBody(frozen, decisionCase, config);

    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.model).toBe("harness-model");
    expect(body.temperature).toBe(0);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "submit_decision" } });
  });

  it("sends that body over fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "1",
                  type: "function",
                  function: {
                    name: "submit_decision",
                    arguments: JSON.stringify({
                      next_action: "run_retro",
                      status_to_set: "unchanged",
                      write_target: "worklog",
                      opens_new_design: false,
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runDecisionCase(frozen, decisionCase, config);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;

    expect(result.decision.next_action).toBe("run_retro");
    expect(sent.model).toBe("harness-model");
    expect(sent.temperature).toBe(0);
    expect(sent.thinking).toEqual({ type: "disabled" });
  });

  it("records the model and extra-body key names, never their values", () => {
    expect(runProvenance(config)).toEqual({
      model: "harness-model",
      extra_body_keys: "model,temperature,thinking,tool_choice",
    });
    expect(runProvenance({ ...config, extraBody: {} }).extra_body_keys).toBe("none");
  });
});
