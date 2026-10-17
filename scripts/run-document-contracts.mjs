#!/usr/bin/env node
// document-contracts hook entry for home.conf (#310 / #312).
//
// Exit codes (doc-verify owns the public vocabulary — README / report.ts):
//   0 PASS | 1 NO-GO | 2 NEEDS-REVIEW | 3 BLOCKED | 64+ usage/config
//
// STAGE POLICY (owner decision 2026-10-17, thread #comp-agent-substrate-qa:d3974615,
// refined by @CowBoy): structural checks block; the semantic judge informs.
//   --stage pre-commit  NOTHING is refused. Every verdict prints and exits 0.
//   --stage pre-push    NO-GO (1) blocks; BLOCKED (3) reports and exits 0. A BLOCKED that
//                       refused would make the judge's credential a requirement to push at
//                       all, which is the dependency this split removes.
// Without --stage the historical pass-through is kept, so every existing caller and
// the self-test arms are unchanged.
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

function runCheck(root, checkArgs, { autoSetup = false, stage } = {}) {
  const ensured = ensureCli(root, { autoBuild: true, autoSetup });
  if (!ensured.ok) {
    console.error(ensured.message);
    // A setup refusal is BLOCKED, not a document finding. Under a stage policy it reports
    // rather than refusing, for the same reason a BLOCKED verdict does.
    return applyStagePolicy(ensured.code === 2 ? 3 : ensured.code, stage);
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
  return applyStagePolicy(result.status, stage);
}

/**
 * Map the CLI's exit status onto the hook's stage policy.
 *
 * The matrix, so the next reader does not have to infer it:
 *
 *   status        pre-commit   pre-push   (no --stage)
 *   0 PASS            0            0            0
 *   1 NO-GO           0            1            1      <- refused only at push
 *   2 NEEDS-REVIEW    0            2            2      <- refused only at push
 *   3 BLOCKED         0            0            3      <- never refused under a stage
 *
 * pre-commit refuses NOTHING. The owner's decision (2026-10-17) is "contracts warns on
 * pre-commit, blocks on pre-push", with the rationale "a verdict there must inform, not
 * veto": the commit hook is where an author is still editing. Refusing a NO-GO at commit
 * would also keep the judge on the critical path of every document commit, which is the
 * credential coupling this split exists to remove.
 *
 * A refused verdict still PRINTS, naming its class, so a real finding is visible even when
 * it does not block. That is the difference between "warns" and "silently passes".
 *
 * @param {number} status
 * @param {"pre-commit" | "pre-push" | undefined} stage
 */
function applyStagePolicy(status, stage) {
  if (stage === undefined) return status;
  if (stage === "pre-commit") {
    if (status !== 0) {
      console.error(
        `document-contracts: ${verdictName(status)} -- reported, not refused (pre-commit warns; ` +
          "pre-push blocks on NO-GO). This verdict does not stop the commit.",
      );
    }
    return 0;
  }
  // pre-push: BLOCKED reports, NO-GO blocks. NEEDS-REVIEW keeps its historical code.
  if (status === 3) {
    console.error(
      "document-contracts: BLOCKED -- the judge could not run, so this is not a document " +
        "finding and does not refuse the push. Fix the credential if you want the semantic " +
        "check to actually read the change.",
    );
    return 0;
  }
  return status;
}

/** Human name for an exit status, so a warning says what it saw. */
function verdictName(status) {
  switch (status) {
    case 0:
      return "PASS";
    case 1:
      return "NO-GO (a document finding)";
    case 2:
      return "NEEDS-REVIEW or a setup/anomaly refusal";
    case 3:
      return "BLOCKED (the judge could not run)";
    default:
      return `exit ${status}`;
  }
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

  // Arm F: stub CLI exits 3 (BLOCKED) under --stage pre-commit -> reports, exits 0.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-blocked-commit-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 3);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"], {
        stage: "pre-commit",
      });
      if (code !== 0) failures.push(`arm F: BLOCKED at pre-commit must exit 0, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm G: stub CLI exits 3 (BLOCKED) under --stage pre-push -> reports, exits 0. A BLOCKED
  // that refused here would make the judge credential a requirement to push at all.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-blocked-push-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 3);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"], {
        stage: "pre-push",
      });
      if (code !== 0) failures.push(`arm G: BLOCKED at pre-push must exit 0, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm H: stub CLI exits 1 (NO-GO) under --stage pre-push -> still blocks. The stage
  // policy must not become "never refuse"; only BLOCKED is excused.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-nogo-push-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 1);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"], {
        stage: "pre-push",
      });
      if (code !== 1) failures.push(`arm H: NO-GO at pre-push must still exit 1, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm I: stub CLI exits 1 (NO-GO) under --stage pre-commit -> reports, exits 0. This is the
  // arm the first version of this change was missing: pre-commit warns on EVERY verdict, it
  // does not refuse a real finding. (Review finding, @CowBoy, 2026-10-17.)
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-nogo-commit-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 1);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"], {
        stage: "pre-commit",
      });
      if (code !== 0) failures.push(`arm I: NO-GO at pre-commit must exit 0, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm J: stub CLI exits 2 (NEEDS-REVIEW) under --stage pre-commit -> reports, exits 0.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-review-commit-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 2);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"], {
        stage: "pre-commit",
      });
      if (code !== 0) failures.push(`arm J: NEEDS-REVIEW at pre-commit must exit 0, got ${code}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Arm K: stub CLI exits 2 (NEEDS-REVIEW) under --stage pre-push -> keeps its historical code.
  // The push stage is NOT "excuse everything": only BLOCKED is excused there.
  {
    const dir = mkdtempSync(join(tmpdir(), "doc-contracts-review-push-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "fixture", private: true }, null, 2),
      );
      writeStubCli(dir, 2);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const code = runCheck(dir, ["check", "--staged", "--profile", "auto", "--format", "text"], {
        stage: "pre-push",
      });
      if (code !== 2) failures.push(`arm K: NEEDS-REVIEW at pre-push must exit 2, got ${code}`);
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
    "document-contracts: --self-test PASS (setup refuse / RED / GREEN / exit-2 / auto-setup " +
      "fail / pre-commit-refuses-nothing (BLOCKED+NO-GO+NEEDS-REVIEW) / pre-push-blocks-NO-GO-only)",
  );
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes("--self-test")) {
  process.exit(selfTest());
}

const stageIndex = argv.indexOf("--stage");
let stage;
if (stageIndex !== -1) {
  stage = argv[stageIndex + 1];
  if (stage !== "pre-commit" && stage !== "pre-push") {
    console.error(`document-contracts: --stage must be pre-commit or pre-push; got ${stage}`);
    process.exit(64);
  }
}

const autoSetup = argv.includes("--auto-setup");
const checkArgs = argv.filter((a, i) => a !== "--auto-setup" && i !== stageIndex && i !== stageIndex + 1);
const finalArgs =
  checkArgs.length > 0
    ? checkArgs
    : ["check", "--staged", "--profile", "auto", "--format", "text"];

process.exit(runCheck(REPO_ROOT, finalArgs, { autoSetup, stage }));
