# Worktree lifecycle

## Required card fields

Every goal design slot or task card that edits tracked files carries:

```text
WORKTREE. required | not-needed. <reason>. Base/ref: <commit or ref>.
ACCEPTANCE. ... merge/replay; target verification; cleanup.
```

The field is not implicit. A branch name alone is not a base: name the commit
or ref the worktree was created from.

## Create and prove

Use a linked worktree, never a standalone clone for repository work:

```bash
git worktree add --detach /private/tmp/<name> <base-ref>
```

Before editing, record:

```bash
git -C /private/tmp/<name> rev-parse HEAD^{tree}
git -C /private/tmp/<name> status --short --branch
```

The base/ref and tree identity make the review object reproducible. If a
branch is created, name both the branch and the commit it points at.

## Work and gate

Run the card's named acceptance gate against the worktree revision. For a
shared-host heavy gate, use the gate lock in [`gate-lock.md`](gate-lock.md).
A gate report names the revision, population, command, and exit code it read.

## Merge or replay

Merge or replay the reviewed object to the card's target ref. Re-derive the
target's tip and tree after the operation; do not infer success from a branch
name or a clean diff. If the target moved, reconcile before claiming landing.

## Target verification

Verify the target contains the reviewed object:

- tip and tree are readable;
- the reviewed commit or equivalent patch is reachable;
- the changed blobs match the reviewed object.

Push, review, and merge are three different states. A card says which state it
reached.

## Cleanup gate

Before removing a worktree, inspect:

```bash
git -C /private/tmp/<name> status --short --ignored
git -C /private/tmp/<name> rev-parse HEAD
```

Also inspect live processes whose working directory or open files resolve into
the worktree. A service using a deleted inode is down, not cleanly removed.

Cleanup evidence is one line: the worktree path, reviewed tip, tracked/untracked
state, live-process check, and removal command. If cleanup cannot run, name the
owner and lift condition; do not call the card done.

## Existing authority

`scheduled-tracker` already requires one writer per tree and tracker
reconciliation; `reviewer-seat` already names clean-checkout and worktree
reproducibility. This reference owns the shared lifecycle and points to those
seats rather than replacing their reporting duties.
