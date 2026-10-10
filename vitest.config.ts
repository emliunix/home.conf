import { defineConfig } from "vitest/config";

// Two tiers: the in-process logic suite, and a small CLI-subprocess suite that spawns the built
// CLI. Subprocess tests need a longer timeout than the 5 s default, so they are their own
// project and a slow spawn does not flake the logic tier.
const SUBPROCESS = [
  "doc-verify/tests/report/cli.test.ts",
  "doc-verify/tests/report/keyless.test.ts",
  "doc-verify/tests/selection/task61-selector-gate.test.ts",
  "doc-verify/tests/mutate/mutate.test.ts",
];

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["doc-verify/tests/**/*.test.ts"], exclude: SUBPROCESS } },
      { test: { name: "subprocess", include: SUBPROCESS, testTimeout: 30000 } },
    ],
  },
});
