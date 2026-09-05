import { defineConfig } from "vieval";
import { ChatModels, chatModelFrom } from "vieval/plugins/chat-models";

import { projectEnv, readApiConfig } from "./src/eval/env.ts";

const env = projectEnv();
const api = () => readApiConfig(env);

export default defineConfig({
  env,
  plugins: [
    ChatModels({
      models: [
        chatModelFrom({
          aliases: ["flow-agent"],
          apiKey: () => api().apiKey,
          baseURL: () => api().baseUrl,
          inferenceExecutor: "openai",
          get model() {
            return api().model;
          },
        }),
      ],
    }),
  ],
  projects: [
    {
      name: "flow-skills-qa",
      root: ".",
      include: ["evals/*.eval.ts"],
      runMatrix: {
        override: {
          model: ["flow-agent"],
        },
      },
    },
  ],
});
