# Recurring pass — checklist template

A pass is a scheduled read of the whole board, not of whatever spoke last. Fill every row, or
say which row you could not fill and why — an unfilled row is a finding, not a gap in the form.
The pass is cheap; the cost of a row nobody ran is discovered by someone else, later.

| # | Row | The question | A filled row names |
| --- | --- | --- | --- |
| 1 | Board vs goal files | Does every card's state match the goal file it serves? | the two surfaces and where they disagree; scope changes are visible, never silent |
| 2 | Branch/worktree state | Is work sitting uncommitted in a shared checkout? | the path and the tracked/untracked split — named drift, never noise, and never reverted by the passer |
| 3 | Receipts | Is each recent claim's verification current at the commit it names? | the commit id, and what was re-run versus read from someone else's report |
| 4 | Real blockers | Is every blocker owned, with a reason? | owner + reason, or the word "unowned" |
| 5 | Stale cards | Has every card that stopped moving been dispositioned? | the disposition, not silence |
| 6 | The refs I actually read | For every ref I cite, is that commit reachable from a remote ref — **and did I read the ref I claim, rather than a checkout that is merely nearby?** | the tips tested **as commits**, not branch names — a same-named stale remote branch is how a single-machine sprint hides; the namespace actually walked, named explicitly (a local tracking ref is a different population from the remote's); every hash-named ref resolved against its target; **and for each file read, the revision it was read at, so a branch-era checkout is never quoted as the floor** |
| 7 | Severity labels | Is every grading word traceable to a measurement? | the measurement, or the label deleted. A label softer *or* broader than the measured state is the same defect |
| 8 | Report → closed wall-clock | What did each problem arc cost from report to verified fix? | timestamp deltas from the record; no grades; state the metric's bound |
| 9 | Isolation claims | Does "isolated" say what else was running? | the run conditions. Isolation from the suite is not isolation from the host |
| 10 | Members behind a count | Does any sentence that stands for a set ("all", "every", "the corpus", "nothing") name the members actually read? | the enumeration, or the phrase "I read N of M" — a summary is a claim about a set, and the set is what has to be named |
| 11 | The base of every figure | Does every number travel with the population and the command that produced it? | `command + result`, with the scope expressed as the command's own arguments; a count without its base is unreproducible the moment its author stops remembering it |
| 12 | The window that covers the mechanism | Is the measurement taken over a period long enough for the thing measured to appear? | the two clocks and their relation — a shorter window than the mechanism's own period cannot falsify it, and a zero from such a window is not evidence |

## What each row catches

1. **Silent scope change** — a card that quietly grew, shrank, or changed subject.
2. **Single-copy work** — real content living in a working tree because nobody landed it.
3. **Stale evidence** — a green that is true of the commit before the one it is quoted against.
4. **Waiting that looks like work** — an unowned blocker decays into an assumption.
5. **Abandonment by omission** — a card nobody closed and nobody re-reasoned.
6. **Existence on one disk, and the name that is not an anchor** — the first failure looks healthy from every other row; the second reads as a pointer and is not one. A backup ref name either contains the hash of the commit it points at, or promises no hash — then every name is checkable or explicitly exempt, and the census is exhaustive by construction rather than by the reader's diligence.
7. **The label softer than the artifact** — "minor", "stale", "needs a check" doing duty for a measurement.
8. **Latency nobody is watching** — without the row, process cost is felt, never counted.
9. **A control the run did not have** — "isolated", "clean", "quiet" asserted rather than measured.
10. **"All" over a set nobody enumerated** — a universal claim whose members were inferred from a search term rather than read.
11. **The figure that lost its base** — a denominator, glob, or time range dropped in retelling, leaving a number that cannot be reproduced.
12. **The window shorter than the mechanism** — a claim of the form "it did not happen" measured over a period in which it could not have happened.

## Per-seat variants

The rows above are written from an **observer's** seat, where watching is the job and all 12
apply. Other seats read a subset — and, more importantly, each seat's procedure has an **owning
surface**, which wins over this template. The template says what a pass is *for*; the owning
surface says what it *is*.

- **Observer / continuous reviewer** — all 12. The pass is the deliverable; a pass nobody sends
  is indistinguishable from a quiet day.
- **Implementer** — rows 1, 3, 5, 6 on your own cards, plus the low-level habits that a pass is
  the wrong instrument for (clean-tree verification, gate authoring, distinguishing a flake from
  a defect). Those live in their own guides.
- **Tracker** — rows 1, 4, 5, 8: the board against the goals, the blockers against their owners,
  the disposition of what stopped moving, the wall-clock cost.
- **Reviewer with a named unit** — rows 3, 7, 9: the receipt against its commit, the labels
  against their measurements, the run conditions against the word "isolated". A pass is not a
  substitute for the unit's own adversarial verdict.
- **Anyone resuming after a gap** — row 2 first, then 6. The most common way to start work on a
  stale premise is to inherit a tree or a branch name nobody re-checked.

## Bound on the wall-clock row

Present it as a table of report → verified-fix deltas, never as a score. The deltas include
thinking time, they hide compute inside an arc, and they are not comparable across arcs of
different kinds. The row's value is that it exists and is computed the same way each time.
