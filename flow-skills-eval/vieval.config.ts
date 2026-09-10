import { defineConfig } from "vieval";

export default defineConfig({
  projects: [
    {
      name: "flow-skills-decisions",
      root: ".",
      include: ["evals/*.eval.ts"],
    },
  ],
});
