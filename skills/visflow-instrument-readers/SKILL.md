---
name: visflow-instrument-readers
description: >-
  Project specific method on blinded onboarding trials in visflow: readers over the spine,
  per-reader metrics, freeze while measuring, every finding dispositioned, no blanket
  remediation. Use in visflow when measuring whether the record onboards a newcomer; not when
  the evidence is one reader’s impressions rather than a batch.
---

# Reader batch

1. **Choose the corpus** under test (usually the spine: `README.md`, `method.md`, the design docs) and freeze it.
2. **Blind the readers** — no priming, no guided tour; hand them the files, not a summary.
3. **Three to five readers per batch**, each with the same topic prompt; ask for their **trajectory** (what they read, in what order, where they got lost, what they had to infer) and a report.
4. **Metrics per reader**, not an average: time to the right files, questions the record could not answer, defects found.
5. **Disposition every finding** — including a finding only one reader reports. Blanket remediation is banned: a single confusion is data about that path, not a consensus.
6. **Freeze while they read** — no edits, no commits, until the last reader returns.

## The reader-batch protocol (the full protocol)

*Moved here from `method.md` when that file became a manifest (2026-09-19): the procedure lives
with the skill, and the manifest points at it.*

The instrument is a batch of unaided readers, and it is the only measurement this repository has for
whether the spine works. Six rounds so far; every defect they found was a point where a reader was
slowed or misled, and none of them was a design defect.

**Protocol.** Three to five read-only subagents, each given one topic and told: start wherever you would
naturally start, no entry point is prescribed, read at most 25 files, stop when you can answer. The report
is size-bounded so the batch is affordable: at most 10 trajectory lines (path, why, what you took, where it
sent you; mark listings and searches), at most 5 answer bullets naming file and line, then the onboarding
metrics, then friction, then the single edit that would have made it fastest.

**The metrics that make it a measurement rather than an impression:** files read before the answer; whether
a document routed the reader or they inferred the route; whether they read the design as settled or open,
naming the sentence that decided it.

**The freeze rule.** Tag the tree before dispatching and commit nothing until the last reader is back. **One tag family per instrument, created at dispatch, its name written into the batch record**: `reader-batch-<n>` for a reader batch, `author-round-<n>` for an author round. Two families were used in the first rounds (`reader-round-N` and `reader-batch-N`), so the number of rounds is durable only in the tags, and a batch without a tag leaves its freeze unwitnessed and a reader's finding unattributable to a revision.
Round two was run while five commits landed mid-batch and one reader said so; its comparison is confounded
and that is why the rule exists. Correct in one batch afterwards, not five.

**What the rounds have found.** Round 1: sixteen record defects. Round 2: eleven more, including three
materially different readings of WF-2 inside `graph-ir.md` and two implementations that disagree.
Round 3: replication, plus that the only tree accepting a neither-guarded-nor-decreasing cycle is
`taskboard`. Round 4: the reading order had been stated three times and the copies disagreed.
Round 5: the collapse held -- two readers, six files and eleven files, both routed rather than guessing,
both found the order, the status table and the open list. What they found instead was a clause above the
order telling the reader to start with the method, a numbering gap where a deleted section had been, and a
row whose gap had already closed.
Round 6 (2026-09-18, the v2/v3 split): one reader found the current design and the implemented spec in eight
files, routed by README rather than guessing. The friction was all disambiguation: the five-labels table
lives only in `AGENTS.md`, README's "Superseded by" read as "dead" for the implemented v2, the retired
`select` still stood in the v3 syntax block, and nothing said the production runtime's graph is narrower
than the spec. Fixed in one batch. Two more readers ran against the fixed tree: the second found it in
six files with sharper friction (a stale `graph-flow-v2/` layout in `AGENTS.md`, two near-duplicate
leads, the production module calling itself the Graph IR), and the third was routed in one hop and
answerable after four files, its remaining friction the accepted-open `select` line and the carried
citations. A fourth reader against the same tree reproduced that shape (six files, routed, answerable
after four) with no new defect, so the loop stopped; what remains is the accepted-open `select` line and
the pre-split citations.

**The recurring lesson.** A fix applied to every document a reader complained about recreates the defect.
`worklog/next.md` was added to three files because three readers asked where it was; the fourth reader measured
three contradictory orders. State it once and check it, or watch maintenance reproduce the problem.

## References
`method.md` · *Measuring onboarding: the reader batch*; prior batches under `worklog/`.
