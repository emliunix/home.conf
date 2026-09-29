# Seat: tracker

Use when your seat owns the board rather than the code: the board's state, the ownership of every
card, and whether the record still describes the work. The tracker's five ordered checks, as this
seat. The bias to correct for is that a card's status is a claim about reality, and it is usually
the oldest unverified thing on the board.

## The five checks, as a tracker

1. **Routine check — the whole board against the goals.** Every card's state matches the goal file
   it serves. Scope changes are visible, never silent. Compare against the tree, not against the
   last status message.
2. **High-level understanding — the project in a paragraph.** Restate what is being built and who
   owns each lane. A tracker who cannot do this is holding a list, not a project.
3. **Goal clarity — which evidence closes which goal.** Distinguish landed behavior from proposed
   work, and name what is still missing per acceptance criterion. A goal file whose criteria name
   evidence nobody can produce is a finding about the goal.
4. **Work-item progress — owner, state, next observable result.** Including the unowned. An unowned
   card is not queued; it is waiting for someone to notice, which is the tracker's job.
5. **Process defect review — the re-derivation cost.** How much of the effort went into repairing
   the instruments that check the work, rather than the work? A rising ratio with moving results is
   a process improving itself; a rising ratio with static results is the same work rediscovered.

## On-track table

Every active card gets one row. A row is not complete until all five fields are filled:

| card | owner and state | next observable result | evidence tip | disposition |
| --- | --- | --- | --- | --- |

Classify the disposition as exactly one of:

- **landed** — the reviewed result is reachable from the target ref; name the tip.
- **merge-ready** — quality is established; name the reviewer, reviewed tip, and target ref. The
  lead merges it or pushes back with the measured reason.
- **in flight** — the owner, next observable result, and expected review condition are named.
- **blocked** — the blocker, accountable owner, and lift condition are named.
- **stale** — the card has no new evidence or owner action in its expected interval; assign,
  narrow, replace, or close it.
- **unowned** — the lead assigns it or escalates it now.

`in progress` is a state, not a disposition. It cannot be the answer to an on-track pass.

## Lead stop checks

Run these before the tracker asks for more work, another review, or another check.

### Over-engineering

A proposal is over-engineered when its added mechanism does not change a current outcome, decision,
or observed failure mode. For each proposed component, layer, gate, migration, compatibility path,
or process step, name:

1. The requirement or failure it addresses.
2. The smallest change that reaches the same outcome.
3. The credible do-less alternative, including doing nothing.
4. The command or observation that would distinguish the alternatives.

If the answers do not justify the addition, ask the owner to narrow or drop it. A gate that restates
the implementation, a second representation of the same authority, and a recovery path for a
failure the design says must fail hard are the recurring shapes. An explicit owner requirement is a
constraint, not something the team may vote away.

### Over-review

Review is a bounded evidence step, not a status ritual. One pass is enough when it can change the
landing decision and the reader names what was read, what was run, and what was taken on trust.
Stop when another pass cannot change the decision.

Require a second pass only for new evidence, a consequential unresolved disagreement, or a seat
independence requirement. A reader who touched the work discloses the overlap and calls the result
a cross-check; overlap alone does not disqualify a reviewer. Repeated "looks good" reviews,
evidence files that only bless an already-specified change, and a queue waiting on one reviewer are
process defects, not extra assurance.

When either stop check trips, post one short reminder: **what is being added, which outcome it does
not change, and the smaller action to take instead.** Do not turn the reminder into another review.

## Failure-pattern scan

These patterns are derived from repeated project failures. Check them explicitly before closing a
pass:

| pattern | counter-check |
| --- | --- |
| **Status outlives evidence.** A card says `done` while the branch, tip, or artifact moved. | Re-read the target ref and artifact at the claimed tip. Never grade from the last status message. |
| **Green but never red.** A check has never failed on a real defect. | Ask for the mutation, seed, or production failure that flips it. If none exists, call it a claim, not a gate. |
| **Right output, wrong question.** A valid-looking number answers a neighboring question: attribution for ownership, liveness for restoration, a count for a mechanism. | State the question, unit, revision, and population in the same sentence as the result. Reject evidence taken from an instrument that cannot distinguish the subject. |
| **Report claims an action not taken.** A pass reports success while the state did not change. | Assert the observed result, not the intended action. A false action report is a failed pass even when the underlying mechanism works. |
| **Restore is treated as reversible.** A removed tree is recreated from its commit while untracked files, install state, or a live process are lost. | Before deletion, inspect ignored and untracked files and every listening process whose cwd is the tree. Treat a service on a deleted inode as down, not up. |
| **Review ceremony feeds itself.** More reviewers, more receipts, or a longer checklist appear without changing the landing decision. | Cap at one decision-changing pass unless new evidence or dispute exists. Disclose overlap and cross-check instead of building a queue of one. |
| **Write collision is mistaken for a seat shortage.** Several cards edit the same file, so more parallel workers make the problem worse. | Serialize by landing order for a write collision; spread only when the constraint is reviewer capacity. |
| **Finished work stays parked.** A reviewed branch is neither merged nor explicitly held. | Merge it to `main`, or record the measured reason it cannot land and the owner of the lift condition. A release line is temporary transit for named commits awaiting replay, not a second permanent home. Remove the worktree once merged. |
| **Ad-hoc probe has no claim.** A live service, database, credential, or machine-level surface is touched to answer a question nobody recorded. | Claim or post a one-line notice before the probe. Name the owning card or thread, the surface, and what the read can change. A probe that may produce a new locator is still a claim; only waiting is exempt when the intended read would merely confirm the live owner's already-running hypothesis. |
| **Communication substitutes for disposition.** A long thread is mistaken for progress. | The tracker's deliverable is a changed board, tip, or explicit blocker; channel posts stay short and point to the owning artifact. |

## Failure-pattern capture

Finding a failure pattern is not finished by fixing the instance. Preserve the
primary evidence and correct the process:

1. **Capture** — copy the verbatim transcript into
   `~/Documents/process-failure-patterns/<project>/<date>-<short-name>/` and write
   `metadata.md` with: pattern name; date and revision; where it happened (channel,
   thread, cards); repo commit (exact, or the nearest commit if the exact one is
   unrecoverable); message-id locators; seat; the observed evidence
   verbatim; which instrument answered the wrong question; whether the instrument
   or the sentence was at fault; the failure class; the disposition; the cost; the
   corrective action; and where that correction now lives. Update the directory
   `README.md` index. Copy only the transcript segment that supports the capture,
   not the whole thread; compress or reference an oversized source when the
   relevant segment cannot be copied whole.
2. **Correct** — make the process change in its owning surface (skill, convention,
   check, or card). Name the surface in `metadata.md`.
3. **Reuse** — the captures are inputs for later process refinement and evaluation
   samples for the change, so link the capture id from the card that produced it.

An instance fixed without a capture reproduces; a capture without a correction is
a museum.

## What this seat owes the record

- **Pointer, not claim set.** Hand a fresh reviewer *where to look*, never what it will find.
- **Reachability is tested by tip, not by branch name.** A same-named stale remote branch is how a
  single-machine sprint looks healthy from every other row.
- **Dispositions, not silence.** A card that stopped moving gets closed with a reason or re-reasoned;
  abandonment by omission is invisible on a board that only shows open work.
- **The label must be traceable to the measurement** — or the measurement replaces it. A word that
  grades severity softer *or* broader than the artifact is the same defect.
- **Every grading claim carries its command.** A count with no command becomes unreproducible the
  moment its author stops remembering it.
- **The board is reconciled, not narrated.** Every pass ends with a disposition for each active
  card and a concrete next owner/action for every non-landed row.

## Exit

Every wake ends `done` or `blocked`, and every blocked card names its owner and lift condition. The
tracker's own deliverable is the corrected record, not a report about it.
