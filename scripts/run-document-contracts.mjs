#!/usr/bin/env node
// document-contracts hook entry for home.conf.
//
// Why this exists (#310): `doc-verify/dist/` is gitignored. A fresh linked
// worktree therefore has no CLI binary. The previous hook entry
// (`npm exec doc-verify …`) failed with an opaque ENOENT under
// `~/.npm/_npx/…/package.json`, which looks like a broken gate and pushes
// authors toward `--no-verify`.
//
// Contract:
//   exit 0  document check passed
//   exit 1  document finding (real RED)
//   exit 2  missing setup / cannot run the instrument (not a document finding)
//
// Setup path: `npm install` in the worktree (runs `prepare` → build). If
// `node_modules` is present but `dist` is absent (e.g. `--ignore-scripts`),
// this wrapper builds once and continues.
//
// `--self-test` runs only the setup / exit-class probes. Default is the real
// staged check (same args the hook used to pass to `npm exec`).

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
  "(builds gitignored doc-verify/dist via prepare). This is not a document finding.";

function cliPath(root) {
  return join(root, CLI_REL);
}

function hasNodeModules(root) {
  return existsSync(join(root, "node_modules"));
}

function ensureCli(root, { autoBuild = true } = {}) {
  const cli = cliPath(root);
  if (existsSync(cli)) return { ok: true, cli };

  if (!hasNodeModules(root)) {
    return { ok: false, code: 2, message: SETUP_HINT };
  }

  if (!autoBuild) {
    return {
      ok: false,
      code: 2,
      message:
        "document-contracts: doc-verify/dist/cli.js is missing after install; " +
        "run `npm run build`. This is not a document finding.",
    };
  }

  const build = spawnSync("npm", ["run", "--silent", "build"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
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

function runCheck(root, checkArgs) {
  const ensured = ensureCli(root);
  if (!ensured.ok) {
    console.error(ensured.message);
    return ensured.code;
  }
  // Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set. Without
  // it the judge fails as a bare TypeError/Error after the key loaded — a false
  // "environment looks fine" signature (AstraBoy / LAW 719).
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
  return typeof result.status === "number" ? result.status : 2;
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

  // Arm A: no node_modules, no dist → exit 2 + setup hint (not a finding).
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-setup-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      mkdirSync(join(dir, "doc-verify"), { recursive: true });
      const ensured = ensureCli(dir, { autoBuild: true });
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

  // Arm B: stub CLI exits 1 → runCheck propagates 1 (document finding class).
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-red-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 1);
      // Pretend node_modules exists so ensure does not refuse setup.
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

  if (failures.length > 0) {
    for (const line of failures) console.error(line);
    console.error(
      "document-contracts: --self-test failed (instrument broken, not a document finding).",
    );
    return 2;
  }
  console.log("document-contracts: --self-test PASS (setup refuse / RED / GREEN)");
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes("--self-test")) {
  process.exit(selfTest());
}

const checkArgs =
  argv.length > 0
    ? argv
    : ["check", "--staged", "--profile", "auto", "--format", "text"];

process.exit(runCheck(REPO_ROOT, checkArgs));
