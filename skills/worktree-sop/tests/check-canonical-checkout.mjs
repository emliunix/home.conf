#!/usr/bin/env node
// Seeded cases for `scripts/check-canonical-checkout.mjs` (task #219).
//
// WHY THIS FILE EXISTS. The guard is a refusal, and a refusal that has never been observed to
// fire is indistinguishable from one that cannot. Every case below builds a REAL repository in a
// temp directory -- not a mocked argument -- because the whole hazard is about which tree a
// command reads, and a stub would answer a different question than the guard asks.
//
// ⚠ THE DECLINE ARM IS LOAD-BEARING. The guard SKIPs a single-worktree repository, so EVERY red
// case here must build a repository with a SECOND worktree. A case that forgot this would pass
// for the wrong reason: the guard would decline, exit 0, and the test would score that as
// "correctly did not redden". The first case below pins the decline explicitly so the other red
// arms cannot silently degrade into it.
//
// ⚠ WHAT IS NOT TESTED, AND WHY. The guard's target is the MAIN worktree of the repository it is
// run from, so these cases run it with cwd set to a scratch repository whose main worktree they
// control. The shared canonical `/Users/ppio/Documents/home.conf` is NEVER detached, checked out,
// or dirtied to test this -- the incident that motivated the guard was exactly that mistake, and
// reproducing it deliberately would be the same defect with a better excuse.

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const GUARD = join(ROOT, "scripts", "check-canonical-checkout.mjs");

const failures = [];
function fail(message) {
  failures.push(message);
}

// ⚠⚠ THESE CASES MUST RUN WITH A CLEAN GIT ENVIRONMENT, AND THE FIRST VERSION DID NOT.
//
// This suite runs inside a `pre-commit` hook, and hooks export git variables into their
// children -- measured, a hook sees `GIT_INDEX_FILE=.git/index`, and a hook runner may also set
// `GIT_DIR`. A child `git` that inherits them DOES NOT treat the temp directory as its
// repository: `git init` re-inits the CALLER's repository, and the case's own `git add` /
// `git commit` then write the case fixture PLUS THE CALLER'S STAGED FILES into it.
//
// This is not hypothetical. On 2026-10-08 the first version of this file, running inside the
// commit hook, produced a stray commit in the SHARED canonical checkout: `f.txt` (the fixture
// below) alongside the five skill files that were staged at the time, committed as "base" on a
// branch named `feat` -- this file's own vocabulary. The hook then failed on its own side effect,
// so what looked like a check-dispatch failure was the suite committing into the repository it
// was verifying. Naming the variables explicitly is the fix; leaving them inherited makes every
// case a write to whatever repo invoked it.
const GIT_ENV_VARS = [
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_WORK_TREE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_PREFIX",
];

/** The environment for every child `git` here: PATH plus nothing git-related that a hook may
 *  have exported. Explicitly re-set rather than merely deleted is unnecessary -- absence is the
 *  contract -- but the list is named so a future git variable is a visible omission, not a
 *  silent inheritance. */
function cleanEnv() {
  const env = { PATH: process.env.PATH };
  for (const [key, value] of Object.entries(process.env)) {
    if (GIT_ENV_VARS.includes(key)) continue;
    if (key.startsWith("GIT_")) continue; // belt and braces: no git variable at all
    env[key] = value;
  }
  return env;
}

function git(cwd, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: cleanEnv(),
    ...options,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr || result.stdout}`);
  }
  return result;
}

/** Run the guard against a scratch repository. Returns { status, output }. */
function run(cwd, extraEnv = {}) {
  const result = spawnSync(process.execPath, [GUARD], {
    cwd,
    encoding: "utf8",
    env: { ...cleanEnv(), ...extraEnv },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** Build a repository in a temp dir, on `main`, with ONE commit. */
function baseRepo() {
  const dir = mkdtempSync(join(tmpdir(), "canonical-case-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "case@test"]);
  git(dir, ["config", "user.name", "case"]);
  writeFileSync(join(dir, "f.txt"), "base\n");
  git(dir, ["add", "f.txt"]);
  git(dir, ["commit", "-qm", "base"]);
  return dir;
}

/** Give the repo a SECOND worktree. Required for every red arm: the guard declines at one.
 *  Returns the second worktree's path. */
function addSecondWorktree(repo) {
  const second = mkdtempSync(join(tmpdir(), "canonical-second-"));
  rmSync(second, { recursive: true, force: true });
  git(repo, ["worktree", "add", "-q", "--detach", second, "HEAD"]);
  return second;
}

/** A branch with a commit ahead of main, for the detached-landing-reports-false-success case. */
function addAheadBranch(repo) {
  git(repo, ["checkout", "-q", "-b", "feat"]);
  writeFileSync(join(repo, "f.txt"), "ahead\n");
  git(repo, ["add", "f.txt"]);
  git(repo, ["commit", "-qm", "ahead"]);
  git(repo, ["checkout", "-q", "main"]);
}

const created = [];
function tracked(fn) {
  const dirs = fn();
  for (const d of [].concat(dirs)) created.push(d);
}

// ---------------------------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------------------------

// 0. THE DECLINE. One worktree: no shared checkout, so the guard SKIPs whatever branch it is on.
//    Pinned first, because every red arm below depends on the decline NOT firing.
{
  const repo = baseRepo();
  created.push(repo);
  git(repo, ["checkout", "-q", "-b", "feat"]);
  const { status, output } = run(repo);
  if (status !== 0) fail(`decline arm: expected exit 0 in a single-worktree repo, got ${status}: ${output.trim()}`);
  if (!output.includes("SKIP")) fail(`decline arm: expected a SKIP line, got: ${output.trim()}`);
}

// 1. DETACHED at main's own commit -- the incident's exact shape. MUST redden and NAME the SHA.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  git(repo, ["checkout", "-q", "--detach", "HEAD"]);
  const head = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
  const { status, output } = run(repo);
  if (status === 0) fail("detached arm: expected a non-zero exit, got 0");
  if (!output.includes("DETACHED")) fail(`detached arm: expected 'DETACHED', got: ${output.trim()}`);
  if (!output.includes(head.slice(0, 8))) fail(`detached arm: expected the current SHA ${head.slice(0, 8)} in the output, got: ${output.trim()}`);
  if (!output.includes("main")) fail(`detached arm: expected the expected branch named, got: ${output.trim()}`);
}

// 2. A NAMED non-main branch. The other half of the branch predicate.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  git(repo, ["checkout", "-q", "-b", "side"]);
  const { status, output } = run(repo);
  if (status === 0) fail("branch arm: expected a non-zero exit, got 0");
  if (!output.includes("side")) fail(`branch arm: expected the offending branch named, got: ${output.trim()}`);
}

// 3. THE PASSING ARM. On main, clean, two worktrees.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  const { status, output } = run(repo);
  if (status !== 0) fail(`main arm: expected exit 0, got ${status}: ${output.trim()}`);
  if (!output.includes("OK")) fail(`main arm: expected an OK line, got: ${output.trim()}`);
}

// 4. A staged TRACKED file: a landing half-done in the shared tree.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  writeFileSync(join(repo, "f.txt"), "staged\n");
  git(repo, ["add", "f.txt"]);
  const { status, output } = run(repo);
  if (status === 0) fail("dirty arm: expected a non-zero exit for a staged tracked file, got 0");
  if (!output.includes("uncommitted")) fail(`dirty arm: expected an 'uncommitted' problem, got: ${output.trim()}`);
}

// 5. ALLOWED untracked run output under the allowed prefix does NOT redden, so the check does not
//    refuse the one kind of drift it exists to tolerate.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  mkdirSync(join(repo, "receipts", "process", "logs"), { recursive: true });
  writeFileSync(join(repo, "receipts", "process", "logs", "check.log"), "run output\n");
  const { status, output } = run(repo);
  if (status !== 0) fail(`allowed-drift arm: expected exit 0 for allowed run output, got ${status}: ${output.trim()}`);
}

// 6. An untracked path OUTSIDE the allowlist reddens -- the allowlist is not a blanket "dirt is fine".
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  writeFileSync(join(repo, "scratch-note.txt"), "wip\n");
  const { status, output } = run(repo);
  if (status === 0) fail("unexpected-untracked arm: expected a non-zero exit, got 0");
  if (!output.includes("scratch-note.txt")) fail(`unexpected-untracked arm: expected the path named, got: ${output.trim()}`);
}

// 7. The escape hatch is SCOPED, and all three arms are pinned. It excuses an off-`main`
//    checkout (the maintenance case the flag names) but must NOT excuse `core.bare = true` or
//    uncommitted tracked work. The bare half is the one that matters: a maintainer working on an
//    already-broken checkout is exactly who reaches for this flag, so an unscoped hatch would
//    silence the diagnosis the incident needed.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  git(repo, ["checkout", "-q", "--detach", "HEAD"]);
  const { status, output } = run(repo, { ALLOW_CANONICAL_OFF_MAIN: "1" });
  if (status !== 0)
    fail(`allowlist arm: expected exit 0 under the escape hatch for a detach, got ${status}: ${output.trim()}`);
  if (!output.includes("off-main allowed"))
    fail(`allowlist arm: expected the flag to be reported as applied, got: ${output.trim()}`);
}
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  git(repo, ["config", "core.bare", "true"]);
  const { status, output } = run(repo, { ALLOW_CANONICAL_OFF_MAIN: "1" });
  if (status === 0)
    fail("allowlist-bare arm: the escape hatch must NOT excuse `core.bare = true`, but it exited 0");
  if (!output.includes("core.bare"))
    fail(`allowlist-bare arm: expected the bare refusal to survive the flag, got: ${output.trim().split("\n")[0]}`);
}
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  writeFileSync(join(repo, "f.txt"), "staged\n");
  git(repo, ["add", "f.txt"]);
  const { status, output } = run(repo, { ALLOW_CANONICAL_OFF_MAIN: "1" });
  if (status === 0)
    fail("allowlist-dirty arm: the escape hatch must NOT excuse uncommitted tracked work, but it exited 0");
  if (!output.includes("uncommitted"))
    fail(`allowlist-dirty arm: expected the dirty refusal to survive the flag, got: ${output.trim().split("\n")[0]}`);
}

// 8. THE CONSEQUENCE THE HEADER CLAIMS. In a detached canonical checkout at main's own commit,
//    `git merge --ff-only <ahead>` reports success and moves NO ref. This is the reason a
//    detached tree is refused rather than tolerated when it points at main's commit, and the
//    case runs the real git command so the claim is measured here rather than asserted.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  addAheadBranch(repo);
  const mainBefore = git(repo, ["rev-parse", "main"]).stdout.trim();
  git(repo, ["checkout", "-q", "--detach", "main"]);
  const merge = git(repo, ["merge", "--ff-only", "feat"], { allowFailure: true });
  if (merge.status !== 0) {
    fail(`silent-loss arm: the doc claim is that this merge EXITS 0 from a detached tree; it exited ${merge.status}`);
  }
  const mainAfter = git(repo, ["rev-parse", "main"]).stdout.trim();
  if (mainAfter !== mainBefore) {
    fail("silent-loss arm: expected `main` NOT to move, but it did -- the guard's stated reason is wrong");
  }
  const ancestor = git(repo, ["merge-base", "--is-ancestor", "feat", "main"], { allowFailure: true });
  if (ancestor.status === 0) {
    fail("silent-loss arm: expected the landing to be LOST (feat not an ancestor of main), but it landed");
  }
}

// 9. THE REGRESSION THIS FILE ITSELF CAUSED. Run the whole suite as a CHILD with a hook-shaped
//    environment (GIT_DIR and GIT_INDEX_FILE pointing at a real repository) and require that the
//    repository is UNCHANGED afterwards. Without the cleanup in `cleanEnv`, the suite's own
//    `git init`/`add`/`commit` write into that repository -- the fixture plus whatever is staged
//    there -- which is exactly how a stray commit appeared in the shared canonical checkout on
//    2026-10-08. The arm asserts a NEGATIVE: no new commit, no new branch, index unchanged.
//
//    ⚠ The child is marked `CASE_INHERITANCE_CHILD=1` so this arm does NOT recurse: without the
//    marker the child would run arm 9 again, spawn a grandchild, and so on until the process
//    table is exhausted. The marker only skips THIS arm; every other arm still runs in the child,
//    which is what makes the arm meaningful -- it re-runs the real suite under a hook-shaped env.
if (process.env.CASE_INHERITANCE_CHILD !== "1") {
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  writeFileSync(join(repo, "f.txt"), "staged-by-the-caller\n");
  git(repo, ["add", "f.txt"]);
  const headBefore = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
  const indexBefore = git(repo, ["diff", "--cached", "--name-only"]).stdout;
  const branchesBefore = git(repo, ["branch", "--format=%(refname:short)"]).stdout;

  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...cleanEnv(),
      CASE_INHERITANCE_CHILD: "1",
      GIT_DIR: join(repo, ".git"),
      GIT_INDEX_FILE: join(repo, ".git", "index"),
    },
  });
  if (result.status !== 0) {
    fail(`inheritance arm: the suite failed when run with a hook-shaped environment: ${`${result.stdout}${result.stderr}`.trim().split("\n").slice(-3).join(" | ")}`);
  }
  const headAfter = git(repo, ["rev-parse", "HEAD"]).stdout.trim();
  if (headAfter !== headBefore) {
    fail(`inheritance arm: the suite COMMITTED into the repository that ran it (${headBefore.slice(0, 8)} -> ${headAfter.slice(0, 8)}) -- git variables leaked into a child git`);
  }
  const indexAfter = git(repo, ["diff", "--cached", "--name-only"]).stdout;
  if (indexAfter !== indexBefore) {
    fail(`inheritance arm: the suite's stage differs after running: before=[${indexBefore.trim()}] after=[${indexAfter.trim()}]`);
  }
  const branchesAfter = git(repo, ["branch", "--format=%(refname:short)"]).stdout;
  if (branchesAfter !== branchesBefore) {
    fail(`inheritance arm: the suite created a branch in the repository that ran it: before=[${branchesBefore.trim()}] after=[${branchesAfter.trim()}]`);
  }
}

// 10. `core.bare = true` IN THE SHARED CONFIG. This is the incident's second half and it came from
//     this file: a fixture `git` child that inherited GIT_DIR wrote `core.bare = true` and its own
//     `case@test` identity into the canonical checkout's config, after which EVERY worktree
//     sharing that `.git` failed with "this operation must be run in a work tree". The arm
//     requires the guard to name the CONFIG KEY rather than a branch, because a branch-shaped
//     message sends the reader looking for the wrong fault.
{
  const repo = baseRepo();
  created.push(repo);
  created.push(addSecondWorktree(repo));
  git(repo, ["config", "core.bare", "true"]);
  const { status, output } = run(repo);
  if (status === 0) fail("bare arm: expected a non-zero exit when core.bare=true, got 0");
  if (!output.includes("core.bare"))
    fail(`bare arm: expected the guard to name 'core.bare', got: ${output.trim().split("\n")[0]}`);
  if (!output.includes("git config --unset core.bare"))
    fail("bare arm: expected the literal repair line, got none");
}

// ---------------------------------------------------------------------------------------------
for (const dir of created) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* a leftover temp dir is not a case failure */
  }
}

if (failures.length) {
  console.error(`check-canonical-checkout (cases): ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  "check-canonical-checkout (cases): ok (decline at one worktree, detached, non-main branch, clean pass, staged tracked, allowed run output, unexpected untracked, escape hatch, silent-loss consequence, git-env inheritance, core.bare, escape-hatch scope)",
);
