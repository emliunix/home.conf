import { defineConfig } from "vieval";

export default defineConfig({
  projects: [
    {
      name: "flow-skills-decisions",
      root: ".",
      include: ["evals/*.eval.ts"],
      // The eval makes its own provider calls (src/eval/agent.ts, configured from .env);
      // vieval only executes a project that declares at least one model, so this entry
      // is the execution slot, not a second model configuration.
      inferenceExecutors: [{ id: "flow-skills-env" }],
      models: [
        {
          aliases: ["flow-skills-env"],
          id: "flow-skills-env:from-env",
          inferenceExecutor: "flow-skills-env",
          inferenceExecutorId: "flow-skills-env",
          model: "from-env",
        },
      ],
    },
  ],
});
