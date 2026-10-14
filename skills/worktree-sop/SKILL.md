---
name: worktree-sop
description: >-
  Use when a goal or task card can edit a repository, when deciding whether a
  linked worktree is required, or when running a heavy repository gate on a
  shared host. Defines the worktree field, lifecycle, cleanup evidence, and the
  minimal host-level gate lock.
---

# Worktree SOP

Use this skill before creating or amending a goal file or task card that can
edit tracked files. It owns the worktree lifecycle and the heavy-gate
serialization surface; the goal and task templates point here rather than
restating the rules.

## Worktree decision

Every repository-editing goal or task states:

```text
WORKTREE. required | not-needed. <reason>. Base/ref: <commit or ref>.
```

Use `required` when the work needs an isolated branch, a frozen base, a
reviewable object, or a place to run a gate without changing the caller's
checkout. Use `not-needed` only when the edit is confined to an administrative
surface whose owner accepts in-place work, and name the base/ref that makes the
edit reviewable.

The lifecycle is:

1. create the linked worktree from the named base/ref;
2. prove the revision and tree identity;
3. perform the work;
4. run the named acceptance gate;
5. merge or replay to the named target ref;
6. verify the target contains the reviewed object;
7. inspect untracked and ignored files plus live processes using the tree;
8. remove the worktree.

A required-worktree card is not `done` at push or green review. Its acceptance
must include merge, target verification, and cleanup, or name the owner and
lift condition for the step that cannot run.

Read [`references/worktree-lifecycle.md`](references/worktree-lifecycle.md) for
the exact checks and cleanup evidence.

## Heavy gates

A heavy gate is a resource on the host, not a correctness authority. Run it
under one lock so two processes cannot overlap:

```bash
node skills/worktree-sop/scripts/gate-lock.mjs -- pnpm check
```

Each attempt reports its own exit code and receipt. The lock has a bounded
wait, an **atomic publish** so the lock path is never partially written, a
three-way holder classification (**missing** retries the create, **unparseable** —
including parseable files that are not lock metadata — is honoured until it ages
out, **parsed** waits unless the holder is dead or aged), a recovery that serializes
its decision behind a short exclusive claim (so two reclaimers cannot act on one stale
observation), claims the entry by rename so it can neither evict a successor nor
clobber one on restore, and a release that never unlinks the shared path.
Removing the lock does not make a gate valid; it only removes the serialization
guarantee.

Read [`references/gate-lock.md`](references/gate-lock.md) for the contract and
recovery rules.

## Reaching a shared tree by a path that does not name it

**A symlink makes a shared path look personal.** On 2026-10-14 an ordinary-looking edit through
`~/.agents/skills/record-conventions` dirtied `home.conf`'s main worktree: that path is a **symlink**
into the shared checkout. Measured then: **80 of the 88 entries under `~/.agents/skills` are symlinks,
and 79 resolve into a SHARED PRIMARY worktree** (`pstack` 53, `home.conf` 25, `sandbox-deploy` 1).
Nothing in the path says which repository it lands in.

**Resolve a write target to its real location before writing, and treat a shared main worktree as
repository work** however you got there:

```bash
node "$HOME/Documents/home.conf/skills/worktree-sop/scripts/resolve-write-target.mjs" <path>...
```

It prints the real target, any symlink it passed through, and one of three verdicts — **shared main
checkout** (refuse; use card → linked worktree → branch → land), **linked worktree** (a seat's own
tree), **agent-local** (outside any repository). A refusal exits 1, so it composes with `&&`.

⚠ **This is a PATH check, not a landing check, and it is NOT the canonical-checkout guard.** That
guard's subject is the **ref**, and its venue is the lander's pre-flight: it refuses a *detached*
shared checkout because a landing from one prints `Fast-forward`, exits 0, and moves no ref. **An
in-place edit moves no ref and never reaches it** — so the guard's subject covers a dirty shared tree
when it runs, but nothing runs it on an edit that never lands. Do not wire this case into
`cb/home-conf-guards`; the two share a directory, not a subject.

⚠ **A PROJECT SKILL MUST STAY A PROJECT SKILL.** When two roots both carry a skill of the same name,
the one under the PROJECT (`.agents/skills/` inside the project) is the project's, and exposing it through
a global skills root is wrong regardless of who owns the repository — owner directive, 2026-10-14
(msg `67a2b45b`): *"project skills should stay as project skills only."* The live instance is
`project-reviewer-seat`, a **tracked** file in `sandbox-deploy` (`.agents/skills/project-reviewer-seat/`)
that `~/.agents/skills/project-reviewer-seat` symlinks to. **Edit the project copy in the project; do
not treat the global alias as the editable one, and do not add a global alias for a project skill.**

⚠ **Third-party links are a different case again.** The 53 `pstack` targets are not this project's to
edit at all; treat them as read-only unless a fork/ownership decision says otherwise. **The three
classes are distinct: third-party read-only · project-local (edit in the project) · home.conf's own
(repository flow).**

## The canonical checkout

The repository's MAIN worktree is shared, so every seat measures there and a
`git checkout` in it is a write another seat can race. Landing is done from a
linked worktree at an explicit SHA; the main checkout stays on `main`. Before
landing, refuse the land if the shared tree is off it:

```bash
node "$HOME/Documents/home.conf/skills/worktree-sop/scripts/check-canonical-checkout.mjs"
```

**The path names the repo that OWNS the guard, not the repo being guarded.** The
guard inspects the main worktree of the repository it is **run from**, so the
same command is correct for a `home.conf` lander and for a lander in any other
repo that adopts this rule -- run it from the repo you are landing in. A
repo-relative path was the defect this replaced: in `agent-substrate` it resolved
against `home.conf`, silently importing `home.conf`'s run-output allowlist into a
repo whose run output is `worklog/`, and refused 1129 legitimate paths.

**⚠ Each guarded repository declares its own run output, and an undeclared
repository is REFUSED.** The declaration is `.worktree-sop.json` at the
repository root, committed (an untracked declaration is itself untracked drift):

```json
{ "allowed_untracked": ["^receipts/.*/logs/"] }
```

The guard refuses a repository with no declaration, naming the file to create. It
does **not** treat absence as "allow everything" (the guard would stop guarding)
or "allow nothing" (every ordinary path reddens and readers learn to work
around). It is JSON, not YAML, because the guard imports only `node:` builtins --
it runs in a fresh worktree with no `node_modules`, which is exactly where a
parser dependency would break it.

It declines (`SKIP:`) where there is no shared checkout -- a single worktree, a
CI runner. `ALLOW_CANONICAL_OFF_MAIN=1` excuses an off-`main` checkout for
intentional maintenance; it does **not** excuse `core.bare = true`, a tracked
file left staged, or a missing declaration, because those are not maintenance
states -- and the guard does not offer the hatch beside a refusal it cannot
clear. Read [`references/worktree-lifecycle.md`](references/worktree-lifecycle.md)
for the lifecycle this guards.
  
⚠ **This guard refuses nothing on its own.** It is a convention: prose here, plus
a command a lander runs by hand. Nothing invokes it automatically, and a lander
who skips the command lands exactly as before. That is the deliberate choice --
no hook can carry the rule (see below) -- but it means the guard's value is
entirely in whether it is run, and the record already shows a convention here
being bypassed under pressure. Treat "run the guard" as part of landing, not as
a check that will catch you.
  
The mutation table is the same: `tests/check-canonical-checkout-mutations.mjs`
proves each case is load-bearing, and it runs at the lander's step rather than in
the commit hook, because its M6 arm must re-run the case suite nested and costs
minutes where the cases cost seconds.
  
⚠ This is a LANDER'S STEP, not a hook, and that is measured rather than
preferred: `pre-commit` -- the only stage this repository installs -- does not
fire on `git merge --ff-only` or `git pull --ff-only`, and the `post-*` hooks
that do fire run after the ref has already moved, so their exit code cannot undo
it. A detached shared checkout is refused even at `main`'s own commit, because a
landing from it exits 0 and reports `Fast-forward` while **moving no ref**.

## Boundary

This skill does not merge on its own, delete a worktree without the inspection
step, or decide a commit's correctness. It makes the worktree decision and the
shared-host resource boundary explicit.
