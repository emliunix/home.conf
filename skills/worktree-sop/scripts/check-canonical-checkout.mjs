#!/usr/bin/env node
// check-canonical-checkout -- refuse to USE or LAND from a canonical checkout that is off `main`.
//
// WHY. `/Users/ppio/Documents/home.conf` is this repository's MAIN worktree and it is SHARED:
// every seat measures there, and `git checkout` in it is a write another seat can race. On
// 2026-10-08 it sat detached at `9c42f014` for ~8.6 minutes while `origin/main` had not yet
// landed that commit and local `main` sat at `1c71b248` throughout. Nothing was lost, but for
// that window the canonical tree read the POST-fix `.gitignore:7` -- so anyone reproducing a
// base-state measurement there would have measured the fixed rule by mistake and called it the
// base. The defect is not the detach; it is that the tree a seat measures is not the tree it
// names.
//
// ⚠ THE SHARPER CONSEQUENCE, MEASURED, AND IT IS WHY THIS IS A LANDING RULE AND NOT A TIDINESS
// ONE. A detached canonical checkout AT MAIN'S OWN COMMIT is accepted by git as a fast-forward
// target -- `git merge --ff-only <feature>` there prints "Fast-forward", updates the working
// tree, and EXITS 0, while the `main` REF DOES NOT MOVE. The landing is silently lost: exit 0,
// a success line, and no commit on `main`. Reproduced in a scratch repo:
//
//     main=c0861dd  HEAD=c0861dd (detached at main's commit)
//     $ git merge --ff-only feat      -> "Updating c0861dd..543ccdc / Fast-forward"  exit 0
//     main=c0861dd  <- DID NOT MOVE    `git merge-base --is-ancestor feat main` -> NO
//
// So this check refuses a detached canonical checkout for two reasons at once: it is the tree
// other seats measure, and a landing from it reports success while moving nothing.
//
// ⚠ VENUE: THE LANDER'S STEP, NOT A HOOK -- AND THAT IS MEASURED, NOT PREFERRED. The natural
// placement would be a `pre-commit` hook, which is the only stage this repository installs
// (`package.json` `prepare`: `prek install -t pre-commit`). Hooks cannot carry this rule:
//
//   | operation                                   | exit | hooks fired  |
//   |---------------------------------------------|------|--------------|
//   | `git merge --ff-only <ref>`                 |  0   | post-merge   |   <- post-hoc, cannot block
//   | `git pull --ff-only`                        |  0   | (none)       |
//   | `git checkout <branch>` (the actual cause)   |  1   | post-checkout|   <- branch had ALREADY moved
//   | `git commit`                                |  1   | pre-commit   |   <- the only blockable one
//
// `pre-commit` does not fire on any landing operation, and the `post-*` hook that does fire runs
// AFTER the ref has moved, so a non-zero exit cannot undo it (measured: a `post-checkout` exiting
// 1 still left the branch switched). A guard that cannot refuse is decoration. This is therefore
// a LANDING-TIME PRE-FLIGHT, run by whoever lands, beside `gate-lock.mjs` -- the other step this
// repository asks a lander to run by hand. CI is not a venue either: `.github/workflows/` checks
// out into a single worktree, so a roster entry would redden every pull request on a shape that
// pull request does not have.
//
// ⚠ AND THE PREDICATE DECLINES WHERE IT DOES NOT APPLY. With `git worktree list` showing exactly
// ONE worktree there is no second seat to race and no shared tree to protect -- a fresh clone, a
// CI runner, or the owner's single checkout. That shape DECLINES (`SKIP:`) rather than failing.
// A check that reddens a shape its own rule allows is a check people learn to work around.
//
// WHAT IT CHECKS. It inspects the MAIN worktree -- not the one it is invoked from, because the
// hazard is the shared tree and not the caller's -- and refuses when that tree is off `main`, or
// carries a staged/modified TRACKED file, which is a landing half-done in a shared tree.
//
// OFFLINE. `git worktree list` and `git status` read local state only. No network call.
//
// Run: node skills/worktree-sop/scripts/check-canonical-checkout.mjs
//      ALLOW_CANONICAL_OFF_MAIN=1 node ...check-canonical-checkout.mjs   (intentional maintenance)

import { execFileSync } from "node:child_process";

const ALLOW_ENV = "ALLOW_CANONICAL_OFF_MAIN";
const EXPECTED_BRANCH = "main";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** The MAIN worktree, resolved by PATH rather than by list order: git prints the current
 *  worktree first when it is the main one, and the main one first always because it is the
 *  repository's own directory -- but that is an ordering promise we do not need to depend on.
 *  The main worktree is the one whose path IS the common git dir's parent. */
function mainWorktree() {
  const blocks = git(["worktree", "list", "--porcelain"])
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean);
  let commonDir;
  try {
    commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  } catch {
    return null;
  }
  const repoRoot = commonDir.endsWith("/.git") ? commonDir.slice(0, -"/.git".length) : null;
  if (repoRoot) {
    for (const block of blocks) {
      const path = block.match(/^worktree (.+)$/m)?.[1];
      if (path === repoRoot) return path;
    }
  }
  // The common dir did not end in `/.git`, or no worktree claims that path. Fall back to the
  // first entry -- correct for a bare repository, and the guard's name in `git-common-dir`
  // still points at the right config. No promise is made that the caller is told; it is not
  // told, because in the bare case there is nothing actionable to report beyond the refusal
  // the bareness arm below already gives.
  return blocks[0]?.match(/^worktree (.+)$/m)?.[1] ?? null;
}

/** Untracked paths allowed to sit in the canonical checkout. These are RUN OUTPUT, not work in
 *  progress. A staged or modified TRACKED file is never allowed: that is a landing half-done in
 *  a tree other seats measure. Kept deliberately narrow -- measured on this repository, the
 *  canonical checkout carries no non-ignored untracked path in normal use, and the suite leaves
 *  none behind, so this list exists for generated run output and should grow only with evidence. */
const ALLOWED_UNTRACKED = [/^receipts\/.*\/logs\//];

function countWorktrees() {
  try {
    return git(["worktree", "list", "--porcelain"])
      .split("\n")
      .filter((l) => l.startsWith("worktree ")).length;
  } catch {
    return 0; // unreadable list: handled by the caller, never silently a pass
  }
}

function main() {
  const worktreeCount = countWorktrees();
  const mainPath = mainWorktree();

  if (!mainPath) {
    console.log(
      "check-canonical-checkout: SKIP: no main worktree to inspect (bare repository)",
    );
    process.exit(0);
  }

  // ⚠ DECLINE WHEN THERE IS NOTHING TO RACE. One worktree means no shared checkout: the repo is
  // a single clone (a CI runner, a fresh copy) and the branch it is on is its own business.
  // Failing here would redden every CI job and train readers to ignore the check.
  if (worktreeCount <= 1) {
    console.log(
      `check-canonical-checkout: SKIP: this repository has ${worktreeCount} worktree(s); there is no shared checkout to race`,
    );
    process.exit(0);
  }

  // ⚠ THE ESCAPE HATCH IS SCOPED TO THE DETACH ARM, AND THAT SCOPE IS THE POINT. It answers
  // "is this checkout being off `main` intentional?" -- the maintenance case. It must NOT answer
  // the other two questions, because the person most likely to reach for it is a maintainer
  // working on an ALREADY-BROKEN checkout, which is exactly when `core.bare = true` is live.
  // Measured before this was scoped: with `core.bare = true` set, the bare invocation named the
  // config key and the repair, while `ALLOW_CANONICAL_OFF_MAIN=1` printed `SKIPPED` and exited 0.
  // `core.bare = true` is not a maintenance state -- it means every worktree sharing that `.git`
  // fails `rev-parse` -- and a tracked file left staged in the shared tree is not one either.
  const detachedAllowed = process.env[ALLOW_ENV] === "1";

  // ⚠ BARENESS IS CHECKED FIRST, BECAUSE IT MASKS EVERYTHING. Measured precedent: with
  // `core.bare = true` in the shared config, `git rev-parse --show-toplevel` itself fails, so
  // every branch check below reports "not on main" for a state whose real fault is that the
  // checkout is not a work tree at all -- and the reader looks for a branch problem. The
  // condition has a measured producer: a scratch-fixture `git` child that inherited `GIT_DIR`
  // from a hook wrote `core.bare = true` and its own `case@test` identity into the SHARED
  // config, because that config is per-repository, not per-worktree. The repair is one config
  // key, so the guard names the key and the repair rather than a branch-shaped symptom.
  // (`sandbox-deploy/scripts/check-origin-remote.mjs` refuses the same condition for the same
  // reason, at the same ordering.)
  let isBare = null;
  try {
    isBare = git(["rev-parse", "--is-bare-repository"], mainPath).trim();
  } catch {
    /* reported below as unreadable */
  }
  if (isBare === "true") {
    const gitDir = (() => {
      try {
        return git(["rev-parse", "--git-dir"], mainPath).trim();
      } catch {
        return "<unreadable>";
      }
    })();
    let userEmail = "";
    try {
      userEmail = git(["config", "--get", "user.email"], mainPath).trim();
    } catch {
      /* optional context */
    }
    console.error(
      `check-canonical-checkout: FAIL: ${mainPath} reports \`core.bare = true\` (in ${gitDir}) -- it is not a work tree at all.`,
    );
    console.error(
      "  Every worktree sharing this .git is affected, because the config is per-repository, not per-worktree.",
    );
    console.error(
      `  Measured producer: a scratch-fixture \`git\` child that inherited GIT_DIR from a hook wrote this key into the shared config${userEmail ? ` (a fixture identity \`${userEmail}\` is usually beside it)` : ""}.`,
    );
    console.error("  Fix:   git config --unset core.bare");
    process.exit(1);
  }

  const problems = [];
  const expectedTip = (() => {
    try {
      return git(["rev-parse", "--verify", "--quiet", `${EXPECTED_BRANCH}^{commit}`], mainPath).trim();
    } catch {
      return "";
    }
  })();

  // 1. The branch. A DETACHED head is refused even at main's own commit, because a landing from
  //    it reports success while moving no ref (see the header). A named non-main branch is the
  //    other defect.
  let head = "";
  let branch = null;
  try {
    head = git(["rev-parse", "HEAD"], mainPath).trim();
  } catch {
    /* reported through `head` being empty */
  }
  try {
    branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"], mainPath).trim();
  } catch {
    branch = null; // detached
  }

  const tipNote = expectedTip ? ` (${EXPECTED_BRANCH} is at ${expectedTip.slice(0, 8)})` : "";

  // The escape hatch covers arms 1 and 2 only (the detach / wrong-branch question). It does
  // NOT cover barness, which already refused above, nor the dirty-tracked arm below.
  if (!detachedAllowed) {
    if (branch === null) {
      problems.push(
        `the main worktree is DETACHED at ${head ? head.slice(0, 8) : "<unreadable>"}${tipNote}` +
      ` -- a landing here (\`git merge --ff-only\`) exits 0 and updates the tree while moving NO ref,` +
      ` so the landing is silently lost; and this is the tree other seats measure`,
      );
    } else if (branch !== EXPECTED_BRANCH) {
      problems.push(
        `the main worktree is on branch '${branch}', not '${EXPECTED_BRANCH}'${tipNote}` +
      ` -- another seat's \`git checkout\` there is a write you can race, and the tree no longer` +
      ` matches the branch other seats assume`,
      );
    }
  }

  // 2. The tree. A TRACKED file staged or modified in the shared checkout is a landing half-done
  //    there. Untracked run output under the allowed prefixes is fine.
  // ⚠ `-uall`, NOT the default. Plain `git status --porcelain` COLLAPSES a wholly-untracked
  // directory into a single `?? dir/` line, so a file-level allowlist can never match it and
  // allowed run output under an allowed prefix would redden. Measured: with
  // `receipts/process/logs/check.log` untracked, the default prints `?? receipts/` and `-uall`
  // prints `?? receipts/process/logs/check.log`. A case in the sibling suite caught this.
  try {
    const porcelain = git(["status", "--porcelain", "-uall"], mainPath);
    const dirty = [];
    for (const line of porcelain.split("\n")) {
      if (!line.trim()) continue;
      const code = line.slice(0, 2);
      const path = line.slice(3).replace(/^"|"$/g, "");
      if (code === "??") {
        if (ALLOWED_UNTRACKED.some((re) => re.test(path))) continue;
        dirty.push(`untracked ${path}`);
      } else {
        dirty.push(`${code.trim()} ${path}`);
      }
    }
    if (dirty.length > 0) {
      problems.push(
        `the main worktree has ${dirty.length} uncommitted path(s) that are not allowed run output:` +
          ` ${dirty.slice(0, 5).join(", ")}${dirty.length > 5 ? ", …" : ""}`,
      );
    }
  } catch (error) {
    problems.push(
      `could not read the main worktree's status: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  }

    if (problems.length > 0) {
      console.error(
        `check-canonical-checkout: FAIL: the shared checkout at ${mainPath} is not in a landable state.`,
      );
      for (const problem of problems) console.error(`  - ${problem}`);
      console.error(
        `  Fix: work and land from a linked worktree at an explicit SHA, and leave ${mainPath} on ${EXPECTED_BRANCH}.`,
      );
      if (detachedAllowed) {
        console.error(
          `  Note: ${ALLOW_ENV}=1 is set, which excuses an off-\`${EXPECTED_BRANCH}\` checkout only -- it does not excuse uncommitted tracked work.`,
        );
      } else {
        console.error(`  To proceed anyway (intentional maintenance), re-run with ${ALLOW_ENV}=1.`);
      }
      process.exit(1);
    }

    const skipped = detachedAllowed ? ` [${ALLOW_ENV}=1: off-${EXPECTED_BRANCH} allowed]` : "";
    console.log(
      `check-canonical-checkout: OK: the shared checkout at ${mainPath} is on ${EXPECTED_BRANCH} (${head.slice(0, 8)}) and clean beyond allowed run output.${skipped}`,
    );
}

main();
