#!/usr/bin/env node
// document-contracts hook entry for home.conf (#310 / #312).
//
// Exit codes (doc-verify owns the public vocabulary — README / report.ts):
//   0 PASS | 1 NO-GO | 2 NEEDS-REVIEW | 3 BLOCKED | 64+ usage/config
//
// Exit 2 is overloaded on purpose (house pattern = oxlint: discriminate on the
// stream when codes collide). This wrapper may also return 2 for:
//   - setup refusal — prefixed on stderr
//   - abnormal child termination — prefixed on stderr
//   - the tool's own NEEDS-REVIEW — no setup prefix; tool stdout is the authority
//
// Flags:
//   --auto-setup   Opt-in (prek hook entry). If dist/node_modules are missing,
//                  run `npm ci --ignore-scripts` (or `npm install --ignore-scripts`)
//                  then `npm run build`. Avoids prepare's hook-install side effect.
//                  Direct invocation WITHOUT this flag still refuses.
//   --self-test    Setup / exit-class probes only.
//
// Credential fallback (#312) lives in doc-verify (local .env.doc-verify wins;
// else canonical checkout's file). This wrapper does not copy secrets.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = dirname(dirname(SELF));
const CLI_REL = join("doc-verify", "dist", "cli.js");

const SETUP_HINT =
  "document-contracts: setup required — run `npm install` in this worktree " +
  "(builds gitignored doc-verify/dist via prepare), or invoke via the prek hook " +
  "with --auto-setup. This is not a document finding.";

function cliPath(root) {
  return join(root, CLI_REL);
}

function hasNodeModules(root) {
  return existsSync(join(root, "node_modules"));
}

function runNpm(root, args) {
  return spawnSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
}

/** Install deps without running prepare (avoids prek install side effects). */
function installDeps(root) {
  const lock = join(root, "package-lock.json");
  const args = existsSync(lock)
    ? ["ci", "--ignore-scripts"]
    : ["install", "--ignore-scripts"];
  return runNpm(root, args);
}

function buildCli(root) {
  return runNpm(root, ["run", "--silent", "build"]);
}

/**
 * @param {string} root
 * @param {{ autoBuild?: boolean, autoSetup?: boolean }} [opts]
 */
function ensureCli(root, { autoBuild = true, autoSetup = false } = {}) {
  const cli = cliPath(root);
  if (existsSync(cli)) return { ok: true, cli };

  if (!hasNodeModules(root)) {
    if (!autoSetup) {
      return { ok: false, code: 2, message: SETUP_HINT };
    }
    const install = installDeps(root);
    if (install.status !== 0 || !hasNodeModules(root)) {
      const detail = (install.stderr || install.stdout || "").trim().slice(0, 500);
      return {
        ok: false,
        code: 2,
        message:
          "document-contracts: --auto-setup `npm ci/install --ignore-scripts` failed. " +
          "This is not a document finding." +
          (detail ? `\n${detail}` : ""),
      };
    }
  }

  if (existsSync(cli)) return { ok: true, cli };

  if (!autoBuild && !autoSetup) {
    return {
      ok: false,
      code: 2,
      message:
        "document-contracts: doc-verify/dist/cli.js is missing after install; " +
        "run `npm run build`. This is not a document finding.",
    };
  }

  const build = buildCli(root);
  if (build.status !== 0 || !existsSync(cli)) {
    const detail = (build.stderr || build.stdout || "").trim().slice(0, 500);
    return {
      ok: false,
      code: 2,
      message:
        "document-contracts: `npm run build` did not produce doc-verify/dist/cli.js. " +
        "This is not a document finding." +
        (detail ? `\n${detail}` : ""),
    };
  }
  return { ok: true, cli };
}

function runCheck(root, checkArgs, { autoSetup = false } = {}) {
  const ensured = ensureCli(root, { autoBuild: true, autoSetup });
  if (!ensured.ok) {
    console.error(ensured.message);
    return ensured.code;
  }
  // Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set.
  const env = { ...process.env };
  if (!env.NODE_USE_ENV_PROXY?.trim()) {
    env.NODE_USE_ENV_PROXY = "1";
  }
  const result = spawnSync(process.execPath, [ensured.cli, ...checkArgs], {
    cwd: root,
    encoding: "utf8",
    env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(
      `document-contracts: failed to spawn CLI (${result.error.message}). ` +
        "This is not a document finding.",
    );
    return 2;
  }
  if (typeof result.status !== "number") {
    console.error(
      `document-contracts: CLI terminated without an exit status` +
        `${result.signal ? ` (${result.signal})` : ""}. ` +
        "This is not a document finding.",
    );
    return 2;
  }
  return result.status;
}

function writeStubCli(dir, exitCode) {
  const dist = join(dir, "doc-verify", "dist");
  mkdirSync(dist, { recursive: true });
  const stub = join(dist, "cli.js");
  writeFileSync(
    stub,
    `#!/usr/bin/env node\nconsole.log("stub-cli exit ${exitCode}");\nprocess.exit(${exitCode});\n`,
  );
  chmodSync(stub, 0o755);
  return stub;
}

function selfTest() {
  const failures = [];

  // Arm A: no node_modules, no dist, no --auto-setup → exit 2 + setup hint.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-setup-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      mkdirSync(join(dir, "doc-verify"), { recursive: true });
      const ensured = ensureCli(dir, { autoBuild: true, autoSetup: false });
      if (ensured.ok || ensured.code !== 2) {
        failures.push(
          `arm A: expected setup refuse exit 2, got ${JSON.stringify(ensured)}`,
        );
      } else if (!String(ensured.message).includes("npm install")) {
        failures.push(`arm A: message must name npm install; got: ${ensured.message}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm B: stub CLI exits 1 → runCheck propagates 1.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-red-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 1);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"]);
      if (code !== 1) failures.push(`arm B: expected exit 1 from stub finding, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm C: stub CLI exits 0 → runCheck propagates 0.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-green-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 0);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"]);
      if (code !== 0) failures.push(`arm C: expected exit 0 from stub pass, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm D: stub CLI exits 2 → runCheck propagates 2.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-review-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 2);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"]);
      if (code !== 2) failures.push(`arm D: expected exit 2 from stub, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm E: --auto-setup with no node_modules attempts install; without a real
  // lock/package it fails setup (exit 2), never pretends to be a document finding.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-autosetup-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture-empty", private: true }, null, 2),
      );
      mkdirSync(join(dir, "doc-verify"), { recursive: true });
      const ensured = ensureCli(dir, { autoBuild: true, autoSetup: true });
      if (ensured.ok) {
        failures.push("arm E: expected --auto-setup on empty package to fail setup, got ok");
      } else if (ensured.code !== 2) {
        failures.push(`arm E: expected exit 2, got ${ensured.code}`);
      } else if (!String(ensured.message).includes("--auto-setup")) {
        failures.push(`arm E: message must name --auto-setup; got: ${ensured.message}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  if (failures.length > 0) {
    for (const line of failures) console.error(line);
    console.error(
      "document-contracts: --self-test failed (instrument broken, not a document finding).",
    );
    return 2;
  }
  console.log(
    "document-contracts: --self-test PASS (setup refuse / RED / GREEN / exit-2 / auto-setup fail)",
  );
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes("--self-test")) {
  process.exit(selfTest());
}

const autoSetup = argv.includes("--auto-setup");
const checkArgs = argv.filter((a) => a !== "--auto-setup");
const finalArgs =
  checkArgs.length > 0
    ? checkArgs
    : ["check", "--staged", "--profile", "auto", "--format", "text"];

process.exit(runCheck(REPO_ROOT, finalArgs, { autoSetup }));
