#!/usr/bin/env node
// Claim: no gitignored file is tracked.
//
// One command: `node scripts/check-tracked-ignored.mjs`
//   exit 0  the repo has none, and the seeded probe went red then green
//   exit 1  the repo has one or more (a finding)
//   exit 2  the instrument could not go red on its seeded probe (not a gate)
//
// `--self-test` runs only the probes. `--no-self-test` runs only the repo check.
// Default is both: a skip of the probe is not a pass.
//
// Seeded defect: a `*.pyc` under `__pycache__/` is `git add -f`'d in a throwaway
// repo. The live finding that first proved this check on home.conf `main` was
// `skills/skill-creator/scripts/__pycache__/quick_validate.cpython-{311,314}.pyc`.
//
// ⚠ FIXTURE COMMANDS RUN WITH EVERY INHERITED `GIT_*` VARIABLE REMOVED, and that
// is load-bearing rather than hygiene. `Git` exports `GIT_DIR` and an absolute
// `GIT_INDEX_FILE` in a linked worktree, and `prek` passes them through. A
// fixture that inherits them runs its `init`/`config`/`add`/`commit`/`rm --cached`
// against the CALLER's repository instead of the throwaway one: it rewrites the
// caller's `user.name`/`user.email`, stages fixture paths in the caller's index,
// and can move the caller's branch tip. Measured 2026-10-13 (card #271): a
// fixture identity `case <case@test>` reached `home.conf` `origin/main` this way.
// The deny is derived from the environment (`GIT_*`) rather than a fixed list, so
// a variable Git grows later is stripped too. The two config overrides are set
// AFTER the strip, so an inherited value cannot defeat them.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = dirname(dirname(SELF));

// The isolation arms run the fixture in a child and compare the caller before and
// after. "The caller was unchanged" is satisfied BOTH by a working strip and by a
// child that never executed, so the child prints this oracle on its final line and
// the arms require it. Without it the arms cannot distinguish isolation from
// inertness, and an inert child reads as a pass.
const FIXTURE_COMPLETED = "tracked-ignored: fixture complete";

const FIXTURE_ENV = (() => {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("GIT_")) env[key] = value;
  }
  env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_CONFIG_SYSTEM = "/dev/null";
  return env;
})();

function git(cwd, args, env = FIXTURE_ENV) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env });
}

function trackedIgnored(cwd) {
  const out = execFileSync("git", ["ls-files", "-ci", "--exclude-standard"], {
    cwd,
    encoding: "utf8",
    env: FIXTURE_ENV,
  });
  return out.split("\n").filter(Boolean);
}

function fixtureSelfTest() {
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
    // The oracle the parent's isolation arms require. It is printed HERE, at the
    // end of the fixture's real work, not in `main`: a print keyed on the exit
    // code would also fire for a child that returned 0 without doing anything.
    process.stdout.write(`${FIXTURE_COMPLETED}\n`);
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── caller-isolation arms (card #271 acceptance 1, 2, 5) ─────────────────────
//
// A real repository stands in for the caller. Each arm snapshots it, runs the
// fixture in a CHILD process carrying a hook-shaped environment, and asserts the
// snapshot is byte-identical. The child is the shipping script; the arms do not
// re-implement the strip, so a regression in the strip reddens them.

function initCallerRepo() {
  const repo = mkdtempSync(join(tmpdir(), "tracked-ignored-caller-"));
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "caller@example.invalid"]);
  git(repo, ["config", "user.name", "caller"]);
  writeFileSync(join(repo, "seed.txt"), "caller seed\n");
  git(repo, ["add", "seed.txt"]);
  git(repo, ["commit", "-qm", "caller seed"]);
  return repo;
}

// The caller's observable state, as one string. `%ae`/`%ce` are the exact
// author/committer emails; there is no name or regex search (card #271
// acceptance 7 forbids `git log --author=<fixture>`).
function callerFacts(repo) {
  const branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  return JSON.stringify({
    head: git(repo, ["rev-parse", "HEAD"]).trim(),
    branch,
    tipIdentities: git(repo, ["log", "-1", "--format=%ae%x00%ce", `refs/heads/${branch}`]).trim(),
    index: git(repo, ["ls-files", "--stage"]).trim(),
    porcelain: git(repo, ["status", "--porcelain=v1"]).trim(),
    userName: git(repo, ["config", "user.name"]).trim(),
    userEmail: git(repo, ["config", "user.email"]).trim(),
  });
}

function runFixtureChild(cwd, inherited) {
  try {
    const stdout = execFileSync(process.execPath, [SELF, "--fixture-only"], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...inherited },
    });
    return { failure: null, completed: stdout.includes(FIXTURE_COMPLETED) };
  } catch (error) {
    // A misdirected fixture usually dies on its first `git add` rather than
    // completing. The arm's verdict is the caller-state comparison, not the
    // child's exit code, so a crash is carried forward as evidence.
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    return {
      failure: error instanceof Error ? error.message.split("\n")[0] : String(error),
      completed: stdout.includes(FIXTURE_COMPLETED),
    };
  }
}

// Control: prove the hostile environment is live. A child doing what the fixture
// does, but WITHOUT the strip, must land in the caller. If this arm is green, the
// isolation arms below are green for the wrong reason (a dead environment), so
// the whole check is `not a gate` (exit 2).
function hostileEnvIsLive(callerRepo) {
  const before = callerFacts(callerRepo);
  const scratch = mkdtempSync(join(tmpdir(), "tracked-ignored-control-"));
  try {
    // The fixture's own first identity write, with the environment INHERITED
    // instead of stripped. `cwd` is a throwaway directory: if the write lands in
    // the caller anyway, the hostile variable is live and the arms can go red.
    execFileSync("git", ["config", "user.email", "leaked@example.invalid"], {
      cwd: scratch,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_DIR: join(callerRepo, ".git"),
        GIT_WORK_TREE: callerRepo,
        GIT_INDEX_FILE: join(callerRepo, ".git", "index"),
      },
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const after = callerFacts(callerRepo);
  git(callerRepo, ["config", "user.email", "caller@example.invalid"]);
  return before !== after;
}

function isolationArm({ label, callerRepo, cwd, inherited }) {
  const before = callerFacts(callerRepo);
  const child = runFixtureChild(cwd, inherited);
  const after = callerFacts(callerRepo);

  // Red: the fixture reached the caller. An unchanged caller is NOT enough for green.
  if (before !== after) {
    process.stderr.write(
      `tracked-ignored: NOT ARMED — ${label} mutated the caller repository\n` +
        `  before ${before}\n  after  ${after}\n`,
    );
    if (child.failure !== null) {
      process.stderr.write(`  (fixture child also failed: ${child.failure})\n`);
    }
    return 2;
  }

  // The caller is clean, but this arm is only evidence if the fixture actually RAN.
  // A child that exits before doing anything also leaves the caller unchanged, and
  // that state would otherwise read as a pass: "the caller was unchanged" is
  // satisfied both by a working strip and by a child that never ran. This is the
  // oracle that separates "isolation worked" from "nothing happened".
  if (!child.completed) {
    process.stderr.write(
      `tracked-ignored: NOT ARMED — ${label}: caller unchanged, but the fixture child ` +
        `did not complete, so this arm cannot tell isolation from inertness\n`,
    );
    if (child.failure !== null) {
      process.stderr.write(`  (fixture child failed: ${child.failure})\n`);
    }
    return 2;
  }
  return 0;
}

function callerIsolationSelfTest() {
  const caller = initCallerRepo();
  const elsewhere = mkdtempSync(join(tmpdir(), "tracked-ignored-cwd-"));
  let linked = null;
  try {
    if (!hostileEnvIsLive(caller)) {
      process.stderr.write(
        "tracked-ignored: NOT ARMED — the hostile environment is not live, so the isolation arms prove nothing\n",
      );
      return 2;
    }

    // Arm 1 — GIT_DIR + GIT_INDEX_FILE, the shape a linked worktree exports.
    const armGitDir = isolationArm({
      label: "GIT_DIR + GIT_INDEX_FILE",
      callerRepo: caller,
      cwd: elsewhere,
      inherited: {
        GIT_DIR: join(caller, ".git"),
        GIT_WORK_TREE: caller,
        GIT_INDEX_FILE: join(caller, ".git", "index"),
      },
    });
    if (armGitDir !== 0) return armGitDir;

    // Arm 2 — absolute GIT_INDEX_FILE alone. Card #271 acceptance 2: this alone
    // leaves fixture paths staged even when HEAD does not move.
    const armIndex = isolationArm({
      label: "absolute GIT_INDEX_FILE only",
      callerRepo: caller,
      cwd: elsewhere,
      inherited: { GIT_INDEX_FILE: join(caller, ".git", "index") },
    });
    if (armIndex !== 0) return armIndex;

    // Arm 3 — hook level, from a real linked worktree (acceptance 5). A fixture
    // run from the main checkout does not reach the defect, so this arm is the
    // one that matters.
    linked = join(elsewhere, "linked");
    git(caller, ["worktree", "add", "-q", "-b", "hook-arm", linked]);
    const armHook = isolationArm({
      label: "linked-worktree hook",
      callerRepo: caller,
      cwd: linked,
      inherited: {
        GIT_DIR: join(caller, ".git", "worktrees", "linked"),
        GIT_WORK_TREE: linked,
        GIT_INDEX_FILE: join(caller, ".git", "worktrees", "linked", "index"),
      },
    });
    if (armHook !== 0) return armHook;

    // Card #271 acceptance 7 — the population is derived from the source, never
    // a hardcoded count or a single-email literal. No fixture identity may appear
    // as a caller author or committer.
    const declared = declaredFixtureIdentities();
    if (declared.size === 0) {
      process.stderr.write(
        "tracked-ignored: NOT ARMED — no fixture identity declarations were discovered to check against\n",
      );
      return 2;
    }
    const tip = git(caller, ["log", "-1", "--format=%ae%n%ce"]).trim().split("\n");
    const leaked = tip.filter((email) => declared.has(email));
    if (leaked.length > 0) {
      process.stderr.write(
        `tracked-ignored: NOT ARMED — caller tip carries a declared fixture identity: ${leaked.join(", ")}\n`,
      );
      return 2;
    }

    process.stdout.write(
      `tracked-ignored: armed — fixtures isolated from caller (GIT_DIR, GIT_INDEX_FILE, linked-worktree hook); ${declared.size} declared fixture identit${declared.size === 1 ? "y" : "ies"} checked\n`,
    );
    return 0;
  } finally {
    if (linked !== null) rmSync(linked, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
    rmSync(caller, { recursive: true, force: true });
  }
}

// Every identity this repository's own scripts declare for a fixture. Discovered
// by reading the declaring call sites, so adding a declaration on a new line
// extends the population with no edit here and no fixed count.
const IDENTITY_DECLARATION = /["']user\.(?:email|name)["']\s*,\s*["']([^"']+)["']/g;
const FIXTURE_SOURCE_ROOTS = ["scripts", "skills"];
const FIXTURE_SOURCE_FILE = /\.(?:mjs|cjs|js|py|sh)$/;

function sourceFiles(root) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      found.push(...sourceFiles(path));
    } else if (entry.isFile() && FIXTURE_SOURCE_FILE.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

function declaredFixtureIdentities() {
  const identities = new Set();
  for (const rootName of FIXTURE_SOURCE_ROOTS) {
    const root = join(REPO_ROOT, rootName);
    try {
      if (!statSync(root).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of sourceFiles(root)) {
      // This file declares its own control-caller identity, which is the
      // legitimate identity of the stand-in repository rather than a fixture
      // identity. Scanning it would make the check flag its own control.
      if (file === SELF) continue;
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(IDENTITY_DECLARATION)) {
        if (match[1].includes("@")) identities.add(match[1]);
      }
    }
  }
  return identities;
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
  const fixtureOnly = process.argv.includes("--fixture-only");
  if (fixtureOnly) {
    // The oracle is printed inside `fixtureSelfTest` itself, at the end of its
    // real work, so it cannot fire for a child that exits without doing it.
    return fixtureSelfTest();
  }
  const selfTestOnly = process.argv.includes("--self-test");
  const skipSelfTest = process.argv.includes("--no-self-test");
  if (!skipSelfTest) {
    const armed = fixtureSelfTest();
    if (armed !== 0) return armed;
    const isolated = callerIsolationSelfTest();
    if (isolated !== 0) return isolated;
    if (selfTestOnly) return 0;
  }
  return checkRepo();
}

process.exit(main());
