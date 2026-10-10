#!/usr/bin/env node
// Claim: no gitignored file is tracked.
//
// One command: `node scripts/check-tracked-ignored.mjs`
//   exit 0  the repo has none, and the seeded probe went red then green
//   exit 1  the repo has one or more (a finding)
//   exit 2  the instrument could not go red on its seeded probe (not a gate)
//
// `--self-test` runs only the probe. `--no-self-test` runs only the repo check.
// Default is both: a skip of the probe is not a pass.
//
// Seeded defect: a `*.pyc` under `__pycache__/` is `git add -f`'d in a throwaway
// repo. The live finding that first proved this check on home.conf `main` was
// `skills/skill-creator/scripts/__pycache__/quick_validate.cpython-{311,314}.pyc`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV });
}

function trackedIgnored(cwd) {
  const out = execFileSync("git", ["ls-files", "-ci", "--exclude-standard"], {
    cwd,
    encoding: "utf8",
    env: GIT_ENV,
  });
  return out.split("\n").filter(Boolean);
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), "tracked-ignored-"));
  try {
    git(dir, ["init", "-q"]);
    git(dir, ["config", "user.email", "test@example.invalid"]);
    git(dir, ["config", "user.name", "tracked-ignored"]);
    writeFileSync(join(dir, ".gitignore"), "__pycache__/\n*.py[cod]\n");
    mkdirSync(join(dir, "pkg", "__pycache__"), { recursive: true });
    writeFileSync(join(dir, "pkg", "__pycache__", "mod.cpython-311.pyc"), "seed");
    git(dir, ["add", ".gitignore"]);
    git(dir, ["add", "-f", "pkg/__pycache__/mod.cpython-311.pyc"]);
    git(dir, ["commit", "-qm", "seed"]);
    const red = trackedIgnored(dir);
    if (red.length === 0) {
      process.stderr.write(
        "tracked-ignored: NOT ARMED — seeded tracked .pyc did not appear in `git ls-files -ci --exclude-standard`\n",
      );
      return 2;
    }
    git(dir, ["rm", "-q", "--cached", "pkg/__pycache__/mod.cpython-311.pyc"]);
    const green = trackedIgnored(dir);
    if (green.length !== 0) {
      process.stderr.write(
        `tracked-ignored: restore did not clear the seed: ${green.join(", ")}\n`,
      );
      return 2;
    }
    process.stdout.write(
      `tracked-ignored: armed — seeded ${red.join(", ")} went RED then GREEN\n`,
    );
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checkRepo() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  const files = trackedIgnored(root);
  if (files.length > 0) {
    process.stderr.write("tracked-ignored: gitignored files are tracked:\n");
    for (const f of files) process.stderr.write(`  ${f}\n`);
    process.stderr.write("Untrack with: git rm --cached -- <paths>\n");
    return 1;
  }
  process.stdout.write("tracked-ignored: no gitignored file is tracked\n");
  return 0;
}

function main() {
  const selfTestOnly = process.argv.includes("--self-test");
  const skipSelfTest = process.argv.includes("--no-self-test");
  if (!skipSelfTest) {
    const armed = selfTest();
    if (armed !== 0) return armed;
    if (selfTestOnly) return 0;
  }
  return checkRepo();
}

process.exit(main());
