# Seat: tracker

Use when your seat owns the board rather than the code: the board's state, the ownership of every
work item, and whether the record still describes the work. The tracker's five ordered checks, as
this seat. The bias to correct for is that a work item's status is a claim about reality, and it is
usually the oldest unverified thing on the board.

A **work item** is this checklist's unit of tracked work. It is deliberately domain-neutral: a Raft
card, a GitHub issue, a Jira ticket, and a task in a project's own tracker are all work items here.
Where a sentence is specific to Raft's card board it says so.

## The five checks, as a tracker

1. **Routine check — the whole board against the goals.** Every work item's state matches the goal file
   it serves. Scope changes are visible, never silent. Compare against the tree, not against the
   last status message.
2. **High-level understanding — the project in a paragraph.** Restate what is being built and who
   owns each lane. A tracker who cannot do this is holding a list, not a project.
3. **Goal clarity — which evidence closes which goal.** Distinguish landed behavior from proposed
   work, and name what is still missing per acceptance criterion. A goal file whose criteria name
   evidence nobody can produce is a finding about the goal.
4. **Work-item progress — owner, state, next observable result.** Including the unowned. An unowned
   work item is not queued; it is waiting for someone to notice, which is the tracker's job.
5. **Process defect review — the re-derivation cost.** How much of the effort went into repairing
   the instruments that check the work, rather than the work? A rising ratio with moving results is
   a process improving itself; a rising ratio with static results is the same work rediscovered.

## Project frame before the table

**A pass that opens a decision without reading the project frame is not a pass.** Before composing
the on-track table, read these three, in this order, and be able to name each:

1. **The project's constitution or standing purpose** — what this repo is for, and what it is not.
2. **The current architecture overview** — the system boundary and how the parts relate
   (`docs/architecture.md`, or the project's equivalent).
3. **The owning contract for the subject of the pass** — the module, route, or interface document
   that governs the thing being reported on.

**If the frame already answers the question, the pass reports the existing answer. It does not open
a decision request.** The failure this prevents: a tracker reads the code and the design, finds them
disagree, and asks the owner to choose — when the constitution already settles it. Both parties then
pay for a decision that was never open. A pass that names a design-vs-code contradiction, or asks
the owner to choose between them, **must first state which of the three it read**, and quote the
sentence that answers it.

For a plugin or generic use of this skill where no constitution exists, name that in one line and
substitute the nearest standing statement of purpose; the step is satisfied by naming the frame,
not by finding a file with that exact name.

## On-track table

Every active work item gets one row. A row is not complete until all five fields are filled:

| work item | owner and state | next observable result | evidence tip | disposition |
| --- | --- | --- | --- | --- |

**Why this table has five fields and the pass message's has five different ones.** The seat
checklist audits **whether a row is trustworthy** — hence `evidence tip` (where the claim can be
re-read) and `disposition` (what the lead does about it). The pass message is a **request addressed
to the members named on it** — hence `gate / blocker` (what each member is waiting on). They are
different questions asked of the same work items, so the field sets differ **deliberately**; a
checklist row is not a pass-message row. Compose the pass message from
[`project-tracker-message.md`](project-tracker-message.md) and keep the audit fields here.

Classify the disposition as exactly one of:

- **landed** — the reviewed result is reachable from the target ref; name the tip.
- **merge-ready** — quality is established; name the reviewer, reviewed tip, and target ref. The
  lead merges it or pushes back with the measured reason.
- **in flight** — the owner, next observable result, and expected review condition are named.
- **blocked** — the blocker, accountable owner, and lift condition are named.
- **stale** — the work item has no new evidence or owner action in its expected interval; assign,
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
| **Status outlives evidence.** A work item says `done` while the branch, tip, or artifact moved. | Re-read the target ref and artifact at the claimed tip. Never grade from the last status message. |
| **Green but never red.** A check has never failed on a real defect. | Ask for the mutation, seed, or production failure that flips it. If none exists, call it a claim, not a gate. |
| **Right output, wrong question.** A valid-looking number answers a neighboring question: attribution for ownership, liveness for restoration, a count for a mechanism. | State the question, unit, revision, and population in the same sentence as the result. Reject evidence taken from an instrument that cannot distinguish the subject. |
| **Green population excludes the subject.** A gate passes because a new or untracked artifact is outside the set that gate enumerates. | State the gate population and revision with every green. For tracked-file gates, stage every new file or run from the exact commit; an untracked change is outside the gate even when it is in the reported result. |
| **A correction reuses the defective instrument.** The replacement finding is a new claim about the same counter, probe, or query, and it keeps the original instrument's blind spot under more confident wording. | Re-run the falsifier against the correction before adopting it. Check the counter's full population, emission sites, and healthy comparator; a correction is not exempt from the check that invalidated the original. |
| **Report claims an action not taken.** A pass reports success while the state did not change. | Assert the observed result, not the intended action. A false action report is a failed pass even when the underlying mechanism works. |
| **Restore is treated as reversible.** A removed tree is recreated from its commit while untracked files, install state, or a live process are lost. | Before deletion, inspect ignored and untracked files and every listening process whose cwd is the tree. Treat a service on a deleted inode as down, not up. |
| **Review ceremony feeds itself.** More reviewers, more receipts, or a longer checklist appear without changing the landing decision. | Cap at one decision-changing pass unless new evidence or dispute exists. Disclose overlap and cross-check instead of building a queue of one. |
| **Write collision is mistaken for a seat shortage.** Several work items edit the same file, so more parallel workers make the problem worse. | Serialize by landing order for a write collision; spread only when the constraint is reviewer capacity. |
| **Finished work stays parked.** A reviewed branch is neither merged nor explicitly held. | Merge it to `main`, or record the measured reason it cannot land and the owner of the lift condition. A release line is temporary transit for named commits awaiting replay, not a second permanent home. Remove the worktree once merged. |
| **Ad-hoc probe has no claim.** A live service, database, credential, or machine-level surface is touched to answer a question nobody recorded. | Claim or post a one-line notice before the probe. Name the owning work item or thread, the surface, and what the read can change. A probe that may produce a new locator is still a claim; only waiting is exempt when the intended read would merely confirm the live owner's already-running hypothesis. |
| **Communication substitutes for disposition.** A long thread is mistaken for progress. | The tracker's deliverable is a changed board, tip, or explicit blocker; channel posts stay short and point to the owning artifact. |

## Failure-pattern capture

Finding a failure pattern is not finished by fixing the instance. Preserve the
primary evidence and correct the process:

1. **Capture** — copy the verbatim transcript into
   `~/Documents/process-failure-patterns/<project>/<date>-<short-name>/` and write
   `metadata.md` with: pattern name; date and revision; where it happened (channel,
   thread, work items); repo commit (exact, or the nearest commit if the exact one is
   unrecoverable); message-id locators; seat; the observed evidence
   verbatim; which instrument answered the wrong question; whether the instrument
   or the sentence was at fault; the failure class; the disposition; the cost; the
   corrective action; and where that correction now lives. Update the directory
   `README.md` index. Copy only the transcript segment that supports the capture,
   not the whole thread; compress or reference an oversized source when the
   relevant segment cannot be copied whole.
2. **Correct** — make the process change in its owning surface (skill, convention,
   check, or work item). Name the surface in `metadata.md`.
3. **Reuse** — the captures are inputs for later process refinement and evaluation
   samples for the change, so link the capture id from the work item that produced it.

An instance fixed without a capture reproduces; a capture without a correction is
a museum.

## What this seat owes the record

- **Pointer, not claim set.** Hand a fresh reviewer *where to look*, never what it will find.
- **Graph once per hour.** Every hour, echo the current workstream graph in the owning
  channel or thread: which lanes are active, who owns each, the next observable result,
  and what gates each lane. The 30-minute wake may update dispositions silently, but the
  hourly echo gives the whole team the same current map instead of requiring each seat
  to reconstruct it from work items and chat. The graph names lanes, not individual work items
  unless a work item is the lane's blocking gate.
- **Reachability is tested by tip, not by branch name.** A same-named stale remote branch is how a
  single-machine sprint looks healthy from every other row.
- **Dispositions, not silence.** A work item that stopped moving gets closed with a reason or re-reasoned;
  abandonment by omission is invisible on a board that only shows open work.
- **The label must be traceable to the measurement** — or the measurement replaces it. A word that
  grades severity softer *or* broader than the artifact is the same defect.
- **Every grading claim carries its command.** A count with no command becomes unreproducible the
  moment its author stops remembering it.
- **The board is reconciled, not narrated.** Every pass ends with a disposition for each active
  work item and a concrete next owner/action for every non-landed row.

## Liveness, and what follows a silent member

The board records ownership; **ownership is not activity**. A tracker's summary of another seat is
not evidence about that seat. Ask the member to answer for itself, in this thread, and treat its own
reply as the only witness that cannot be counterfeited from outside. The pasteable pass message and
diagnostic follow-up are in
[`project-tracker-message.md`](project-tracker-message.md).

### Ask, in the pass message

> **Members named on a row: reply here now with one line of your own progress** — what you have
> closed, what is open, and the one thing you are waiting on. **A row is not closed by the tracker
> describing you; it is closed by you saying where it stands.**

Why the member answers rather than the tracker: a status line cannot tell *assigned* from *moving*,
and neither can a summary written about someone. `active; online` read true for every seat that was
actually dead on 2026-10-02.

### A reply witnesses liveness at the moment of replying — not continuity

**Two different cases, and they must not be run together:**

- **A seat that is merely silent replies correctly once reached.** *So do not read a reply as
  continuity:* it proves *"I am alive now"*, not *"I was alive throughout"*.
- **A seat whose wakes all fail cannot reply at all.** On 2026-10-02 one seat was woken **93 times
  in a two-hour window and every wake failed** on a provider error. **No reply was possible until the
  session was reset — and from outside that looked exactly like silence.**

**The second case is why the diagnostics step exists.** Without it, a dead seat and a thinking seat
are indistinguishable, and the tracker either waits forever or resets a healthy session.

### Follow-up when a member does not answer: liveness → diagnostics → rescue

Three steps, not one. A seat that looks silent may be dead, wedged, or merely busy, and those need
different actions — so the tracker does not get to skip diagnostics.

1. **Silence age** — the timestamp of the member's last real tool call. *This says something is
   wrong. It does not say what.*
2. **Diagnostics — read the record, not the status line.** Look for a run of provider-error records
   in the member's transcript (`isApiErrorMessage`, or the harness's equivalent). **A wake that only
   fails looks exactly like silence from outside**, and 2026-10-02 produced 93 such wakes in one seat
   inside a two-hour window. *The error record names a failure; silence only implies one.*
3. **Rescue** — with a named failure the action is knowable. A saturated context needs a **clean
   session reset**, not a retry and not a nudge, because **every further turn re-sends the same
   context**. Preserve the transcript: it is the only evidence of what the seat was doing. Escalate
   to the accountable owner when the action is theirs to authorize.

| symptom | what it is | what it is not |
| --- | --- | --- |
| no reply, no tool calls, no error records | unknown — could be thinking | **not** evidence of death |
| no reply, a run of provider errors | a **named** provider failure | not merely idle |
| a reply | liveness **at that moment** | **not** proof of continuity |

**Bound to keep in the report:** state what was checked and when, and say plainly when the cause is
not established. *"Silent since `<ts>`, two provider errors at `<ts>`" is a diagnosis;
"unresponsive" is a guess.*

## Exit

Every wake ends `done` or `blocked`, and every blocked work item names its owner and lift condition. The
tracker's own deliverable is the corrected record, not a report about it.
