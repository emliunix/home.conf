import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

import { checkDocuments } from "../../src/checker.js";
import {
  loadDocVerifyEnv,
  resolveDocVerifyEnvPath,
} from "../../src/local-env.js";
import { BlockedError } from "../../src/types.js";

describe("local credential file", () => {
  it("reads API_KEY from a symlinked .env.doc-verify and ignores every other name", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    const target = path.join(root, "env-jev");
    writeFileSync(target, "API_KEY='quoted-key'\nOTHER_SECRET=nope\n# API_KEY=commented\nexport UNRELATED=1\n");
    symlinkSync(target, path.join(root, ".env.doc-verify"));
    const previous = process.env.TYPESAFE_API_KEY;
    const previousOther = process.env.OTHER_SECRET;
    const previousApi = process.env.API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OTHER_SECRET;
    process.env.API_KEY = "process-wide-key";
    try {
      loadDocVerifyEnv(root);
      expect(process.env.TYPESAFE_API_KEY).toBe("quoted-key");
      expect(process.env.OTHER_SECRET).toBeUndefined();
      expect(process.env.API_KEY).toBe("process-wide-key");
    } finally {
      restore("TYPESAFE_API_KEY", previous);
      restore("OTHER_SECRET", previousOther);
      restore("API_KEY", previousApi);
    }
  });

  it("keeps an explicit TYPESAFE_API_KEY and treats a missing file as no credential", () => {
    const present = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    const absent = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    const previous = process.env.TYPESAFE_API_KEY;
    process.env.TYPESAFE_API_KEY = "already-set";
    try {
      writeFileSync(path.join(present, ".env.doc-verify"), "API_KEY=from-file\n");
      loadDocVerifyEnv(present);
      expect(process.env.TYPESAFE_API_KEY).toBe("already-set");
      delete process.env.TYPESAFE_API_KEY;
      loadDocVerifyEnv(absent);
      expect(process.env.TYPESAFE_API_KEY).toBeUndefined();
    } finally {
      restore("TYPESAFE_API_KEY", previous);
    }
  });

  it("reports an unreadable file without including its surrounding names", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    mkdirSync(path.join(root, ".env.doc-verify"));
    const previous = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      expect(() => loadDocVerifyEnv(root)).toThrow(BlockedError);
      try {
        loadDocVerifyEnv(root);
      } catch (error) {
        expect(error).toBeInstanceOf(BlockedError);
        expect((error as Error).message).toBe("cannot read .env.doc-verify (EISDIR)");
        expect((error as Error).message).not.toContain(root);
      }
    } finally {
      restore("TYPESAFE_API_KEY", previous);
    }
  });

  it("routes through a proxy the file names, and leaves routing alone when it names none", async () => {
    // In a child process, and that is not tidiness: the resolver installs a PROCESS-WIDE
    // dispatcher and offers no way to uninstall it through this API, so an in-process test would
    // leave every later request in the suite pointed at a proxy that is about to be closed. The
    // child confines the mutation and dies with it.
    let hits = 0;
    const proxy = createServer((_request, response) => {
      hits += 1;
      response.writeHead(200);
      response.end("proxied");
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    const address = proxy.address();
    if (address === null || typeof address === "string") {
      throw new Error("proxy did not bind a TCP port");
    }
    const configured = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    const unconfigured = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    writeFileSync(
      path.join(configured, ".env.doc-verify"),
      `API_KEY=key\nHTTPS_PROXY=http://127.0.0.1:${address.port}\n`,
    );
    writeFileSync(path.join(unconfigured, ".env.doc-verify"), "API_KEY=key\n");
    const script = [
      'const { loadDocVerifyEnv } = await import(process.env.ENTRY);',
      'const [unconfigured, configured] = [process.env.UNCONFIGURED, process.env.CONFIGURED];',
      'const target = "http://proxy-target.invalid/";',
      'const reach = async () => { try { return await (await fetch(target)).text(); } catch { return null; } };',
      'loadDocVerifyEnv(unconfigured);',
      'process.stdout.write(`before=${await reach()}|`);',
      'loadDocVerifyEnv(configured);',
      'process.stdout.write(`proxy=${process.env.HTTPS_PROXY}|after=${await reach()}`);',
    ].join("\n");
    const output = await execFileAsync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        ENTRY: path.resolve("doc-verify/dist/local-env.js"),
        UNCONFIGURED: unconfigured,
        CONFIGURED: configured,
      },
    });
    try {
      // The negative arm comes first inside the child: with no configured proxy the request cannot
      // route, so the later hit is attributable to the loader and not to the environment.
      expect(output.stdout).toBe(`before=null|proxy=http://127.0.0.1:${address.port}|after=proxied`);
      expect(hits).toBe(1);
    } finally {
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
    }
  });

  it("keeps an unreadable file fatal for the key but not for a run that already has one", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    mkdirSync(path.join(root, ".env.doc-verify"));
    const previous = environment(["TYPESAFE_API_KEY", "HTTPS_PROXY", "HTTP_PROXY"]);
    try {
      // The file is required for the key, so a run without one still fails loudly on it.
      expect(() => loadDocVerifyEnv(root)).toThrow(BlockedError);
      // A run that already has its key does not depend on the file: it must not be reddened by a
      // broken credential symlink -- and the proxy step still runs, which is the point of the change.
      process.env.TYPESAFE_API_KEY = "already-set";
      expect(() => loadDocVerifyEnv(root)).not.toThrow();
    } finally {
      restoreEnvironment(previous);
    }
  });

  it("prefers a proxy from the process environment over the file", () => {
    // The loader installs a PROCESS-WIDE dispatcher and this API cannot uninstall it, so this test
    // asserts precedence through a child process for the same reason the routing test does: run
    // in-process, a proxy pointing at a host that does not resolve stays installed and every later
    // test in the suite inherits it. That is not hypothetical -- it made the suite intermittent.
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    writeFileSync(path.join(root, ".env.doc-verify"), "HTTPS_PROXY=http://from-file.invalid:1\n");
    const script = [
      'process.env.HTTPS_PROXY = "http://from-process.invalid:2";',
      'const { loadDocVerifyEnv } = await import(process.env.ENTRY);',
      'loadDocVerifyEnv(process.env.ROOT);',
      'process.stdout.write(`proxy=${process.env.HTTPS_PROXY}`);',
    ].join("\n");
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        ENTRY: path.resolve("doc-verify/dist/local-env.js"),
        ROOT: root,
      },
    });
    expect(output).toBe("proxy=http://from-process.invalid:2");
  });

  it("applies the file during a check and keeps the key out of the report", async () => {
    const root = await fixtureRepository();
    const canary = "local-env-canary-key";
    await writeFile(path.join(root, ".env.doc-verify"), `API_KEY=${canary}\n`);
    const previous = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      const report = await checkDocuments({
        root,
        mode: { kind: "paths", paths: ["design/a.md"] },
        profile: "draft",
      });
      expect(process.env.TYPESAFE_API_KEY).toBe(canary);
      expect(report.verdict).toBe("PASS");
      expect(JSON.stringify(report)).not.toContain(canary);
    } finally {
      restore("TYPESAFE_API_KEY", previous);
    }
  });
});

describe("canonical credential fallback (#312)", () => {
  function git(cwd: string, args: string[]): void {
    execFileSync("git", args, {
      cwd,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
      },
    });
  }

  it("prefers a worktree-local .env.doc-verify over the canonical file", () => {
    const main = mkdtempSync(path.join(tmpdir(), "doc-verify-main-"));
    const linked = path.join(tmpdir(), `doc-verify-linked-${Date.now()}`);
    try {
      git(main, ["init", "-q"]);
      git(main, ["config", "user.email", "test@example.invalid"]);
      git(main, ["config", "user.name", "fallback-test"]);
      writeFileSync(path.join(main, "README"), "x\n");
      git(main, ["add", "README"]);
      git(main, ["commit", "-qm", "seed"]);
      writeFileSync(path.join(main, ".env.doc-verify"), "API_KEY=from-canonical\n");
      git(main, ["worktree", "add", "--detach", linked, "HEAD"]);
      writeFileSync(path.join(linked, ".env.doc-verify"), "API_KEY=from-local\n");
      expect(resolveDocVerifyEnvPath(linked)).toBe(path.join(linked, ".env.doc-verify"));
      const previous = process.env.TYPESAFE_API_KEY;
      delete process.env.TYPESAFE_API_KEY;
      try {
        loadDocVerifyEnv(linked);
        expect(process.env.TYPESAFE_API_KEY).toBe("from-local");
      } finally {
        restore("TYPESAFE_API_KEY", previous);
      }
    } finally {
      try {
        git(main, ["worktree", "remove", "--force", linked]);
      } catch {
        rmSync(linked, { recursive: true, force: true });
      }
      rmSync(main, { recursive: true, force: true });
    }
  });

  it("falls back to the canonical checkout's .env.doc-verify when local is absent", () => {
    const main = mkdtempSync(path.join(tmpdir(), "doc-verify-main-"));
    const linked = path.join(tmpdir(), `doc-verify-linked-${Date.now()}`);
    try {
      git(main, ["init", "-q"]);
      git(main, ["config", "user.email", "test@example.invalid"]);
      git(main, ["config", "user.name", "fallback-test"]);
      writeFileSync(path.join(main, "README"), "x\n");
      git(main, ["add", "README"]);
      git(main, ["commit", "-qm", "seed"]);
      writeFileSync(path.join(main, ".env.doc-verify"), "API_KEY=from-canonical\n");
      git(main, ["worktree", "add", "--detach", linked, "HEAD"]);
      expect(realpathSync(resolveDocVerifyEnvPath(linked) ?? "")).toBe(
        realpathSync(path.join(main, ".env.doc-verify")),
      );
      const previous = process.env.TYPESAFE_API_KEY;
      delete process.env.TYPESAFE_API_KEY;
      try {
        loadDocVerifyEnv(linked);
        expect(process.env.TYPESAFE_API_KEY).toBe("from-canonical");
      } finally {
        restore("TYPESAFE_API_KEY", previous);
      }
    } finally {
      try {
        git(main, ["worktree", "remove", "--force", linked]);
      } catch {
        rmSync(linked, { recursive: true, force: true });
      }
      rmSync(main, { recursive: true, force: true });
    }
  });

  it("returns undefined when neither local nor canonical has the file", () => {
    const main = mkdtempSync(path.join(tmpdir(), "doc-verify-main-"));
    const linked = path.join(tmpdir(), `doc-verify-linked-${Date.now()}`);
    try {
      git(main, ["init", "-q"]);
      git(main, ["config", "user.email", "test@example.invalid"]);
      git(main, ["config", "user.name", "fallback-test"]);
      writeFileSync(path.join(main, "README"), "x\n");
      git(main, ["add", "README"]);
      git(main, ["commit", "-qm", "seed"]);
      git(main, ["worktree", "add", "--detach", linked, "HEAD"]);
      expect(resolveDocVerifyEnvPath(linked)).toBeUndefined();
      expect(resolveDocVerifyEnvPath(main)).toBeUndefined();
    } finally {
      try {
        git(main, ["worktree", "remove", "--force", linked]);
      } catch {
        rmSync(linked, { recursive: true, force: true });
      }
      rmSync(main, { recursive: true, force: true });
    }
  });

  it("returns undefined when the root is not a git worktree (unresolvable canonical)", () => {
    const orphan = mkdtempSync(path.join(tmpdir(), "doc-verify-orphan-"));
    try {
      expect(resolveDocVerifyEnvPath(orphan)).toBeUndefined();
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});

/** Every named variable's value, so a test can put the process back exactly as it found it. */
function environment(names: readonly string[]): Map<string, string | undefined> {
  const saved = new Map<string, string | undefined>();
  for (const name of names) {
    saved.set(name, process.env[name]);
    delete process.env[name];
  }
  return saved;
}

function restoreEnvironment(saved: Map<string, string | undefined>): void {
  for (const [name, value] of saved) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

function restore(name: "TYPESAFE_API_KEY" | "OTHER_SECRET" | "API_KEY", value: string | undefined): void {
  if (value !== undefined) {
    process.env[name] = value;
    return;
  }
  if (name === "TYPESAFE_API_KEY") {
    delete process.env.TYPESAFE_API_KEY;
  } else if (name === "OTHER_SECRET") {
    delete process.env.OTHER_SECRET;
  } else {
    delete process.env.API_KEY;
  }
}

async function fixtureRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-env-check-"));
  await mkdir(path.join(root, "design"), { recursive: true });
  await mkdir(path.join(root, "modules"), { recursive: true });
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
    required_sections: [problem]
invalidation_patterns: [.doc-verify.yaml]
judge:
  kind: jev
  model: jev-1.13.0
  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb
  attestation_max_age_seconds: 3600
policy:
  kind: semantic-boundary
  version: 1
  max_evidence_bytes: 12000
  forbidden_literals: []
`);
  // Structural only: the draft check builds the judge client from the file's key but asks nothing.
  await writeFile(path.join(root, "modules/design.yaml"), `schema_version: 2
kind: verification-module
module: env.design
constraints:
  has-problem:
    forall: core.meta(D, kind, design)
    require: core.section(D, S, _), core.heading(D, S, 'Problem')
    severity: error
`);
  await writeFile(path.join(root, "design/a.md"), "# A\n## Problem\nA concrete problem.\n");
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}
