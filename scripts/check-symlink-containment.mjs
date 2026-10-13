#!/usr/bin/env node
// Claim: no tracked symlink escapes the repository root.
//
// Predicate: a tracked path of mode `120000` whose RESOLVED target lies outside
// the repository root.
//   exit 0  no escaping symlink
//   exit 1  one or more (a finding)
//   exit 2  the instrument could not run or could not go red (not a gate)
//
// Why containment and not absoluteness: a RELATIVE target that climbs out
// (`../../outside`) leaks a host path just as effectively, and is the more
// natural `ln -s` form. Measured in card #270:
//   skills/relative-escape  blob=../../outside      absoluteness MISSES, containment CATCHES
//   skills/absolute-escape  blob=/var/folders/...   both catch
//   skills/internal-ok      blob=real               both correctly allow
//
// Claim difference from `check-tracked-ignored.mjs` (its neighbour, deliberately
// NOT broadened to cover this): that guard's subject is "tracked AND ignored";
// this one's is containment. Different subjects, different checks.
//
// WARNING: FIXTURE COMMANDS RUN WITH EVERY INHERITED `GIT_*` VARIABLE REMOVED.
// This script lives beside `check-tracked-ignored.mjs` and had the same defect:
// `Git` exports absolute `GIT_DIR`/`GIT_INDEX_FILE` in a linked worktree and
// `prek` passes them through, so a fixture that inherits them initialises and
// commits into the CALLER's repository. Card #271 owns the shared diagnosis.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const FIXTURE_ENV = (() => {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("GIT_")) env[key] = value;
  }
  env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_CONFIG_SYSTEM = "/dev/null";
  return env;
})();

function git(args, cwd, env = FIXTURE_ENV) {
  // stderr is captured rather than inherited: a probe that legitimately fails on
  // a non-repository must not emit Git's own "not a git repository" noise ahead
  // of this check's typed NOT A GATE line.
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** True only inside a work tree. An instrument that cannot run is NOT a finding. */
export function isRepo(root) {
  try {
    return git(["rev-parse", "--is-inside-work-tree"], root).trim() === "true";
  } catch {
    return false;
  }
}

/** Tracked symlinks as [path, blobContent]. Derived from the index, never a glob. */
export function trackedSymlinks(root) {
  const out = git(["ls-files", "-s"], root);
  const rows = [];
  for (const line of out.split("\n")) {
    if (!line) continue;
    const match = /^(\d{6}) ([0-9a-f]+)\s+\d+\t(.*)$/.exec(line);
    if (!match || match[1] !== "120000") continue;
    rows.push([match[3], git(["cat-file", "-p", `:${match[3]}`], root)]);
  }
  return rows;
}

/** realpath the deepest EXISTING ancestor and re-append the rest.
 *
 * `realpathSync` throws on a missing path, and a dangling link is exactly the
 * case this guard must judge -- so the honest answer is "the closest true
 * location that exists", not a crash.
 */
export function realpathDeep(input) {
  let head = input;
  const tail = [];
  for (;;) {
    try {
      return resolve(realpathSync(head), ...tail.reverse());
    } catch {
      const parent = resolve(join(head, ".."));
      if (parent === head) return input;
      tail.push(head.slice(parent.length + 1));
      head = parent;
    }
  }
}

/** Does the link's RESOLVED target leave the repository root?
 *
 * BOTH sides must be resolved. On macOS `/var` is a symlink to `/private/var`,
 * so a raw `$TMPDIR` root (`/var/folders/...`) and a realpath'd target
 * (`/private/var/folders/...`) compare as different trees. Resolving only the
 * root makes every legitimate ABSOLUTE link under the alias look like an escape;
 * resolving only the target makes every legitimate RELATIVE link look like one.
 * A raw root and a raw relative target are equally wrong on the other side. Both
 * false positives were measured in card #270, which is why the self-test carries
 * one positive fixture for each direction.
 */
export function escapes(root, linkPath, blob) {
  const rootReal = realpathDeep(resolve(root));
  const linkAbs = resolve(rootReal, linkPath);
  const target = realpathDeep(resolve(join(linkAbs, ".."), blob));
  const rel = relative(rootReal, target);
  return rel.startsWith("..") || isAbsolute(rel);
}

export function findings(root) {
  const hits = [];
  for (const [linkPath, blob] of trackedSymlinks(root)) {
    if (escapes(root, linkPath, blob)) hits.push([linkPath, blob]);
  }
  return hits;
}

// Every arm is named so a failure says which predicate broke, not just "red".
function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), "symlink-containment-"));
  const outside = mkdtempSync(join(tmpdir(), "symlink-containment-outside-"));
  try {
    git(["init", "-q"], dir);
    git(["config", "user.email", "fixture@example.invalid"], dir);
    git(["config", "user.name", "fixture"], dir);
    mkdirSync(join(dir, "skills", "real"), { recursive: true });
    writeFileSync(join(dir, "skills", "real", "f"), "x\n");
    mkdirSync(join(dir, "nested", "a", "b"), { recursive: true });

    // must be CAUGHT
    symlinkSync("../../outside", join(dir, "skills", "relative-escape"));
    symlinkSync(outside, join(dir, "skills", "absolute-escape"));
    symlinkSync("../../outside-missing", join(dir, "skills", "dangling-relative"));
    symlinkSync(join(outside, "missing"), join(dir, "skills", "dangling-absolute"));
    symlinkSync("../../../../etc", join(dir, "nested", "a", "b", "nested-escape"));

    // must be ALLOWED
    symlinkSync("real", join(dir, "skills", "internal-relative"));
    // The alias arm: an ABSOLUTE link pointing INSIDE the repo, written through
    // the raw (unrealpath'd) root. On macOS `/var` -> `/private/var`, so this
    // reddens if the target is resolved but the root is not.
    symlinkSync(join(dir, "skills", "real"), join(dir, "skills", "internal-absolute-alias"));

    git(["add", "-A"], dir);
    git(["commit", "-qm", "fixture"], dir);

    const caught = new Set(findings(dir).map(([p]) => p));
    const expectations = [
      ["skills/relative-escape", true],
      ["skills/absolute-escape", true],
      ["skills/dangling-relative", true],
      ["skills/dangling-absolute", true],
      ["nested/a/b/nested-escape", true],
      ["skills/internal-relative", false],
      ["skills/internal-absolute-alias", false],
    ];
    const missed = expectations.filter(([p, expectCaught]) => caught.has(p) !== expectCaught);
    if (missed.length > 0) {
      process.stderr.write(
        `check-symlink-containment: NOT ARMED -- predicate disagrees on ${missed.length} arm(s)\n` +
          `  caught: ${JSON.stringify([...caught])}\n`,
      );
      for (const [p, expectCaught] of missed) {
        process.stderr.write(`  ${p}: expected ${expectCaught ? "CAUGHT" : "ALLOWED"}\n`);
      }
      return 2;
    }
    return 0;
  } finally {
    rmSync(outside, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const root = argv.includes("--root") ? argv[argv.indexOf("--root") + 1] : process.cwd();
  const onlyProbe = argv.includes("--self-test");
  const onlyRepo = argv.includes("--no-self-test");

  if (!onlyRepo) {
    const armed = selfTest();
    if (armed !== 0) return armed;
    if (onlyProbe) {
      process.stdout.write("check-symlink-containment: armed\n");
      return 0;
    }
  }

  // An instrument that cannot run must NOT report a finding (exit 1) and must
  // not crash. Exit 2 = "not a gate", the same contract as its neighbour.
  if (!isRepo(root)) {
    process.stderr.write(`check-symlink-containment: NOT A GATE -- ${root} is not a git work tree\n`);
    return 2;
  }

  const resolvedRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: root,
    encoding: "utf8",
    env: FIXTURE_ENV,
  }).trim();
  const hits = findings(resolvedRoot);
  if (hits.length === 0) {
    process.stdout.write("check-symlink-containment: no tracked symlink escapes the repository\n");
    return 0;
  }
  process.stderr.write("check-symlink-containment: tracked symlinks escape the repository\n");
  for (const [linkPath, blob] of hits) {
    process.stderr.write(`  ${linkPath} -> ${blob}\n`);
  }
  return 1;
}

process.exit(main());
