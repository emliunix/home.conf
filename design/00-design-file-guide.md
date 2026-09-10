# 00 — Design file guide (file-naming contract)

This file documents the naming contract for the numbered design files in this
folder, and disambiguates them from the `ref-` reference guides beside them and
the goal files in `goals/` that the flow skills reference (`flow-grill-review`,
`flow-retro`). That is the sole purpose of this file — it is a reference, not a
design.

## Numbering (`NN`)

Live designs are `design/NN-<topic>.md`, where `NN` is the lowest unused
zero-padded sequential number (01, 02, … 99).

- **Sequential, lowest-unused.** Numbers are allocated in order; a deleted file
  does not make its number reusable in the middle of the sequence before the
  top.
- **Stable handles.** Once a file exists, its number is never renumbered.
  References to `design/NN` in goal files, worklogs, and skills are durable
  handles. Do not renumber existing files; if a topic changes, open a new
  `design/NN` and note the supersession.
- **Never reuse.** A number that has held a file is not recycled.

## Prefixes and other names

Alongside the numbered `design/NN-<topic>.md` set, two other names are
recognized:

- **`ref-`** — durable reference/guide material that owns principles or rules
  and is not itself gated through the grill → impl → retro loop. Precedent:
  `flow-skills-eval/design/ref-eval-design-guide.md`. A `ref-` file is not a
  lifecycle design; it does not carry a `Status:`, is not registered in a goal
  file's Design-files index, and is not covers-mapped to root rows.

- **`goals/NN-<topic>.md`** — goal files live in `goals/`, in this exact
  `NN-<topic>.md` form. Per the `goal-file` skill they are the administrative
  source for a sprint (frozen root + funnel), not designs: no lifecycle
  `Status:`, no grill → impl → retro. Design numbers never refer to them.

Anything else does not have a defined place.

## How a file gets its name

The drafter picks the next `NN` at draft time. If the caller supplies a
different path than the convention, use the caller's path but flag the
deviation in the worklog.

## Status

This file is a reference, not a design: it never passes through the grill /
impl / retro loop, carries no `Status:` lifecycle word, and is not registered
in any goal file.
