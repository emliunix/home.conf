# Seat: repository hygiene

Use when your seat owns the daily sweep for linked worktrees and branches across
repositories in active work. The bias to correct for is that a checkout is
usually assumed to be either active or disposable; both readings are made from
outside, and either can strand reviewed work or delete an unlanded change.

## The five checks, as the hygiene seat

1. **Routine check — every declared repository, not the current one.** Read the
   active-work list and inventory each repository's worktrees, local branches,
   remote branches, and remote target. A repository omitted from the list is an
   unowned population, not a clean one.
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
   local branch's name is not evidence that its tip is on `main`, and a remote
   branch's existence is not evidence that an owner still needs it. Test the
   commit relationship and inspect the worktree before proposing cleanup.

## Daily inventory

Name the active repositories before running commands. Set `REPOS` to their
canonical checkout paths; the inventory itself is read-only until a candidate
has passed the cleanup gate below.

```sh
REPOS=(
  "$HOME/Documents/home.conf"
  "$HOME/Documents/sandbox-deploy"
  "$HOME/Documents/task-svc"
  "$HOME/Documents/pi-team"
)

for repo in "${REPOS[@]}"; do
  printf '\n== %s ==\n' "$repo"
  git -C "$repo" rev-parse --show-toplevel
  git -C "$repo" status --short --branch
  git -C "$repo" worktree list --porcelain
  git -C "$repo" for-each-ref --format='%(refname:short)%09%(objectname)%09%(upstream:short)%09%(upstream:track)' refs/heads
  git -C "$repo" for-each-ref --format='%(refname:short)%09%(objectname)' refs/remotes/origin
done
```

For each repository, resolve the target before grading any tip. A repository
with an `origin` uses the live remote `main`; a repository without one uses its
local `main` and records that provenance rather than going `unconfirmed` only
because no remote exists. `git ls-remote` is only a listing of remote **tips**;
it is not a reachability test. An interior commit that is already landed appears
nowhere in that output. Use ancestry against the resolved target:

```sh
if git -C "$repo" remote get-url origin >/dev/null 2>&1; then
  rc=0; remote=$(git -C "$repo" ls-remote --heads origin main 2>&1) || rc=$?
  if [ "$rc" -ne 0 ] || [ -z "$remote" ]; then
    target=
  else
    remote_tip=${remote%%[[:space:]]*}
    rc=0; cached=$(git -C "$repo" rev-parse --verify --quiet refs/remotes/origin/main 2>/dev/null) || rc=$?
    if [ "$rc" -ne 0 ] || [ "$remote_tip" != "$cached" ]; then
      target=
    else
      target=origin/main
    fi
  fi
else
  target=main
fi

if [ -z "$target" ]; then
  : # unconfirmed: live remote main unavailable; do not grade a cached ref
else
  rc=0; git -C "$repo" merge-base --is-ancestor "$tip" "$target" || rc=$?
  # rc=0 reachable; rc=1 not an ancestor; any other status unconfirmed

  rc=0; cherry=$(git -C "$repo" cherry "$target" "$branch" 2>&1) || rc=$?
  # rc != 0 unconfirmed; rc=0 parse the + / - prefixes
fi
```

`merge-base --is-ancestor` answers reachability, not patch equivalence; a normal
rebase, squash, or cherry-pick may leave a branch with no unique patch even when
its tip is not an ancestor. `git cherry` is the second check for that case. Do
not build the test as `ls-remote | grep "$tip"`: the intuitive form returns a
plausible false negative for exactly the squash/interior-landed branches this
sweep is meant to clear. If `origin` exists but the live read fails, mark the
repository `unconfirmed`; do not silently fall back to cached `origin/main`. If
the live remote target differs from the cached ref, mark it `unconfirmed`
rather than grading against the stale local ref. Run `merge-base` and `cherry`
through the status-preserving form above: exit 1 is a normal ancestry verdict,
not a sweep failure, and bare use under `set -e` would abort before the
following disposition line.

Do not use `git branch --merged` as the candidate list without stripping its
markers. Its `*` and `+` prefixes encode current and worktree-checked-out
branches; a naive indentation parse therefore reports the branches with **no**
worktree and omits the worktree-backed branches that must be handled first. The
marker-free form is the `for-each-ref` list above followed by the ancestry
check; if `git branch --merged` is used for a quick view, parse it only after
removing `[*+ ]*`, or use the explicit equivalent:

```sh
git -C "$repo" branch --merged "$target" | sed 's/^[*+ ]*//'
```

For every linked worktree, inspect the checkout before judging the branch:

```sh
git -C "$repo" worktree list --porcelain
git -C "$worktree" status --porcelain=v1 --untracked-files=all
git -C "$worktree" status --porcelain=v1 --ignored --untracked-files=all
git -C "$worktree" rev-parse HEAD
git -C "$repo" worktree prune --dry-run --verbose
```

The dry-run names the repository-relative **git metadata** entry
(`worktrees/<name>`), not the checkout path. The directory to inspect comes from
the same `git worktree list --porcelain` record as the `prunable` marker; pair
the two there rather than trying to resolve the dry-run's name as a filesystem
path.

Run the process check **last**, and only for candidates that already passed
reachability and the clean-tree inspection. A full `lsof +D` walks the tree and
its cost scales with file count; measured on this host, a 779-file worktree took
about 0.4 s while canonical `home.conf` with 108,489 files took about 7.1 s.
With roughly 79 registered worktrees, doing it for every candidate dominates the
sweep without changing any earlier disposition.

For a candidate that reaches this step:

```sh
tmp=$(mktemp)
out=$(lsof +D "$worktree" 2>"$tmp") || true
if   [ -s "$tmp" ]; then
  printf '%s\n' "unconfirmed: $(cat "$tmp")"
elif [ -n "$out" ]; then
  printf '%s\n' "$out"   # held (cwd-only holders are reported)
else
  :                      # nothing held
fi
rm -f "$tmp"
```

Do not classify on `lsof`'s exit status. With `+D`, it walks the directory and
every entry under it; the status is 0 only when it could list information about
**all** those search arguments. An unopened regular file makes a real worktree
return 1 whether or not something holds it, so the status cannot distinguish a
free tree from a held one. Capture `stdout` and `stderr` separately instead:
stderr non-empty is `unconfirmed` (missing executable, permission denial,
unreadable path, or another diagnostic); stdout non-empty is `held`, including
the cwd-only case; both empty is `nothing held`.

Do not pipe `lsof` to `head`, and do not merge stderr into stdout: a pipeline
returns `head`'s status, while merging makes a diagnostic indistinguishable from
a holder. A missing `lsof` executable lands on the stderr stream and is
therefore `unconfirmed`. The empty stream is one input to cleanup, not the whole
gate.
`lsof -a -d cwd` is not path-scoped by itself; without a path filter it lists
every process's cwd on the host. `lsof +d <path>` is cheaper but checks only the
directory's immediate entries and can miss a process working in a subdirectory,
so it is not a safe substitute for `+D`.

### `prunable` is not empty and is not cleanup

`prunable` means Git lost the worktree's `.git` link. It does **not** mean the
directory is empty, and it does not mean the work is gone. Measured:

- a prunable worktree can still contain tracked, untracked, and ignored files;
- `git worktree prune` drops the metadata but leaves the directory and its
  files on disk, now invisible to Git;
- `git worktree remove` refuses a healthy dirty tree, but cannot see a prunable
  tree at all (`fatal: is not a working tree`), so `rm -rf` is the only way to
  delete it and has no Git guard.

Therefore a `prunable` finding is **report-only in this template**. Never run
`git worktree prune` without `--dry-run`, and never delete a prunable path with
`rm -rf`. Inspect the directory first:

```sh
test -d "$path" && find "$path" \( -type f -o -type l \) -print | wc -l
test -d "$path" && find "$path" \( -type f -o -type l \) -print | head -20
```

If the directory exists, report it and leave it in place, even when the file
count is zero. If it is unreadable, mark it `unconfirmed`. A truly absent
directory is only a stale-metadata finding; metadata pruning is still an owner
action, not this sweep's default. `prunable` count is a metadata-health signal,
not a count of reclaimable work.

## Dispositions

| disposition | what it means | next observable result |
| --- | --- | --- |
| **active** | A live card or owner still needs the branch or worktree. | Name the card/owner and the expected landing or review tip. |
| **merge-ready** | Review is complete; the tip is not yet on the target. | Name the reviewer, reviewed tip, target ref, and land owner. |
| **cleanup candidate** | The work is landed or deliberately discarded; the object has no remaining owner. | Run the cleanup gate below, then record the exact removal/delete receipt. |
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
3. `git status --porcelain=v1 --untracked-files=all` and the ignored-file
   inspection show no work that would be lost. A dirty worktree is not a
   cleanup candidate.
4. No live process or unreadable state keeps the tree in use. Record the
   `lsof` result or the reason it was unavailable.
5. For a branch, the lane owner or card explicitly releases it. For a remote
   branch, the owner authorizes the remote deletion; do not infer that from a
   merged local branch.
6. A `prunable` worktree is never removed by this sweep. If its directory
   exists, report it and leave it in place. If it is absent, report the stale
   metadata; `git worktree prune` and `rm -rf` remain owner actions.

Use the safe deletion forms:

```sh
git -C "$repo" worktree remove "$worktree"
git -C "$repo" branch -d "$branch"
git -C "$repo" push origin --delete "$remote_branch"
```

Never substitute `worktree remove --force`, `branch -D`, or a force push in
this sweep. If the safe command refuses, report the refusal and leave the
object in place; the refusal is the finding, not an obstacle to bypass.

## Report

Post one line per non-clean object and keep clean rows summarized by count:

```text
repo | object | tip | target relation | worktree state | owner/card | disposition | next action
```

Each wake ends **done** when every declared repository is readable, every
candidate has a disposition, and cleanup candidates either passed the cleanup
gate or have a named owner/action. It ends **blocked** when a repository,
remote target, or candidate has an unstated owner or an unreadable state that
prevents disposition. A sweep that finds no dangling object is done; a sweep
that cannot inspect a candidate is blocked, not clean.

## Schedule

When this seat is active, anchor the reminder to the owning work thread:

```sh
raft reminder schedule \
  --title "Daily repository hygiene sweep: worktrees and branches" \
  --repeat every:24h \
  --channel "<channel-or-thread>" \
  --message-id "<anchor-message-id>" \
  --tz Asia/Shanghai
```

The daily cadence is the sweep's own cadence. It does not replace the
30-minute project tracker, and it does not authorize a cleanup outside the
conditions above.
