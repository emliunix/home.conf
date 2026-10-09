# Seat: repository hygiene

Use when your seat owns the daily sweep for linked worktrees and branches across
repositories in active work. The bias to correct for is that a checkout is
usually assumed to be either active or disposable; both readings are made from
outside, and either can strand reviewed work or delete an unlanded change.

## The five checks, as the hygiene seat

1. **Routine check — every configured repository, not the current one.** Read the
   active-work list and inventory each repository's worktrees, local branches,
   remote branches, and remote target. A repository omitted from the host config
   is an unowned population, not a clean one.
2. **High-level understanding — state the two deletion boundaries.** Worktrees
   are checkout containers; branches are commit names. A worktree can be removed
   after its checkout is safe, while a branch can be deleted only after its tip
   is safely represented by the target. Removing either proves nothing about the
   other.
3. **Goal clarity — name the closing evidence for each candidate.** A worktree
   is safe to remove only after its tracked and untracked state, reachability,
   and live-process use are inspected. A branch is safe to delete only when its
   commits are reachable from the target or patch-equivalent there, and its
   lane owner or card no longer needs it.
4. **Work-item progress — one disposition per object.** Classify every worktree
   and branch as active, merge-ready, cleanup candidate, or unowned/stale. Name
   the card/owner and next observable result for each non-clean classification.
   "No one mentioned it" is not a disposition.
5. **Process defect review — do not let branch names answer reachability.** A
   local branch's name is not evidence that its tip is on the target, and a
   remote branch's existence is not evidence that an owner still needs it. Test
   the commit relationship and inspect the worktree before proposing cleanup.

## Daily inventory

The inventory logic is a single-file Python script with PEP 723 metadata. Run it
through `uv`; it uses the standard library only.

Repository paths, source names, target branches, remote names, and scheduling
time zones are host or project settings. Keep them in a local TOML config or pass
them as CLI parameters; do not commit machine-specific paths or project names in
the generic skill.

```sh
uv run skills/scheduled-tracker/scripts/repository-hygiene.py \
  --config "$HYGIENE_CONFIG"
```

The same invocation can be composed from parameters without a config file:

```sh
uv run skills/scheduled-tracker/scripts/repository-hygiene.py \
  --repo "<name>=<path>" \
  --repo "<name>=<path>" \
  --target "<target-branch>"
```

The config shape is:

```toml
target = "main"
remote = "origin"

[[repositories]]
name = "primary"
path = "/path/to/repository"

[[repositories]]
name = "secondary"
path = "/path/to/another/repository"
target = "release"
remote = "upstream"
```

`remote = ""` for a repository with no remote selects its local target branch.
Paths and the config path may use environment variables and `~`.

Run the focused script suite after changing the inventory:

```sh
uv run --with pytest pytest -q \
  skills/scheduled-tracker/scripts/test_repository_hygiene.py
```

Run the inventory in every repository in play, not only the current one. A
linked worktree in one repository can be registered in another repository's Git
directory, so a sweep scoped to one `git worktree list` can miss a live
checkout.

The script resolves the target before grading any tip:

- With a remote, it reads the live target branch using the literal
  `refs/heads/<target>` ref and compares that tip with the cached remote-tracking
  ref. A failed live read, a missing branch, or a stale cached ref makes the
  repository `unconfirmed`; the script does not grade against a cached ref.
- Without a remote, it uses the local target branch and records that provenance.

Reachability means ancestry (`git merge-base --is-ancestor`) or patch
equivalence (`git cherry`). A remote-tip listing is not a reachability test: an
interior commit that is already landed appears nowhere in that output. The
script parses `git cherry`'s `+`/`-` prefixes rather than trusting its exit
status.

The candidate list comes from `git for-each-ref`, not from
`git branch --merged` alone. The latter's `*` and `+` markers mean current and
worktree-checked-out branches; a naive indentation parse would report the
branches with no worktree and omit the worktree-backed branches that must be
handled first.

For every linked worktree, the script reads the checkout's tracked and ignored
state, its `HEAD`, and the `prunable` marker from `git worktree list
--porcelain`. It reports one row per worktree and one row per local or remote
branch. The row includes the repository, object, tip, target relation, worktree
state, process state, owner/card placeholder, observed disposition, and next
action.

### Process checks are last and path-scoped

The script runs a full `lsof +D <path>` only after a candidate has already passed
clean-tree inspection and reachability. The cost scales with the file count, so
running it for every worktree can dominate the sweep without changing an earlier
disposition.

It classifies the streams, never `lsof`'s exit status:

- stderr is non-empty: `unconfirmed` (missing executable, permission denial,
  unreadable path, or another diagnostic);
- stdout is non-empty: `held`, including a process whose working directory is
  inside the tree;
- both are empty: `nothing held`.

Do not pipe `lsof` to `head`, and do not merge stderr into stdout: a pipeline
returns `head`'s status, while merging makes a diagnostic indistinguishable from
a holder. `lsof -a -d cwd` is not path-scoped by itself. `lsof +d <path>` is
cheaper but checks only the directory's immediate entries and can miss a process
working in a subdirectory, so it is not a safe substitute for `+D`.

### `prunable` is not empty and is not cleanup

`prunable` means Git lost the worktree's `.git` link. It does **not** mean the
directory is empty, and it does not mean the work is gone. Measured behavior:

- a prunable worktree can still contain tracked, untracked, and ignored files;
- `git worktree prune` drops the metadata but leaves the directory and its
  files on disk, now invisible to Git;
- `git worktree remove` refuses a healthy dirty tree, but cannot see a prunable
  tree at all, so `rm -rf` is the only way to delete it and has no Git guard.

Therefore a `prunable` finding is **report-only in this template**. The script
counts files and symlinks when the directory still exists, reports the count,
and leaves the path in place. An unreadable directory is `unconfirmed`. A truly
absent directory is a stale-metadata finding; metadata pruning is still an owner
action, not this sweep's default. `prunable` count is a metadata-health signal,
not a count of reclaimable work.

## Dispositions

The script reports the machine-observable state. The seat assigns the final
disposition and fills the owner/card placeholder from the work item or lane
record:

| disposition | what it means | next observable result |
| --- | --- | --- |
| **active** | A live card or owner still needs the branch or worktree. | Name the card/owner and the expected landing or review tip. |
| **merge-ready** | Review is complete; the tip is not yet on the target. | Name the reviewer, reviewed tip, target ref, and land owner. |
| **cleanup candidate** | The observed commit relationship and checkout state permit cleanup; owner/card release is still required. | Apply the cleanup gate below, then record the exact removal/delete receipt. |
| **unowned/stale** | No card, owner, or fresh evidence explains the object. | Assign it or escalate it; do not delete on age alone. |
| **unconfirmed** | The inventory could not distinguish the state, or the live target was unavailable. | State the missing read and re-check; do not call the row clean. |

## Cleanup gate

This template is **report-only by default**. Remove a worktree or delete a
branch only when every applicable condition is observed:

1. The candidate is a `cleanup candidate` with a named owner or a closed card;
   an unowned branch is never deleted merely because it looks old.
2. Its tip is reachable from the recorded target, or `git cherry` shows no
   unique patch still to land. A cached remote ref alone does not establish
   either condition.
3. Tracked, untracked, and ignored-file inspection shows no work that would be
   lost. A dirty worktree is not a cleanup candidate.
4. No live process or unreadable state keeps the tree in use. Record the
   `lsof` result or the reason it was unavailable.
5. A locked worktree is never removed by this sweep. Its `locked` marker is an
   explicit owner hold; report it and leave it in place.
6. For a branch, the lane owner or card explicitly releases it. For a remote
   branch, the owner authorizes the remote deletion; do not infer that from a
   merged local branch.
7. A `prunable` worktree is never removed by this sweep. If its directory
   exists, report it and leave it in place. If it is absent, report the stale
   metadata; `git worktree prune` and `rm -rf` remain owner actions.

Use only safe, non-forced deletion forms when the gate passes. Never substitute
`worktree remove --force`, `branch -D`, or a force push in this sweep. If the
safe command refuses, report the refusal and leave the object in place; the
refusal is the finding, not an obstacle to bypass.

## Report

Post the script's target, inventory, and non-clean rows, then add the owner/card
and final disposition where the machine inventory cannot know them. Keep clean
rows summarized by count:

```text
repo | object | tip | target relation | worktree state | process | owner/card | disposition | next action
```

Do not report reclaimable space by summing per-candidate `du` output. Linked
worktrees share the repository object store, and `du` deduplicates shared bytes
only within one invocation; separate per-candidate measurements can promise
space that removal cannot return.

Each wake ends **done** when every configured repository is readable, every
candidate has a disposition, and cleanup candidates either passed the cleanup
gate or have a named owner/action. It ends **blocked** when a repository,
remote target, or candidate has an unstated owner or an unreadable state that
prevents disposition. A sweep that finds no dangling object is done; a sweep
that cannot inspect a candidate is blocked, not clean.

## Schedule

When this seat is active, anchor the reminder to the owning work thread. Keep the
time zone in host configuration or pass it as a parameter:

```sh
raft reminder schedule \
  --title "Daily repository hygiene sweep: worktrees and branches" \
  --repeat every:24h \
  --channel "<channel-or-thread>" \
  --message-id "<anchor-message-id>" \
  --tz "<iana-timezone>"
```

The daily cadence is the sweep's own cadence. It does not replace the
30-minute project tracker, and it does not authorize a cleanup outside the
conditions above.
