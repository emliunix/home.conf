---
name: record-conventions
description: >-
  Convention over configuration for a repository's experiment records: enumerate by naming, commits
  beat the manifest, generated indexes regenerated in the same commit as their evidence, pinned counts,
  one decision row per landed unit, dated worklog names beside stable living names. Use when finding
  what a programme has run, or adding a record to one; not when the task is to trust the manifest, or
  to hand-write a page a script generates.
---

# Records

## Read a record

1. **Enumerate by naming convention** with `ls` — a round's verdict, a per-question evaluation, the plan, the gate ledger, a probe's results named for the probe that wrote them, the decision rows. The convention is the contract.
2. **Check the set against the commits.** A manifest or index is a convenience: when it and the commits disagree, **the commits win**, and the disagreement is itself a finding to record, not to reconcile silently.
3. **Check a result's date against the change it is cited for.** A result file is a run, not a property; one older than the fix it supports does not support it.

A list collected this way can be wrong, and saying so is part of using it. The known mismatch classes:

- **A round with no verdict file** — enumeration finds the parts, not the whole; read the verdict across its files, and record that every experiment owes one.
- **A result file older than the fix it is cited for.**
- **A hand-maintained page that looks generated**, or a generated page left one edit stale.
- **An index that lags** the commits.
- **A derived header count that no generator and no test owns** — the append updated the content and left
the count. It survives even a pass whose whole purpose is to re-count, because "2 instances" is true of
*some* set and the reader cannot tell which.

## Add a record — four steps, in order

1. create the file, named by convention, not by invention;
2. append its row to the programme's index;
3. regenerate anything generated, **in the same commit** as the evidence it reads;
4. hand-edit the counts a test pins.

**Appending to a record is the same four steps, and step 3's hole is where appends break.** When you add
an instance, a subsection or a case to a file that already exists, you are editing **two** records: the
growing one and the **derived values about it** — a header's `Instances: N`, a table's row count, a
summary's total. Steps 3 and 4 assume those derived values are *generated* or *pinned*; where a header is
**hand-maintained and unpinned, neither step fires and the count silently goes stale.**

So before an append is done, name every derived value in the file, and re-read each one against the new
content. **A count must name its set** — `Instances: 2` and "instance 7 of the parent taxonomy" are both
true statements about different denominators, and an unnamed denominator cannot be checked. The same act
creates the second defect: appending `INSTANCE 7` to a file whose header already numbers it in a parent
set's sequence puts **two 7s over two sets in one file.** Mark the internal one explicitly rather than
renumbering, because renumbering silently moves a number another record may cite.

## Decision rows

One row per landed unit — timestamp, decision, why, evidence, result.

## Worklog names

The dated layer a reader enumerates before any programme carries a convention too:

- **A new record** is `{YYYY-MM-DD}-{slug}.md`; the date is the day the record's subject was fixed, and a frontmatter `created:` must agree with it.
- **Living documents keep stable names**, because the spine points at them — the open list, the manifest, the decision log. Adding a name to the living list is a deliberate act, recorded in a decision row.
- **A round home is a directory** named for the topic; files inside are named for their role, with the round number in the name (`{seat}-r{n}.md`, `round-{n}-adjudication.md`), and not dated, because the round's own record carries the dates.
- **Forward-only** — files named before the convention keep their names; renaming them breaks citations for no gain. The grandfather list lives in the checker, not in a document that would drift from it.
- **The convention has a check**: a script that fails on a top-level name that is neither dated nor on the living-or-grandfathered list, or on a dated name that disagrees with its `created:`. A rule with no check is speculation — this one included.

## Worked instances

- A round produced four per-question evaluations and a decision row but no round verdict; enumerating by convention found the parts and not the whole. Two other streams ran without a verdict file until readers noticed.
- A gate ledger with no generator looked generated; a generated corpus page was still one edit stale when a reader checked it.
- The experiment manifest had two stale cells within a day of being written — why it is a convenience and not the contract.
- Three review rounds over the same seats collided on bare `{seat}.md` names (`seat-a.md` beside `seat-a-r2.md`), which is why the round number belongs in the name.
- The extend-a-record procedure was written down only after a reader reconstructed it from the code and reported it missing.
- A library entry's header read `Instances: 2`; appending a third instance left it stale, and the same
  append put an `INSTANCE 7` beside a header that already called the *entry* "instance 7" of a parent set —
  **one act, two derived values, neither generated nor pinned.**

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: the record conventions per programme, the manifest, the open list and the other living names, the decision-row file, the generators and the tests that pin counts, and the worklog name checker. Where one of these roles has no file, that absence is a finding to record, not a reason to invent one.
