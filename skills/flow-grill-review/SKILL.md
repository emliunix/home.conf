---
name: flow-grill-review
description: >-
  Use when the user says flow:grill-review or flow:impl, asks to grill/review/defend
  a design, or needs to take a draft through review and implement it to pending-retro.
---

# Flow: Grill Review → Defend → Implement

> **Process is recommendation, not ceremony.** `flow-*` is a toolbox, not rigid enforcement. Weigh each step against the frozen requirements and current architecture. Skip any step that does not change the outcome. Completing a skill checklist is not success. Do not write designs, grills, or receipts whose only job is to bless work already specified.

**One job:** Turn an existing design draft into a **reviewed** design, then implement the reviewed design to `pending-retro`. Does not write the initial draft, does not commit, and does not close the loop (`flow-retro` does that).

This skill **composes** other skills — read and follow them; do not restate their internals:

- `flow-common` — the lifecycle vocabulary, role-to-impl mapping, and the implementation gate (round budget, verification, commits, stop condition, dispatch notes)
- `flow-retro` — closes the loop at `pending-retro` → `landed`

Design path convention: `design/NN-<topic>.md`, where `NN` is the lowest unused zero-padded sequential number (the folder's own `design/00-design-file-guide.md` documents the contract and the `NN`/`goal-`/`ref-` distinction). Do not renumber existing files — numbers are stable handles. If the caller gives a different path, use it, but flag the deviation.

The design's status words (`draft` → `reviewed` → `pending-retro` → `landed`) and the implementation gate live in `flow-common`; this flow sets `reviewed` at the review gate and `pending-retro` at the implementation gate per that skill.

## Section map

The design file is **canon**: intact current machine, direct speech. Grill ledgers do **not** live in the design body.

| Place | Owns |
| --- | --- |
| Design **User inputs** | Optional. Owner asks, verbatim, when present. A goal-file draft may copy these into the frozen root (`goal-file`). After that freeze, the goal file is the root. |
| Design **Goal** | Path to `goals/*.md` (administrative source). Omit only when no goal file exists. |
| Design **Review** | One backlink to `worklog/NN-<same-topic>.md` |
| Design **Status** | `draft` → `reviewed` when the review gate completes; `reviewed` → `pending-retro` when the implementation gate completes |
| Worklog `worklog/NN-<same-topic>.md` | Attack angles, findings, rejects, deferred items, exit outcomes, defense record, Simplicity delta, rematch, closing retro |

If the worklog file does not exist, create it. Do not paste angles, findings, or defense into the design. Accepted P1s rewrite the design body as current law (no “we rejected X” / historical tradeoff prose in the design).

## Preconditions

- Design draft exists on disk **and satisfies the Draft contract below** — a draft missing it is returned to the drafter untouched (cheap gate; prevents review churn).
- Assumptions are listed: observed facts (with source) vs inferences vs TBD
- Role occupancy follows `flow-common` Roles (architect/defender vs independent reviewer; implementer only if assigned).

## Draft contract

Every design file must open with **the three heads**, in order (this skill does not write drafts, but defines them — drafters, reviewers, defenders, and implementers all orient on these):

| Head | Content | Who consumes it and why |
| --- | --- | --- |
| **Problem statement** | The ONE major problem in 2–5 sentences: what hurts, for whom, why now. Not a feature list. | Everyone. Reviewers pick attack angles against it; the defender rejects findings that don't serve it; the implementer checks code against it. This is the anti-bikeshed anchor. |
| **Scope — what we touch** | Explicit list of the surfaces/components this design may modify, plus non-goals (what we will NOT touch). | Reviewers reject out-of-scope findings cheaply; implementer knows its boundaries; users can verify no silent scope creep. |
| **Rationale** | Why this machine is shaped this way, stated positively (observed facts + the mechanism). Alternatives considered and why they lost belong in the worklog. | Parties evaluate the reasoning; the worklog holds the tradeoff transcript so the design stays intact current speech. |

**User inputs** (optional, before the three heads when present): owner asks, verbatim. A goal-file draft may vendor these into the frozen root. Absence means a goal-file draft takes the Problem statement as already user-confirmed (`goal-file` freeze table). After freeze, do not treat this section as a second root.

Everything after the three heads is the **intact design body**. Direct speech: types, verbs, tables, wires, verification. No negative comparison to a discarded tree, no “rejected: …”, no epoch vocabulary of a past matcher. The only fixed tail on the design is **Goal** (admin source), **Review** (worklog backlink), and **Status**.

**The design file is the rulings home as current law** (the sentence that is true now). How that sentence was reached — grill, defense, rejected alternatives, RCA narrative — lives in the corresponding worklog. A ruling recorded only in a goal file dies when that goal closes. Goal files reference rulings by path (`design/NN §k`), never restate them.

Sizing: proportional to the problem. The contract is about PRESENCE of the three heads and orientation, not page count or fixed body structure. The heads exist so all parties focus on the major problem — a finding that touches neither Problem statement nor Scope is Reject/Defer by default, not a new work item.

# Review gate (grill → reviewed)

## Workflow

### 0. P0 project-contract check (always the FIRST review item)

Before any attack angle runs, test the draft's heads and body against the project's own declared P0 contract (its current-model law, banned classes, naming laws — whatever the project has legislated; if the project has none, skip this step). Suggested template when a project adopts a zero-compat posture: reject any second-world assumption, dual-world support (temporary included — violation at birth), epoch/transition vocabulary in code or docs vocabulary, shape-selection predicated on history rather than positive contract match, and structurally-compat arms — branches, history-only optionals, alias exports, tolerant parses of retired shapes, dead-era second implementations. Any hit = severity **blocker (P1)**, reviewed before all else — nothing below item 0 is weighed until it clears.

### 1. Plan attack angles

Write a **small set of high-value angles** into the **worklog** (`worklog/NN-<same-topic>.md`). Start from the scenario table that matches the draft (below). Default to 2–4 from that table; use fewer for a narrow design. Batch tightly related checks when one reviewer can evaluate them coherently. Process cost must not exceed task complexity.

**The tables are suggestions, not a closed set.** Add any further angle the draft actually needs (a seam, a reset, a named failure class, a copy law — whatever the problem requires). Do not refuse an appropriate extra angle because the default count is 2–4. Do not run the whole catalog as padding.

**Exceptions are allowed.** Skip a suggested row when it does not apply; record a one-line reason in the worklog (e.g. “observability N/A — no new writer”). Skipping without a reason is not an exception — it is an omitted check.

Angles must be concrete, evidence-seeking, and tied to the project/user outcome. Prioritize correctness boundaries, observed source behavior, minimum end-to-end path, scope, and verification. Add compatibility, migration, scale, or performance angles only when current evidence requires them—never for hypothetical future formats.

**Practice lessons (kept from earlier refinement — apply, don't re-learn):**

- **Metric correctness:** recompute any headline coverage/percentage with a union-of-spans / de-duplicated formulation before trusting it — sum-of-durations and single-segment-max-overlap both over/under-count (seen twice). "100%"/"clean" headlines get recomputed, not quoted.
- **Premise verification:** when the draft asserts a pipeline/stage behavior ("stage X reads Y"), verify against the code before accepting the premise — the framing may inherit an earlier wrong claim, and correcting it can reframe the whole scope. A premise correction is a design edit with a Revision-history entry, not an embarrassment.
- **Default-consistency:** a param default flipped in ONE surface (e.g. frontend `params.ts`) but not backend `Params`/CLI silently diverges — API/CLI jobs keep the old value (hit for both `stitch_sim` and `match_threshold`). When a default changes, check ALL creation surfaces (UI + API + CLI + tests) and verify each, not just the visible one.
- **Experiment specs:** any experiment in the design is specified as **INPUT → SUBJECT → OUTPUT** — INPUT: exact snippet(s) + params, pinned, small cuts (never full recordings); SUBJECT: the isolated lever/stage under test and the question it answers; OUTPUT: measured metrics + the pre-stated decision (ship / falsified / next lever). One question per experiment, paired baselines, a production-config witness, and diagnostics proving the lever actually engaged.

**The three heads are always reviewable claims**, not orientation-only decoration. Every grill checks them alongside the body:

- **Problem statement** — is this the RIGHT problem: one major thing, real (evidenced pain), not a feature wishlist wearing a problem costume?
- **Scope** — is the boundary drawn at the true operational edge: not padded with speculative surfaces, not clipped to avoid the hard part?
- **Rationale** — is the mechanism stated positively and does it follow from observed facts? Rejected alternatives (in the worklog) must match reality (no strawmen).

A defective head is a blocker: the whole design inherits it.

**P1 angles when a goal file exists** (skip with a one-line reason only when there is no goal file):

- **Design acceptance criteria** — the frozen-root rows this design claims to cover (`goal-file` **Covers**): would a pass deliver those rows? Are they named, falsifiable, and the dual-gate match (design gate vs live evidence)?
- **Requirements hierarchy** — valid path from those rows to the **frozen** root (live additions only; obsoleted additions do not bind). A design that satisfies a dangling or obsoleted addition and misses the frozen root is a blocker. After freeze, do not re-open the source User inputs / Problem statements as a second root.

These two are gate-blocking when they hit. They are not optional hardening.

#### Suggested angles by scenario

Pick the scenario(s) the draft actually touches. A wave that is both schema and UI takes rows from both tables, then cuts to what the heads need.

**Code** (API, pipeline, serving, system component)

| Angle | Ask |
|---|---|
| Observability | Every refusal/floor writes one structured log (or trace/metric) **before** the response, with a reason **class** — not raw upstream payloads. Silent floors fail. |
| Testability | Clear boundary; relying parties swap behind interfaces. Producer↔consumer claims have **one golden** through the real path, not two mocked literals. A trait/interface makes code testable, but **test mocks must be thin and must never live in production code** — unless genuinely general (`InMemoryXxx`). A double that ships is a second implementation of the verb, reachable from a real entry point (see Seam honesty). A production name beginning `Mock` is either misplaced or misnamed: decide which. |
| Failure / atomicity | What is in the tx vs outside it; replay/idempotency; typed outcome vs generic 500. |
| Seam honesty | One writer per field class; no silent second implementation of the same verb. |
| Minimum e2e | One real-data happy path named; verification proves that path. |

**Schema** (DDL / object-model). A grill that only checks “column X added” is incomplete — the object, not the patch.

| Angle | Ask |
|---|---|
| Not a sole field change | Identity, uniqueness, and what the row *is*. |
| Mutability | Who may write, when, in what tx. Immutable vs CAS vs append-only vs tombstone. |
| Semantics | Domain meaning of the field. Null / absent / invalid are named. |
| Related operations | Every verb that creates, reads, freezes, or GC’s this object is in the design (or explicitly non-goal). Schema without ops is unfinished. |

**UI** (console / pages / components). Check against `ux-ui-code` (quality review + component analysis + general UI laws). Do not duplicate that skill here. Workspace console law, when present, is the project UX file — not a second catalog in this flow.

| Angle | Ask (see `ux-ui-code`) |
|---|---|
| Operation flows | Stories + `Where → See → Do → Opens → Select → After` (or the skill’s primary/recovery/edge flows). A page can fail the flow. |
| Element / component | `element → component → input → states → wire arm`. No silent one-off. |
| Semantics | User nouns/verbs; internal machinery quarantined; one meaning per word. |
| Visual quality | Hierarchy, density, composition — not a wireframe dumped into kit classes. |
| Constrained input | Enumeration → **selector**, not typed membership (`ux-ui-code` general UI law). Empty/floor of the selector is designed. |
| Honest affordances | Unwired acts absent or typed; no disabled tease. |
| State postures | Loading / empty / error / success / terminal each have a next step. |
| Copy + first-time | Verbatim inventory; a first-time user can walk the flow. |
| Confirm / door | Mutating acts use the designed confirm; navigable doors are marked. |

### 2. Review (single independent reviewer seat)

Use a **single independent reviewer seat / subagent** (`flow-common` Roles) that batches all planned attack angles into one brief. Do not spawn multiple parallel subagents per angle — the context warm-up cost is expensive and unnecessary. The single reviewer evaluates all angles in one turn, keeping angles distinct in its report. Reviewers do not edit the design, adjudicate, or implement.

Give the reviewer the draft path, all planned angles, relevant source paths, **the three heads excerpted into the brief (they review these, not just read them)**, the frozen root rows this design **Covers** when a goal file exists, and the user goal. Every reviewed angle must emit one entry with exactly one reviewer verdict from this list:

- **`PASS`** — the supplied artifact and evidence satisfy this angle;
- **`NEEDS-FIX`** — an evidenced defect, mismatch, or insufficiency exists; or
- **`NOT-REVIEWABLE`** — the angle cannot be evaluated because named context,
  artifact material, or reproducible evidence is missing or unusable.

`PASS`, `NEEDS-FIX`, and `NOT-REVIEWABLE` are reviewer verdicts for the supplied
angle only; none is a lifecycle promotion. `FIX`, `NO-GO`, `ACCEPT`, `REJECT`,
and `DEFER` are not reviewer verdicts. They belong to supervisor/defender
adjudication after the review. `NEEDS-FIX` and `NOT-REVIEWABLE` are terminal
reviewer outputs: the reviewer reports the gap and stops; it does not obtain the
missing material or repair it.

```
Reviewer verdict: PASS | NEEDS-FIX | NOT-REVIEWABLE
Angle: the named review angle or acceptance row
Evidence: (observed source, file path + location, or reproducible fact)
User impact: why this matters to the stated outcome
Severity: blocker | optional hardening | question (required for NEEDS-FIX;
  omit for PASS)
Suggested resolution boundary: optional owner/action category only; do not
  implement, amend the artifact, author evidence, or make a gate decision
Missing / blocked: required only for NOT-REVIEWABLE
```

A **blocker** means the design cannot safely achieve its stated current outcome. Optional hardening cannot block landing and must not silently enter scope. (Reviewer severity is a hint; the defender re-ranks every `NEEDS-FIX` P1/P2/P3 at adjudication — see §3 — and only P1s block the review gate.)

If context or evidence is unavailable, exit instead of guessing:

```
Reviewer verdict: NOT-REVIEWABLE
Exit reason: incomplete context | cannot complete directly
Completed: …
Missing / blocked: …
Suggested resolution boundary: obtain the named input or route the angle to
  the owning supervisor/fact/evidence lane; do not obtain it here
```

### 3. Defend — reduce complexity and protect scope

Defense is not verdict bookkeeping. The architect re-derives the smallest design that solves the observed cases, then adjudicates findings against it. **Reject irrelevant or speculative complexity with concrete evidence. Prefer removal, reuse, and a real-data-first vertical slice.**

Mandatory defense lens (record concise answers or point to design sections):

- **Problem statement first:** does this finding serve the stated major problem and fall inside the declared scope? Off-problem or out-of-scope findings default to Reject (invalid) or Defer (needs evidence) — they never become work items by accretion
- Project/user goal; scope and explicit non-goals
- True operational boundary and failure/atomicity boundary
- Observed source data versus inference/TBD
- First-principles architecture derived from actual problem study
- Minimum end-to-end happy path using real representative data
- Complexity budget: overdesign/YAGNI and whether process cost is proportional
- Existing architecture reuse versus necessary source-specific seams
- Compatibility/versioning only where evidenced; no speculative future compatibility
- Operational scale/performance proportional to observed needs
- Reversibility and cost of changing the decision later
- Verification value: does each criterion prove the user outcome?
- For each finding: necessity, concrete evidence, and smallest correction
- Removal/simplification opportunities and role separation
- Whether any accepted finding expands scope; if so, reject it or obtain explicit scope authorization

This is **review-gate defense** of grill findings on a draft. It is not `flow-common` breakout adjudication (impl-loop halt → architecture redesign). Do not start architecture redesign from a grill finding without that halt.

Adjudicate each finding — every defended finding carries BOTH a verdict and an importance rank:

- **Accept:** necessary for the current outcome and evidenced; apply the smallest correction to the design body as current speech; log the verdict in the worklog.
- **Reject / WON'T DO:** irrelevant, speculative, disproportionate, outside scope, or not important. Mark clearly as **`NOT_IMPORTANT` / `WON'T DO`** in the worklog with a concise rebuttal/reason, and **stop taking further actions** or expanding focus on it. Do not track, do not sweep into follow-ups, and do not let it distract the loop.
- **Defer:** a decision truly depends on named missing evidence; record how to obtain it. A defer blocks the review gate only when it concerns a current correctness boundary (see P1).

**Importance rank (assigned by the defender, consistently — reviewer severity is input, the P-rank is the landing-relevant truth):**

- **P1 — gate-blocking.** The stated Problem's outcome is unsafe/wrong/undelivered without it. Accepted P1s must be fixed (smallest correction) before the review gate passes; a P1 Defer blocks the gate until its named evidence is obtained. Accepted P1s are the ONLY findings that force a rematch.
- **P2 — this-cycle-if-cheap.** Real value, not blocking. Fix alongside P1s when the correction is cheap; otherwise sweep into the follow-up design (below).
- **P3 / NOT_IMPORTANT — noise floor / won't do.** Nits, taste, speculative hardening, or unimportant items. Mark **`NOT_IMPORTANT` / `WON'T DO`** and stop further action. P3s never force a rematch, never justify another implementer round, and must not consume attention.

**Follow-up sweep (systematic, not a laundry list):** every accepted-but-unfixed P2/P3 gets a destination before the review gate passes: a follow-up design file at the next free design number (`design/NN-<topic>.md`, `Status: draft-followup`), seeded with findings **grouped by functional unit** (coherent clusters — e.g. "test hygiene", "UX polish", "operational tooling" — each unit named by what a reader would recognize as one job, not by finding id). The file carries no three heads and no obligation until someone picks it up; when picked up, the units become the scope of a normal design and the heads get written before grill. A finding with no sweep destination and no fix is not "deferred" — it is untracked, which is forbidden.

Batch ALL adjudications of a wave into one defense record; continue the defense lens checklist as ordered by rank (P1s get full rigor; P3s get one line).

Treat `NOT-REVIEWABLE` exits separately: the supervisor may obtain the missing
evidence through its owning fact/evidence lane, reframe or drop the angle with a
reason, or revise away its relevance. The reviewer does none of those actions.
Do not turn unavailable evidence into invented requirements.

After defense, add an explicit **Simplicity delta** in the worklog: what was removed, what was retained, and why each retained element is necessary to the user outcome.

### 4. Rematch and pass the review gate

A rematch is the full match re-run, not one delegated verdict to wait on: an independent **re-review** leg (`flow-common` Roles), then this session's own defense and correction of what it returns. Only the review leg is independent; adjudication and rewriting stay with the architect/defender duty and are never delegated. Require one only after accepted **P1** changes. P2/P3 acceptances, rejected findings, editorial corrections, and non-blocking defers do not force ritual rematches. The re-review checks the accepted P1s and resulting design as a coherent whole; it does not reopen scope without new evidence.

Pass the review gate when — **GO condition is: every accepted P1 is solved.** Nothing more is required:

1. All accepted P1 findings are resolved (smallest correction applied to the design body, or a P1 Defer discharged with its named evidence)
2. Design body is intact current speech; rejected items, defense, and Simplicity delta are in the worklog; every accepted-but-unfixed P2/P3 has its follow-up sweep destination recorded (file + functional unit) — unfollowed "we'll get to it" notes do not count
3. The minimum real-data happy path and outcome-proving verification are coherent
4. Design **Review** backlinks the worklog; no unauthorized scope expansion remains
5. Set `Status: reviewed`
6. **Supervisor gate** (`flow-common` orchestrator): re-warm on the goal hierarchy and this design, then dispatch `flow:impl` or not. Review-passed is not impl-started.

**Stop condition:** stop reviewing when these conditions hold. Do not add angles, hardening, compatibility, or process steps without new evidence tied to the current goal.

# Implementation gate (reviewed → pending-retro)

The implementation gate — roles, round budget, verification, commits, stop condition, dispatch — is `flow-common`'s Implementation gate. Follow that skill: implement the reviewed slice only after the review gate **and** the supervisor gate pass; end the stage by setting `Status: pending-retro` and handing to `flow-retro`.

## Out of scope

- Writing the first draft of the design
- Closing the loop — the retro stage and `Status: landed` belong to `flow-retro`
- Git commits (caller authorizes commits)
- Rewriting grill/review/defend or retro section formats (retro owns its format)
- The lifecycle vocabulary and implementation-gate machinery (hosted by `flow-common`)

## Done checklist

Review gate:

- [ ] Draft satisfies the Draft contract (the three heads — Problem statement / Scope / Rationale — present and loaded, not boilerplate; body free-style)
- [ ] Small, outcome-focused attack set reviewed independently where useful
- [ ] Every reviewed angle has exactly one reviewer verdict (`PASS`, `NEEDS-FIX`, or `NOT-REVIEWABLE`); each `NEEDS-FIX` later receives a separate defender verdict + P-rank with the defense batched in one record
- [ ] GO condition met: every accepted P1 solved; unfixed P2/P3 swept to the follow-up design file, grouped by functional unit
- [ ] Defense lens completed; each verdict evidenced; scope expansion rejected or authorized
- [ ] Design body updated for accepted P1s as current speech; Simplicity delta recorded in the worklog
- [ ] Design **Review** is a worklog backlink only (no ledger pasted into the design)
- [ ] Rematch (P1-triggered only) passed if required; `Status: reviewed` set
- [ ] Goal-file P1 angles (AC rows + path to root) ran or were skipped with a no-goal-file reason
- [ ] Supervisor gate passed (re-warm, then `flow:impl` or halt) before implementation

Implementation gate (`flow-common`'s checklist governs):
