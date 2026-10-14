#!/usr/bin/env node
// resolve-write-target -- say WHERE a path really lives before you write to it.
//
// WHY. `~/.agents/skills/<name>` reads as the agent's own skill directory. It is not: 80 of its 88
// entries are SYMLINKS, and 79 of those resolve into a SHARED PRIMARY checkout (`pstack` 53,
// `home.conf` 25, `sandbox-reploy` 1 -- measured 2026-10-14). So editing what looks like your own
// file writes into a repository's MAIN worktree, which every seat measures from and shares.
//
// On 2026-10-14 exactly that happened: a 19-line edit through `~/.agents/skills/record-conventions`
// dirtied `home.conf`'s main worktree. It was reverted and nothing was lost, but the path gave no
// signal, and the intent was ordinary.
//
// ⚠ THIS IS NOT THE CANONICAL-CHECKOUT GUARD, AND MUST NOT BE FOLDED INTO IT.
// `check-canonical-checkout.mjs` guards REFS: it refuses a DETACHED shared checkout because landing
// from one prints "Fast-forward", exits 0, and moves no ref -- the landing is silently lost. Its
// subject is the ref. An uncommitted in-place edit moves NO REF and never reaches it, so extending
// that guard to cover this would produce a check whose subject does not include the failure.
// This is a PATH-RESOLVABILITY check; that one is a LANDING check. They share a directory, not a
// subject.
//
// WHAT IT DOES. Resolves a path through every symlink to its real target, and reports whether that
// target is inside a repository's SHARED MAIN worktree. It exits 0 for a target in the agent's own
// space or a linked worktree, and 1 for a target in a shared main worktree -- because that write is
// repository work and owes the repository's flow (card -> linked worktree -> branch -> land),
// whichever path you typed to get there.
//
// USAGE
//   node resolve-write-target.mjs <path> [<path>...]
//   node resolve-write-target.mjs ~/.agents/skills/record-conventions/SKILL.md
//   node resolve-write-target.mjs --quiet <path>     # exit code only

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";

const QUIET = process.argv.includes("--quiet");
const paths = process.argv.slice(2).filter((a) => a !== "--quiet");

if (paths.length === 0) {
  console.error("usage: resolve-write-target.mjs [--quiet] <path> [<path>...]");
  process.exit(2);
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** The nearest existing ancestor -- a write target may not exist yet. */
function nearestExisting(p) {
  let cur = resolvePath(p);
  for (;;) {
    if (existsSync(cur)) return cur;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

/** Does `p` name a symlink, or sit under one? Both routes land in the same place. */
function symlinkPrefixes(p) {
  const out = [];
  let cur = resolvePath(p);
  for (;;) {
    const parent = dirname(cur);
    if (parent === cur) break;
    try {
      if (statSync(parent).isDirectory() && existsSync(parent)) {
        const raw = realpathSync(parent);
        if (raw !== parent) out.push({ from: parent, to: raw });
      }
    } catch {
      /* unreadable ancestor: reported by the resolution step below */
    }
    cur = parent;
  }
  return out;
}

/**
 * Classify the real target.
 *  - "shared-main"  : inside a repo whose --git-dir == --git-common-dir (the PRIMARY worktree)
 *  - "worktree"     : inside a LINKED worktree (its own git dir), which is what a seat should use
 *  - "local"        : not inside any repository
 */
function classify(target) {
  // ⚠ Ask git about a DIRECTORY. `git -C <file>` fails with "not a directory", and the failure is
  // silent here (git() swallows stderr) -- so a file target classifies as "local", which is the
  // dangerous answer. Use the nearest existing DIRECTORY containing the target.
  let dir = target;
  try {
    if (!statSync(dir).isDirectory()) dir = dirname(dir);
  } catch {
    dir = dirname(dir);
  }
  // ⚠ `--path-format=absolute` IS LOAD-BEARING, and the naive version silently inverts the answer.
  // Without it, `--git-common-dir` returns a RELATIVE path (`../../.git` from a subdirectory), so
  // resolving it against `--show-toplevel` yields `/Users/ppio/Documents/.git` -- a DIFFERENT string
  // from `--git-dir`'s `.git`, which classified the SHARED MAIN checkout as a "worktree" and told
  // the caller it was safe to write. Measured on git 2.50.1: the flag needs git >= 2.31.
  const root = git(["rev-parse", "--show-toplevel"], dir);
  const gitDir = git(["rev-parse", "--path-format=absolute", "--git-dir"], dir);
  if (gitDir === null || root === null) return { kind: "local", root: null, gitDir: null };
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], dir);
  // The PRIMARY worktree reports the same directory for both; a LINKED worktree's git dir is a
  // per-worktree subdirectory under the common one.
  return { kind: common === gitDir ? "shared-main" : "worktree", root, gitDir };
}

let failures = 0;

for (const input of paths) {
  const anchor = nearestExisting(input);
  if (anchor === null) {
    console.log(`${input}\n  cannot resolve: no existing ancestor`);
    failures += 1;
    continue;
  }
  const real = realpathSync(anchor);
  const links = symlinkPrefixes(input);
  const { kind, root } = classify(real);

  if (!QUIET) {
    console.log(`${input}`);
    console.log(`  resolves to  ${real}`);
    for (const l of links) console.log(`  via symlink  ${l.from} -> ${l.to}`);
  }

  if (kind === "local") {
    if (!QUIET) console.log("  target       AGENT-LOCAL -- not inside any repository. OK to write.");
  } else if (kind === "worktree") {
    if (!QUIET) console.log(`  target       LINKED WORKTREE of ${root} -- a seat's own tree. OK to write.`);
  } else {
    if (links.length > 0 && !QUIET) {
      console.log(
        `  target       ⚠ SHARED MAIN CHECKOUT of ${root}\n` +
          "               the path above is a symlink into it, so this write is REPOSITORY WORK.",
      );
    } else if (!QUIET) {
      console.log(`  target       ⚠ SHARED MAIN CHECKOUT of ${root}`);
    }
    if (!QUIET) {
      console.log(
        "               Do not edit in place: card -> linked worktree -> branch -> land.\n" +
          "               (This is a path check, not the canonical-checkout guard; that one guards refs.)",
      );
    }
    failures += 1;
  }
}

process.exit(failures > 0 ? 1 : 0);
