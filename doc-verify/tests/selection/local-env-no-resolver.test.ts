/**
 * The arm where the runtime has no proxy resolver.
 *
 * It lives in its own file because `vi.mock` hoists to the top of a module: mocking `node:http` in
 * the main `local-env` suite would remove the resolver for every test in it, including the one that
 * proves routing works. The state is unreachable otherwise -- a builtin module export cannot be
 * deleted at runtime, so a test could not produce it without this.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("node:http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:http")>();
  return { ...actual, setGlobalProxyFromEnv: undefined };
});

import { loadDocVerifyEnv } from "../../src/local-env.js";

describe("a runtime without a proxy resolver", () => {
  it("names the reason instead of dialing the judge directly", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    writeFileSync(path.join(root, ".env.doc-verify"), "HTTPS_PROXY=http://proxy.invalid:1\n");
    const saved = new Map<string, string | undefined>();
    for (const name of ["HTTPS_PROXY", "HTTP_PROXY"]) {
      saved.set(name, process.env[name]);
      delete process.env[name];
    }
    try {
      // A configured route that cannot be applied must not look like no route at all: the judge
      // would fail with the same bare error a host without a proxy fails with.
      expect(() => loadDocVerifyEnv(root)).toThrow(/no proxy resolver/);
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });

  it("stays silent when no proxy is configured", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    writeFileSync(path.join(root, ".env.doc-verify"), "API_KEY=key\n");
    const saved = new Map<string, string | undefined>();
    for (const name of ["TYPESAFE_API_KEY", "HTTPS_PROXY", "HTTP_PROXY"]) {
      saved.set(name, process.env[name]);
      delete process.env[name];
    }
    try {
      expect(() => loadDocVerifyEnv(root)).not.toThrow();
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });
});
