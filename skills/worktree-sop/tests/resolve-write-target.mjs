#!/usr/bin/env node
// Cases for `scripts/resolve-write-target.mjs` (task #307).
//
// WHAT THIS SUITE IS FOR. The check exists because `~/.agents/skills/<name>` reads as the agent's own
// skill directory while 80 of its 88 entries are symlinks, 79 of which resolve into a SHARED PRIMARY
// checkout. Editing through such a path writes into a repository's main worktree.
//
// A suite cannot show its own cases are load-bearing -- a case that passes because the check never ran
// looks identical to one that passes because the check agreed. That is what
// `resolve-write-target-mutations.mjs` is for, and it is the in-repo precedent
// (`check-canonical-checkout-mutations.mjs`, `resolve-write-target-mutations.mjs`).
//
// FIXTURES ARE BUILT HERE, not borrowed from the operator's machine: a scratch dir with a real primary
// repo, a real linked worktree, and a symlink pointing at each. Borrowing `~/.agents/skills` would make
// the suite depend on the operator's layout and would mean the suite's verdicts change when they do.

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = resolve(HERE, "..", "scripts", "resolve-write-target.mjs");

let failures = 0;
const results = [];

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}

function run(args) {
  const r = spawnSync("node", [CHECK, ...args], { encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function case_(name, fn) {
  try {
    fn();
    results.push(["PASS", name]);
  } catch (err) {
    failures += 1;
    results.push(["FAIL", `${name}\n    ${err.message}`]);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── fixture ───────────────────────────────────────────────────────────────────────────────────────
const SCRATCH = mkdtempSync(join(tmpdir(), "rw-target-"));
const PRIMARY = join(SCRATCH, "shared-repo");
const LINKED = join(SCRATCH, "seat-worktree");
const LOCAL = join(SCRATCH, "agent-local");
const VIA_LINK_PRIMARY = join(SCRATCH, "skill-link-into-primary");
const VIA_LINK_LINKED = join(SCRATCH, "skill-link-into-worktree");

function buildFixture() {
  mkdirSync(PRIMARY, { recursive: true });
  git(["init", "-q", "-b", "main"], PRIMARY);
  git(["config", "user.email", "t@example.com"], PRIMARY);
  git(["config", "user.name", "T"], PRIMARY);
  writeFileSync(join(PRIMARY, "tracked.txt"), "x\n");
  git(["add", "-A"], PRIMARY);
  git(["commit", "-q", "-m", "base"], PRIMARY);
  git(["worktree", "add", "-q", "-b", "seat/t1", LINKED], PRIMARY);
  mkdirSync(LOCAL, { recursive: true });
  writeFileSync(join(LOCAL, "mine.txt"), "mine\n");
  // A symlink whose TARGET is the shared primary, and one whose target is a LINKED worktree. These
  // are the two shapes the check must tell apart, and shape 1 is the one that bit us.
  symlinkSync(join(PRIMARY, "tracked.txt"), VIA_LINK_PRIMARY);
  symlinkSync(join(LINKED, "tracked.txt"), VIA_LINK_LINKED);
}

try {
  buildFixture();

  // ── the fixture itself is a precondition ────────────────────────────────────────────────────────
  case_("fixture: the primary reports git-dir == git-common-dir", () => {
    const g = git(["rev-parse", "--path-format=absolute", "--git-dir"], PRIMARY);
    const c = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], PRIMARY);
    assert(g === c, `primary git-dir ${g} != common-dir ${c} -- the fixture is not a primary`);
  });

  case_("fixture: the linked worktree reports git-dir != git-common-dir", () => {
    const g = git(["rev-parse", "--path-format=absolute", "--git-dir"], LINKED);
    const c = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], LINKED);
    assert(g !== c, `linked git-dir ${g} == common-dir ${c} -- the fixture is not a linked worktree`);
  });

  // ── refusals ────────────────────────────────────────────────────────────────────────────────────
  case_("a symlink INTO the shared primary REFUSES", () => {
    const r = run([VIA_LINK_PRIMARY]);
    assert(r.status === 1, `expected refusal, got exit ${r.status}: ${r.out}`);
    assert(/SHARED MAIN CHECKOUT/.test(r.out), `expected the shared-main verdict; got: ${r.out}`);
  });

  case_("the primary DIRECTLY REFUSES", () => {
    const r = run([join(PRIMARY, "tracked.txt")]);
    assert(r.status === 1, `expected refusal, got exit ${r.status}`);
    assert(/SHARED MAIN CHECKOUT/.test(r.out), `wrong verdict: ${r.out}`);
  });

  case_("a file inside the primary's SUBDIRECTORY refuses (path-format regression arm)", () => {
    // ⚠ THIS ARM EXISTS FOR A MEASURED DEFECT. Without `--path-format=absolute`, `--git-common-dir`
    // returns `../../.git` from a subdirectory; resolving it against the toplevel yields a DIFFERENT
    // string from `--git-dir`, so the SHARED PRIMARY classified as a safe "worktree". The defect is
    // invisible when the target is the repo ROOT (both resolve to `.git`) and only appears below it.
    mkdirSync(join(PRIMARY, "sub", "deeper"), { recursive: true });
    writeFileSync(join(PRIMARY, "sub", "deeper", "f.txt"), "y\n");
    const r = run([join(PRIMARY, "sub", "deeper", "f.txt")]);
    assert(r.status === 1, `a subdirectory target must refuse; got exit ${r.status}`);
    assert(/SHARED MAIN CHECKOUT/.test(r.out), `wrong verdict below the root: ${r.out}`);
  });

  // ── allowances ──────────────────────────────────────────────────────────────────────────────────
  case_("a symlink INTO a linked worktree is ALLOWED", () => {
    const r = run([VIA_LINK_LINKED]);
    assert(r.status === 0, `expected allow, got exit ${r.status}: ${r.out}`);
    assert(/LINKED WORKTREE/.test(r.out), `expected the linked verdict; got: ${r.out}`);
  });

  case_("an AGENT-LOCAL path outside any repo is ALLOWED", () => {
    const r = run([join(LOCAL, "mine.txt")]);
    assert(r.status === 0, `expected allow, got exit ${r.status}`);
    assert(/AGENT-LOCAL/.test(r.out), `expected the local verdict; got: ${r.out}`);
  });

  case_("a path that does not exist YET resolves via its nearest ancestor", () => {
    const r = run([join(LOCAL, "nested", "new-file.md")]);
    assert(r.status === 0, `expected allow, got exit ${r.status}: ${r.out}`);
    assert(/AGENT-LOCAL/.test(r.out), `expected the local verdict; got: ${r.out}`);
  });

  case_("a not-yet-existing file inside the primary still REFUSES", () => {
    const r = run([join(PRIMARY, "sub", "brand-new.md")]);
    assert(r.status === 1, `expected refusal, got exit ${r.status}: ${r.out}`);
    assert(/SHARED MAIN CHECKOUT/.test(r.out), `wrong verdict: ${r.out}`);
  });

  // ── interface ───────────────────────────────────────────────────────────────────────────────────
  case_("several paths: one refusal makes the run exit 1", () => {
    const r = run([join(LOCAL, "mine.txt"), VIA_LINK_PRIMARY]);
    assert(r.status === 1, `a mixed run must refuse; got exit ${r.status}`);
  });

  case_("--quiet emits nothing and keeps the exit code", () => {
    const r = run(["--quiet", VIA_LINK_PRIMARY]);
    assert(r.status === 1, `--quiet must keep the refusal exit; got ${r.status}`);
    assert(r.out.trim() === "", `--quiet must be silent; got: ${r.out}`);
  });

  case_("a BARE repository REFUSES rather than reading as agent-local", () => {
    // ⚠ THIS ARM EXISTS BECAUSE THE DEFECT HAPPENED, not because it is imaginable. On 2026-10-14 the
    // real home.conf sat with `core.bare=true` (card #308) and `--show-toplevel` began failing; the
    // check folded that failure into "no repository" and printed "AGENT-LOCAL -- OK to write" for a
    // path inside the shared checkout. The fixture suite was GREEN through it -- every fixture repo is
    // non-bare -- so this arm builds the bare state deliberately.
    const bare = mkdtempSync(join(tmpdir(), "rw-bare-"));
    try {
      git(["init", "-q", "--bare", bare], SCRATCH);
      const r = run([bare]);
      assert(r.status === 1, `a bare repo must refuse; got exit ${r.status}: ${r.out}`);
      assert(/BARE REPOSITORY/.test(r.out), `expected the bare verdict; got: ${r.out}`);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  case_("no arguments is a usage error (exit 2), not a silent pass", () => {
    const r = run([]);
    assert(r.status === 2, `expected usage exit 2, got ${r.status}`);
  });
} finally {
  rmSync(SCRATCH, { recursive: true, force: true });
}

for (const [verdict, name] of results) console.log(`  ${verdict}  ${name}`);
console.log(`\n${results.filter(([v]) => v === "PASS").length}/${results.length} cases pass`);
process.exit(failures > 0 ? 1 : 0);
