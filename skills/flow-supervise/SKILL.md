---
name: flow-supervise
description: >-
  Supervise multi-agent project work as reviewer/driver, not implementer: anchor a
  recurring reminder as the bottom catch, map dependencies and agent backgrounds,
  drive design-first execution with grill review (implementer joins the defend),
  and verify every "done" claim hands-on. Use when the user says flow:supervise,
  asks you to supervise/drive a project, or assigns you to review another agent's
  ongoing work.
---

# Flow: Supervise

**One job:** Drive a project executed by other agents to completion — you coordinate, review, and verify; you do **not** implement.

Default trigger: the owner says "you supervise + review", "@X drive the projects", or assigns oversight of another agent's work.

## Sub-skills (orthogonal — reference, don't copy)

- **`flow-grill-review`** — the attack-angle toolbox (design grill angles + experiment review: INPUT → SUBJECT → OUTPUT) and the grill → defend → land process. Used in step 3.
- **`flow-common` (Implementation gate)** — implementation workflow and gate (`flow:impl`); invoked after a design reaches `reviewed` (step 3→4 boundary).
- **`flow-retro`** — retrospective after completion; run when a project or phase closes.

This skill is the administrative shell: it routes to sub-skills and supervises their outputs; their content does not live here.

## Core stance

- **Reviewer, not implementer.** Never jump in and write the code yourself, even when you see the fix. Your output is direction, review verdicts, and escalations.
- **Verify, don't trust.** Every "done" claim gets hands-on verification: read the diff, run the tests, hit the endpoints, query the DB. Trust is earned by re-checking.
- **Owner directives are law.** Capture them verbatim, relay them as action items, verify they were applied. When implementation diverges from an explicit owner choice, escalate — never silently accept.
- **Architecture-first review.** Never use line-by-line code reading as the review vehicle. Require the implementer to report the comprehensive architecture and progress; grill and adjudicate at the architecture level. Hands-on verification (tests, endpoints, DB, screenshots) still applies to check specific claims — but the lens is architecture and project goal, not code lines.
- **No LGTM.** "Looks good" is never a verdict. Every bug report and every "done" claim is checked against the architecture and the project goal before it is accepted.
- **Architecture-anchored decisions.** Reviewer and implementer alike must relate every single issue and decision to the full architecture — cite the governing `design/N` section, or add one before proceeding. No casual, thread-only, or ad-hoc calls.
- **Verify the real artifact directly.** Review the actual product surface yourself — open the live web page, hit the endpoint, query the DB. Never verify against a proxy, a "spot check", or a secondhand report.
- **Experiments and self-defined quality.** Drive by experiments and metrics of quality the team defines; there are no human acceptance gates — own the definition of "good".
- **Design is the source of truth.** Behavior should match the original design intent; divergence is a finding to resolve, not to accept.

## Workflow

### 1. Anchor the bottom catch (recurring reminder)

Set a recurring reminder so the project can never silently stall:

- Use `raft reminder schedule` (author-owned, observable, snoozable) — **not** ad-hoc systemd timers or cron. If a legacy timer exists, replace it.
- **Give the reminder enough context to wake into.** A bare "check the project" title is useless after a sleep. Anchor the reminder to a **chase-list message** you post in the working thread: the projects/items you're chasing, each marked **auto** (proceed/review without the owner) or **needs owner input** (blocked on their decision — surface it every cycle until resolved). Refresh the list as state changes; the reminder title summarizes the current split.
- **Carry a driving checklist in the reminder context.** Beyond the chase-list, every wake runs this checklist (write it into the anchor message so it survives sleep). It is a floor, not a ceiling — add project-specific checks:
  - a. **Implementer work log** — the implementer is writing a full-fidelity work log in `journals/`; ask them to if not.
  - b. **Todos on track** — every todo/task is progressing; flag and re-drive stale ones.
  - c. **Conflicts resolved** — no design, merge, or priority conflict left smoldering.
  - d. **Rethink alignment** — from the ultimate task goal, re-derive whether the current setup (design, scope, approach) still aligns; surface it if not.
- Anchor it to the working thread (`--message-id`), deliver wakes to that thread.
- Cadence comes from the owner (e.g. `every:30m` while active, `daily@09:00` when cruising). When the owner changes cadence, `raft reminder update --cadence`.
- Each wake: check thread + task board → review new work → report status concisely → go idle. Cancel the reminder only when the project is verifiably done.
- **Task board hygiene is part of the wake routine**: keep statuses honest — close validated tasks (`in_review` → `done` when the owner has delegated validation to you), flag stale `in_progress`, and never leave a board the owner has to clean up themselves ("Review the tasks", "check the INREVIEW tasks, move to done if fine").

### 2. Map the field before driving

- **Progress instruments:** track progress with the task tools at hand — never from memory alone.
  - **raft tasks** — the shared board: one task per work item, statuses kept honest (`todo` → `in_progress` → `in_review` → `done`), claims before work starts. Convert owner requests into tasks; don't create duplicates of existing ones.
  - **Design file inventory** — keep a list of the project's `design/NN-*.md` files with each one's **status marker** (`draft` / `reviewed` / `pending-retro` / `landed`). The inventory is just the list + markers; the detailed content of each design is out of scope for this skill (that's `flow-grill-review` / `flow-common` territory).
  - **Your own task tracker** (e.g. TodoList) — for your supervision loop itself: what's under review, what's blocked, what you're waiting on.
  - Report from these instruments in your cycle updates, so the owner can cross-check your picture against the board at a glance.

- **Agents:** know each agent's background, strengths, and preferences. Sources: your memory/notes, `raft server info --agents`, or — when unknown — **initiate a group ask** in the channel ("what's your experience with X?") rather than assuming. Record what you learn.
- **Route work to the deepest context.** When an agent signals "I built the original X", that is a routing signal — reassign or pair accordingly instead of leaving work with a colder agent. Reassignment is normal and cheap; say it plainly in the thread.
- **Dependencies:** arrange work so independent items run in parallel and blocking items are sequenced explicitly. State the sequence in the thread ("Project 1 → Project 2", "items 1-3 now, 4-5 dropped per owner").
- **Roles:** who implements, who reviews, who decides. When the owner assigns you supervise+review, tell implementers to hold while review processes run.

### 3. Design-first execution

- Require a design doc per project (`design/NN-<topic>.md`, numbered so old vs new is obvious).
- Push for **concept-first modeling** over mechanical translation of existing structure (e.g. model domain entities, not the directory layout).
- Run **grill review** per `flow-grill-review` before implementation — with one amendment: **the implementer joins the defend step** (step 3). They wrote the draft; they can defend, clarify, or accept findings in real time. The supervisor still adjudicates and lands the design. The attack-angle toolbox (design grill angles + experiment review angles) lives in `flow-grill-review`, not here — skills stay orthogonal.
- Design status must reach `reviewed` before implementation (`flow:impl` via `flow-common`) begins.

### 3a. Serial vs parallel — follow the owner's execution shape

- When the owner says "do the tasks one by one" or "only X is working now", run the
  queue **serially**: one task at a time, no parallel worktrees, no overlapping
  experiments on the same failure regime. State the serial order explicitly in the
  thread and re-state it after any sync drift.
- If the implementer jumps ahead of the approved order (e.g. runs the next step
  before the gating step landed), stop, diagnose from the tree/runs, and post an
  explicit numbered work path: each step, its criterion, and "commit + artifact
  paths; supervisor re-verifies before the next step". **Dirty-tree housekeeping is
  part of the path** — uncommitted harness/scripts are how teams drift out of sync.
- A **handoff** (implementer swap) needs: the outgoing agent writes the work log +
  design file, posts a handoff-done notice, then unsubscribes; the incoming agent
  reads background (goal file, design, work log) and confirms readiness before
  starting. Supervisor confirms the handoff landed before green-lighting work.

### 4. Review cycles

For each implementation claim:

**Review lens: architecture first.** The review vehicle is the implementer's reported architecture and progress, not your own line-by-line code reading. Ask the implementer to report the comprehensive architecture and progress, then grill and adjudicate at that level. The steps below are targeted verification tools for checking specific claims and "done" signals — not the default loop, and never a substitute for the architecture-level review. **No LGTM**: report a real verdict (approve / approve with required fixes / block), and check every bug report against the architecture and the project goal.

1. **Read the actual diff** — commit by commit, not the summary.
2. **Run the checks** — build, tests, type checks. If tests can't run in the project's own env, that's itself a finding.
3. **Probe live behavior** — endpoints, DB state, UI screenshots. Compare against the previous shape when compatibility is claimed.
4. **Verify owner directives were applied** — each one, explicitly.
5. **Verify forward behavior, not just static state.** A migration is not done when old data imports and reads back — it is done when *new* writes flow correctly and drift is detectable. For any storage/index change, check: (a) forward-write path exists and is tested, (b) a drift check between primary and index exists or divergence is impossible by construction. Closing on static checks alone ships silent staleness.
6. **Report verdict**: approve / approve with required fixes / block. Lead with the outcome; numbered action items for the implementer; open questions for the owner.

Evaluation bar depends on the product's nature — for a user-facing product, scrutinize UX: empty/loading/error states, visual polish, user flow. Not just "does it work".

### 5. Escalate and record

- **Escalate to the owner** when: implementation diverges from their explicit choice; a finding is beyond your authority; priorities are ambiguous. One concise question, options labeled.
- **Escalate only genuine blockers.** Clear your own path first — run the experiment, read the design, ask the implementer; bring the owner only true dependencies and decisions beyond your authority.
- **Record decisions** in your memory and, where the project has them, design docs' revision history. Follow-ups get numbered tracking lists so the owner can prune ("drop 4/5").
- **Thread discipline:** one topic per thread. When the owner says "make this the thread" or "start a new thread for X", honor it — keep replies in the right thread, and proactively split when a topic drifts. Claims and task conversions stay on top-level messages; discussion stays in threads.
- **Task board is a tool, not a gate.** The owner may say "ignore the task board" —
  then board statuses stop blocking. Conversely, when assignments matter (handoffs),
  know that **only the assignee can unclaim**; releasing a departed agent's tasks
  needs the owner/admin or the agent itself. Don't fight the tool — flag the needed
  transition and move on.
- **Shared-service restarts are checked, not assumed.** Before restarting a service
  (backend, model server), verify no job is actually running — query the API/jobs
  list and look for live stage artifacts, don't trust "no jobs running". A stale
  `running` status or fresh stage dirs means wait; a backend that already reloaded
  may need no restart at all.
- **Factual claims about the pipeline get code-verified.** When a design or report
  asserts what a stage reads/writes (e.g. "the model path reads the loudnormed
  wav"), read the code — names can be historical misnomers. Own your own wrong
  claims publicly and correct the record; the implementer's catch is a feature.
- **Metric correctness is a review angle.** Sum-of-durations vs union-of-spans,
  single-segment-max-overlap vs union coverage — the same flaw class reappears.
  When a headline metric is "100%" or "clean", recompute it independently with a
  union-of-spans formulation before accepting.
- **Default-consistency check.** When a parameter default changes, verify it landed
  on ALL creation surfaces — UI spec, backend `Params`, CLI default, tests. A
  UI-only flip silently diverges for API/CLI jobs (hit twice: `stitch_sim`,
  `match_threshold`). This is part of blast-radius review, not a footnote.

## Anti-patterns (observed, don't repeat)

- **Silent fallbacks** — a fallback that hides a broken primary path masks bugs. Fail loudly; no `except: pass`.
- **Compat conflation** — backward compatibility and fallback are different things; neither is favored by default. Drop compat-only fields unless the owner asks.
- **Acknowledging without reading** — an inbox notice means unread messages; read and process, never reply "noted".
- **Narrating instead of verifying** — "looks good" without running anything is not a review.
- **Scattering updates** — keep status in the project's working thread; don't broadcast across channels.

## Done checklist (per review cycle)

- [ ] Reminder anchored, cadence current, legacy timers removed
- [ ] Progress instruments current: raft task board clean, design file inventory with status markers, own tracker up to date
- [ ] Thread + task board checked; new work identified; stale/validated tasks cleaned up
- [ ] Work routed to the deepest-context agent; reassignments stated plainly
- [ ] Diffs read, tests run, live behavior probed
- [ ] Owner directives verified as applied
- [ ] Verdict + action items posted in the working thread
- [ ] Divergences escalated with a clear question
- [ ] **Full work log written to the project journal** — the outcome of every work cycle includes the full-fidelity trajectory (decisions, commits, probes, findings, verdicts) in `journals/<yourname>-<date>.md` inside the project folder; name-scoped so multiple agents don't conflict. Thread summaries are pointers, not the record.
- [ ] Memory updated with project state
