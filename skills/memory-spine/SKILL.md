---
name: memory-spine
description: Operate a personal-memory index (MEMORY.md) and its notes under a hard byte cap, with an append-only log, atomic publishes, and a fail-closed lint. Use when a memory index is over its cap, when editing MEMORY.md by hand would risk losing bytes, when adding one durable fact, or when checking that every pointer in an index resolves.
---

# memory-spine

Three scripts and one contract for keeping a `MEMORY.md` index small, recoverable, and free of
dead pointers. The index is a **map**: it holds the most important things and links to `notes/`
files for the detail.

## When to use this

- **The index is over its cap.** `memory-lint.mjs` says by how many bytes and names the largest
  sections; `memory-migrate.mjs` moves the overflow to notes and rewrites the index atomically.
- **You want to add one durable fact** without hand-editing. `memory-append.mjs` appends to a dated
  log first, verifies it, then republishes the index.
- **You are about to check an index's pointers.** The profile catches a pointer that no longer
  resolves, which is the failure that matters: a dead pointer is a broken recovery path.

## Why not just edit the file

A memory index is the recovery point after context is lost, so the way it is written is part of its
contract:

- **A byte-losing write is unrecoverable.** `open(path, "w")` truncates *before* it can fail, so an
  exception mid-write leaves an empty index. Every write here builds the full text, writes a temp
  file in the same directory, and renames over the target — the only visible states are the old
  index and the new one.
- **The log is written first, and flushed.** The durable record of a fact exists before the index
  claims it does.
- **A write that is refused changes nothing.** Not "changes very little" — both files keep their
  bytes.
- **A RESTORE must be non-clobbering, AND must KEEP what it could not publish.** When a displaced
  lock is put back, `rename` OVERWRITES its destination, so a third writer that claimed the free path
  in the gap has its live lock destroyed. `link` fails instead of overwriting — and when the path is
  occupied the displaced record is no longer reachable by name, so its tombstone is the ONLY handle
  and must be kept. Publishing non-clobberingly and then deleting the tombstone anyway loses the
  record in exactly the case the restore refused. The cleanup lives inside the helper, not in its
  callers: a separate caller-side step can be wrong on its own, and the gap between the two steps is
  not reachable from outside, so no caller-level case can cover it.
- **A memo on a polling path must be keyed by the IDENTITY, not the handle.** The start-time lookup
  is memoized by the raw owner RECORD (pid plus start), never by pid alone: keying on the pid caches
  the very thing whose change is being tested, so a recycled pid would be served its predecessor's
  start time and read as alive. Count the real lookups and assert the count — "it is fast here" and
  "the memo works" are indistinguishable otherwise.
- **A stored start time must be COMPARED, not merely recorded.** A pid can be recycled, so "this pid
  is alive" is not "the writer that recorded this pid is alive". Without the comparison a recycled
  pid wedges a claim forever, because age applies only to a dead or unparseable identity.
- **A lock is created and its owner recorded in ONE atomic call.** `writeFileSync(path, record,
  {flag: "wx"})` is O_CREAT|O_EXCL plus the write, so a lock never exists without a complete owner
  record. Doing `mkdir` and then writing the record inside it by path leaves a window where a
  successor replaces the directory and the first writer's record lands in the **successor's** lock --
  both then believing they own it.
- **A lock's RELEASE must use the same ATOMIC transition as its eviction.** Checking ownership on
  eviction but not on release means a holder that outlives the stale threshold deletes its successor's
  live lock from its own `finally`. And a `stat`-then-remove release is not enough either: it still
  has a time-of-check/time-of-use window, so the same defect survives in a narrower window. Both
  paths rename the observed path to a unique tombstone and prove the inode before removing it.
- **`append` must leave the fact VISIBLE in the index.** An earlier version wrote only the log and
  left the index untouched; a fresh agent reading the index could not see a fact the log durably
  held, so the recovery point was the wrong file. The index is the thing that gets injected.
- **The index is a FOLD of the log, not an edited snapshot.** This is what makes a momentary lock
  failure harmless: whichever writer renames last publishes *every* fact in the log, because it
  rebuilds the section from the log rather than editing whatever it happened to read. Hand-written
  bullets are preserved; only bullets this log owns are regenerated.

## The scripts

```bash
# Check an index: cap, required spine headings, every pointer resolves.
node scripts/memory-lint.mjs /path/to/MEMORY.md
#   exit 0 pass · 1 failed · 64 invalid input

# Add one fact. Idempotent by content; appends to the log, then republishes the index.
node scripts/memory-append.mjs /path/to/MEMORY.md "the fact, as one line"
#   exit 0 appended (or already present) · 1 refused, nothing changed · 64 usage

# Bring an index back onto the full log. Idempotent; a no-op when it is already current.
node scripts/memory-republish.mjs /path/to/MEMORY.md

# Move an index's overflow into notes. DRY RUN unless --apply.
node scripts/memory-migrate.mjs /path/to/MEMORY.md            # print the plan
node scripts/memory-migrate.mjs /path/to/MEMORY.md --apply    # write notes, then the index
#   exit 0 planned/applied · 1 refused · 64 bad input
```

`--max-moves N` (default 4) bounds how many sections one run may move, so a single invocation
cannot gut the index. When the bound is what stopped the plan, the refusal says so rather than
claiming nothing was movable.

## The lint's rules

| Rule | Why |
|---|---|
| ≤ 16,384 bytes | The index is injected at session start, so it must stay small to be read in full. |
| `# <name>`, `## Role`, `## Key Knowledge`, `## Active Context` present | These are the spine: who you are, what you know, what you are doing. |
| Every `` `notes/...` `` pointer resolves | A pointer is the only route to that detail. A dead one is a dead end discovered at the worst time. |

The over-cap message names the largest sections, because "over by 707 B" is not actionable and
"## Active Context is 17,028 B" is.

## The doc-verify contract

`.doc-verify.yaml` + `module.yaml` express "every pointer resolves" and "the spine headings exist"
by **extending the engine's own `doc-verify:references` library** rather than adding a second
parser. The engine already finds a dangling path; in a repository that is a warning, but for a
memory index it is promoted to an **error**, because a pointer here is a route, not a mention.

Two operational notes, both measured:

- **`check` requires a prior `build` in that worktree.** `doc-verify/dist/` is untracked, so a
  fresh checkout that runs `check` first reports every document entry as invalid. That is a stale
  build artifact, not a broken config. Run `npm run build` in the engine's worktree.
- **The engine must run inside a Git repository**, and an agent workspace typically is not one.
  Point it at the workspace from a repo checkout, or initialise the workspace.

## Running the coverage

```bash
node tests/check-dispatch.mjs
```

Twenty-three cases, each shown to fail on the defect it targets — that is what the suite is for, and a
case that cannot redden is not coverage. Two lessons are encoded here at cost:

- An earlier revision ran its cases as top-level blocks with a `process.exit()` inside one of them:
  it printed "all pass" while measuring four of nine.
- Two later revisions passed `14/14` while **the cases could not fail** — one asserted the defect as
  the requirement, and two threw an `ENOENT`/`statSync` error instead of reporting a FAIL, which
  aborts the run so a regression shows as a crash rather than a red. A case that throws measures
  nothing on exactly the runs that matter; assert defensively.

The crash cases use a `--require` preload that calls `process.exit(9)`, so no cleanup handler runs
and the interruption is a real hard kill rather than a simulated one.

To confirm the suite really runs what it defines, enumerate:

```bash
grep -oE "^(async )?function (case[A-Za-z]+)" tests/check-dispatch.mjs | awk '{print $NF}' | sort > /tmp/defined
grep -oE "^  \[\"[a-z-]+\", (case[A-Za-z]+)\]" tests/check-dispatch.mjs | grep -oE "case[A-Za-z]+" | sort > /tmp/called
comm -23 /tmp/defined /tmp/called   # empty = every defined case is called
```

A gap here is a case that never runs. Note this checks definition-vs-call only; a case that is
called and asserts nothing still passes it.

## The guarantee is convergence, not instant completeness

Because the log and the index are two files, they cannot be updated atomically together. So the
honest property is: **the index converges to the log.** Appending folds the log into the index, and
`republish` brings an index that is behind onto the full log; folding is idempotent, so running it
again is a no-op. What is *not* claimed is that no concurrent append can ever be momentarily missing
from the index — with a lock that can fail that would be a guarantee the mechanism does not support.

**"The log decides" means the BODY, not just the key.** A partial write can leave an entry's marker
with a truncated body, so a key-only match would report success for a fact never fully stored. The
log is parsed and the body compared exactly; a **torn** entry (key present, body different) is
refused as `ETORN` rather than mistaken for the fact or silently appended past.

**The log decides whether a fact is recorded — never the claim.** A claim file means only "a writer
is in flight for this fact". Treating its existence as "done" is a trap with a cruel failure mode:
a hard kill between the claim and the log write makes every retry report "already present" for a
fact recorded nowhere, so the loss is silent and reported as success. Recovery is therefore driven
by the log, and a claim left by a dead holder is reclaimed without waiting out a time window.

**Holder identity is a pid AND a start time, because pids are recycled.** "This pid is alive" can be
a successor process that inherited the number, so the owner record carries both and a recycled pid is
distinguishable from the original holder. When identity cannot be established the holder is
**unknown, never dead**: an unattributable claim is refused (`EINPROGRESS`) rather than overwritten.
Converting "could not prove the holder dead" into a success is the exact failure this path exists to
prevent. Retrying after any interruption yields exactly one log entry and a visible fact.

## What this does not do

- **It does not decide what belongs in the index.** The cap forces a choice; the choice is yours.
- **It does not delete content.** Migration moves text to a note and leaves a pointer. If a section
  is genuinely dead, remove it deliberately after the migration, not by raising `--max-moves`.
- **It does not touch a workspace it was not pointed at.** Pass the path explicitly.
