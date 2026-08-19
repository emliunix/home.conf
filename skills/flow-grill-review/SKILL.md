---
name: flow-grill-review
description: >-
  Use when the user says flow:grill-review, asks to grill/review/defend a design,
  or needs to turn a draft into a finalized design before implementation.
---

# Flow: Grill → Review → Defend

**One job:** Turn an existing design draft into a **landed** design. Does not write the initial draft, implement, or commit.

Design path convention: `design/NN-<topic>.md`, where `NN` is the lowest unused zero-padded sequential number (the folder's own `design/00-design-file-guide.md` documents the contract and the `NN`/`goal-`/`ref-` distinction). Do not renumber existing files — numbers are stable handles. If the caller gives a different path, use it, but flag the deviation.

## Section map

| Section | Owns |
| --- | --- |
| **Review log** | Attack angles, findings, rejects, deferred items, exit outcomes |
| **Revision history** | Accepted design edits and the post-defense Simplicity delta |
| **Status** | `draft` → `landed` when this flow completes |

## Preconditions

- Design draft exists on disk **and satisfies the Draft contract below** — a draft missing it is returned to the drafter untouched (cheap gate; prevents review churn).
- Assumptions are listed: observed facts (with source) vs inferences vs TBD
- Architect/designer owns the design and defense; reviewer is independent. If an implementer is also assigned, architect, implementer, and reviewer are pairwise distinct.

## Draft contract

Every design file must open with **the three heads**, in order (this skill does not write drafts, but defines them — drafters, reviewers, defenders, and implementers all orient on these):

| Head | Content | Who consumes it and why |
| --- | --- | --- |
| **Problem statement** | The ONE major problem in 2–5 sentences: what hurts, for whom, why now. Not a feature list. | Everyone. Reviewers pick attack angles against it; the defender rejects findings that don't serve it; the implementer checks code against it. This is the anti-bikeshed anchor. |
| **Scope — what we touch** | Explicit list of the surfaces/components this design may modify, plus non-goals (what we will NOT touch). | Reviewers reject out-of-scope findings cheaply; implementer knows its boundaries; users can verify no silent scope creep. |
| **Rationale** | Why this approach: key alternatives considered and why they lost, tied to observed facts. | Parties evaluate the reasoning, not just the conclusion; prevents re-litigating settled tradeoffs every round. |

Everything after the three heads is the **detailed design body — free-style organization**: the drafter names and orders those sections (goal, mechanism, key decisions, verification criteria, …) to fit the problem. The only fixed tail is what this skill owns per the Section map: Review log, Revision history, Status (draft → landed).

Sizing: proportional to the problem. The contract is about PRESENCE of the three heads and orientation, not page count or fixed body structure. The heads exist so all parties focus on the major problem — a finding that touches neither Problem statement nor Scope is Reject/Defer by default, not a new work item.

## Workflow

### 0. P0 project-contract check (always the FIRST review item)

Before any attack angle runs, test the draft's heads and body against the project's own declared P0 contract (its current-model law, banned classes, naming laws — whatever the project has legislated; if the project has none, skip this step). Suggested template when a project adopts a zero-compat posture: reject any second-world assumption, dual-world support (temporary included — violation at birth), epoch/transition vocabulary in code or docs vocabulary, shape-selection predicated on history rather than positive contract match, and structurally-compat arms — branches, history-only optionals, alias exports, tolerant parses of retired shapes, dead-era second implementations. Any hit = severity **blocker (P1)**, reviewed before all else — nothing below item 0 is weighed until it clears.

### 1. Plan attack angles

Write a **small set of high-value angles** into the Review log. Start from the scenario table that matches the draft (below). Default to 2–4 from that table; use fewer for a narrow design. Batch tightly related checks when one reviewer can evaluate them coherently. Process cost must not exceed task complexity.

**The tables are suggestions, not a closed set.** Add any further angle the draft actually needs (a seam, a reset, a named failure class, a copy law — whatever the problem requires). Do not refuse an appropriate extra angle because the default count is 2–4. Do not run the whole catalog as padding.

**Exceptions are allowed.** Skip a suggested row when it does not apply; record a one-line reason in the Review log (e.g. “observability N/A — no new writer”). Skipping without a reason is not an exception — it is an omitted check.

Angles must be concrete, evidence-seeking, and tied to the project/user outcome. Prioritize correctness boundaries, observed source behavior, minimum end-to-end path, scope, and verification. Add compatibility, migration, scale, or performance angles only when current evidence requires them—never for hypothetical future formats.

**The three heads are always reviewable claims**, not orientation-only decoration. Every grill checks them alongside the body:

- **Problem statement** — is this the RIGHT problem: one major thing, real (evidenced pain), not a feature wishlist wearing a problem costume?
- **Scope** — is the boundary drawn at the true operational edge: not padded with speculative surfaces, not clipped to avoid the hard part?
- **Rationale** — do the rejected alternatives match reality (observed facts cited, no strawmen), and does the chosen approach actually follow from them?

A defective head is a blocker: the whole design inherits it.

#### Suggested angles by scenario

Pick the scenario(s) the draft actually touches. A wave that is both schema and UI takes rows from both tables, then cuts to what the heads need.

**Code** (API, pipeline, serving, system component)

| Angle | Ask |
|---|---|
| Observability | Every refusal/floor writes one structured log (or trace/metric) **before** the response, with a reason **class** — not raw upstream payloads. Silent floors fail. |
| Testability | Clear boundary; relying parties swap behind interfaces. Producer↔consumer claims have **one golden** through the real path, not two mocked literals. |
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


### 2. Review (parallel where useful)

Use independent reviewers for materially independent angles; do not spawn one agent per trivial check. Reviewers do not share findings, edit the design, adjudicate, or implement.

Give each reviewer the draft path, its angle(s), relevant source paths, **the three heads excerpted into the brief (they review these, not just read them)**, and the user goal. Every finding must state:

```
Finding: …
Evidence: (observed source, file path + location, or reproducible fact)
User impact: why this matters to the stated outcome
Severity: blocker | optional hardening | question
Smallest correction: minimum change that resolves the evidenced issue
```

A **blocker** means the design cannot safely achieve its stated current outcome. Optional hardening cannot block landing and must not silently enter scope. (Reviewer severity is a hint; the defender re-ranks every finding P1/P2/P3 at adjudication — see §3 — and only P1s block landing.)

If context or evidence is unavailable, exit instead of guessing:

```
Exit reason: incomplete context | cannot complete directly
Completed: …
Missing / blocked: …
Smallest next step: …
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

Adjudicate each finding — every defended finding carries BOTH a verdict and an importance rank:

- **Accept:** necessary for the current outcome and evidenced; apply the smallest correction and log it in Revision history.
- **Reject:** irrelevant, speculative, disproportionate, or outside scope; record rebuttal evidence.
- **Defer:** a decision truly depends on named missing evidence; record how to obtain it. A defer blocks landing only when it concerns a current correctness boundary (see P1).

**Importance rank (assigned by the defender, consistently — reviewer severity is input, the P-rank is the landing-relevant truth):**

- **P1 — landing-blocking.** The stated Problem's outcome is unsafe/wrong/undelivered without it. Accepted P1s must be fixed (smallest correction) before landing; a P1 Defer blocks landing until its named evidence is obtained. Accepted P1s are the ONLY findings that force a rematch.
- **P2 — this-cycle-if-cheap.** Real value, not blocking. Fix alongside P1s when the correction is cheap; otherwise sweep into the follow-up design (below).
- **P3 — noise floor.** Nits, taste, speculative hardening. Default verdict Reject; if adopted, either fold in silently with zero ceremony or sweep into the follow-up design if genuinely valuable. P3s never force a rematch, never justify another implementer round.

**Follow-up sweep (systematic, not a laundry list):** every accepted-but-unfixed P2/P3 gets a destination before landing: a follow-up design file at the next free design number (`design/NN-<topic>.md`, `Status: draft-followup`), seeded with findings **grouped by functional unit** (coherent clusters — e.g. "test hygiene", "UX polish", "operational tooling" — each unit named by what a reader would recognize as one job, not by finding id). The file carries no three heads and no obligation until someone picks it up; when picked up, the units become the scope of a normal design and the heads get written before grill. A finding with no sweep destination and no fix is not "deferred" — it is untracked, which is forbidden.

Batch ALL adjudications of a wave into one defense record; continue the defense lens checklist as ordered by rank (P1s get full rigor; P3s get one line).

Treat reviewer exits separately: obtain the missing evidence, reframe/drop the angle with a reason, or revise away its relevance. Do not turn unavailable evidence into invented requirements.

After defense, add an explicit **Simplicity delta**: what was removed, what was retained, and why each retained element is necessary to the user outcome.

### 4. Rematch and land

Require a clean independent rematch only after accepted **P1** changes. P2/P3 acceptances, rejected findings, editorial corrections, and non-blocking defers do not force ritual rematches. The rematch checks the accepted P1s and resulting design as a coherent whole; it does not reopen scope without new evidence.

Land when — **GO condition is: every accepted P1 is solved.** Nothing more is required:

1. All accepted P1 findings are resolved (smallest correction applied, or a P1 Defer discharged with its named evidence)
2. Accepted revisions are in the design body; rejected items carry rebuttal evidence; every accepted-but-unfixed P2/P3 has its follow-up sweep destination recorded (file + functional unit) — unfollowed "we'll get to it" notes do not count
3. The minimum real-data happy path and outcome-proving verification are coherent
4. Simplicity delta is recorded and no unauthorized scope expansion remains
5. Set `Status: landed`

**Stop condition:** stop reviewing when these landing conditions hold. Do not add angles, hardening, compatibility, or process steps without new evidence tied to the current goal.

## Out of scope

- Writing the first draft of the design
- Implementation / execution
- Git commits (caller or `flow-impl` commits)

## Done checklist

- [ ] Draft satisfies the Draft contract (the three heads — Problem statement / Scope / Rationale — present and loaded, not boilerplate; body free-style)
- [ ] Small, outcome-focused attack set reviewed independently where useful
- [ ] Each finding carries verdict + defender-assigned P-rank with smallest correction named; defense batched in one record
- [ ] GO condition met: every accepted P1 solved; unfixed P2/P3 swept to the follow-up design file, grouped by functional unit
- [ ] Defense lens completed; each verdict evidenced; scope expansion rejected or authorized
- [ ] Design body updated for accepted P1s; Simplicity delta recorded
- [ ] Rematch (P1-triggered only) passed if required; `Status: landed` set
