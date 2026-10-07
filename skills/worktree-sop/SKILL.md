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
wait, a stale-holder recovery rule, and a release check tied to the lock token.
Removing the lock does not make a gate valid; it only removes the serialization
guarantee.

Read [`references/gate-lock.md`](references/gate-lock.md) for the contract and
recovery rules.

## Boundary

This skill does not merge on its own, delete a worktree without the inspection
step, or decide a commit's correctness. It makes the worktree decision and the
shared-host resource boundary explicit.
