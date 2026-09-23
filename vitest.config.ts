import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["doc-verify/tests/**/*.test.ts"],
  },
});
