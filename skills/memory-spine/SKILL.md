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

## The scripts

```bash
# Check an index: cap, required spine headings, every pointer resolves.
node scripts/memory-lint.mjs /path/to/MEMORY.md
#   exit 0 pass · 1 failed · 64 invalid input

# Add one fact. Idempotent by content; appends to the log, then republishes the index.
node scripts/memory-append.mjs /path/to/MEMORY.md "the fact, as one line"
#   exit 0 appended (or already present) · 1 refused, nothing changed · 64 usage

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

Nine cases, each shown to fail on the defect it targets — that is what the suite is for, and a
case that cannot redden is not coverage. The suite exists because an earlier revision ran its cases
as top-level blocks with a `process.exit()` inside one of them: it printed "all pass" while
measuring four of nine.

To confirm the suite really runs what it defines, enumerate:

```bash
grep -oE "^(async )?function (case[A-Za-z]+)" tests/check-dispatch.mjs | awk '{print $NF}' | sort > /tmp/defined
grep -oE "^  \[\"[a-z-]+\", (case[A-Za-z]+)\]" tests/check-dispatch.mjs | grep -oE "case[A-Za-z]+" | sort > /tmp/called
comm -23 /tmp/defined /tmp/called   # empty = every defined case is called
```

A gap here is a case that never runs. Note this checks definition-vs-call only; a case that is
called and asserts nothing still passes it.

## What this does not do

- **It does not decide what belongs in the index.** The cap forces a choice; the choice is yours.
- **It does not delete content.** Migration moves text to a note and leaves a pointer. If a section
  is genuinely dead, remove it deliberately after the migration, not by raising `--max-moves`.
- **It does not touch a workspace it was not pointed at.** Pass the path explicitly.
