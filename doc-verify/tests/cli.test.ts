import { execFileSync, spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("CLI", () => {
  it("prints stable section diagnostics", () => {
    const output = execFileSync("node", [
      "doc-verify/dist/cli.js", "segments",
      "design/02-programmatic-document-contract-verification.md", "--format", "text",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(output).toContain("problem-statement\t");
    expect(output).toContain("verification-design\t");
  });

  it("checks the current design and goal in draft mode", () => {
    const result = spawnSync("node", [
      "doc-verify/dist/cli.js", "check", "--paths",
      "design/02-programmatic-document-contract-verification.md",
      "goals/01-document-verification-and-skill-transfer.md",
      "--profile", "draft", "--format", "text",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS:");
  });
});
