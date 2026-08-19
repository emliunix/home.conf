---
name: flow-impl
description: >-
  Use when the user says flow:impl or asks to execute a design through
  implementation and verification for a design number.
---

# Flow: Impl

**One job:** Orchestrate **landed design → implementation → outcome verification** for one design number `NN`, one gate at a time.

**Landed** means the design passed `flow-grill-review` and shows `Status: landed`.

This skill **composes** other skills — read and follow them; do not restate their internals:

- `flow-grill-review` — land a draft through focused independent review and active defense
- `flow-retro` — use only when execution evidence reveals design mismatch, meaningful rework, or a requested retrospective

## Preconditions

- Design draft path (convention `design/NN-<topic>.md`, lowest unused `NN`; see `design/00-design-file-guide.md`). **If no draft exists, stop and ask the caller** who should write it — do not invent a draft inside this flow, and do not call `flow-grill-review` on a missing file.
- Design number `NN` (from filename or caller)
- User/project authorization for commits. Never infer authorization from this flow.

## Workflow

### 1. Land the design

Confirm the draft exists, then use `flow-grill-review` until `Status: landed`. The design must state the user goal, explicit non-goals, observed-data boundary, minimum real-data-first vertical slice, operational/failure/atomicity boundary, and outcome-proving verification.

Do not implement before landing. Stop if the draft is missing, required evidence is unavailable, or scope needs user choice.

### 2. Implement the landed slice

Implement only the smallest end-to-end happy path and accepted current-scope requirements. Reuse existing architecture; add source-specific seams only where the source contract differs. Do not add speculative future compatibility, migration machinery, or scale engineering without evidence.

Keep architect, implementer, and independent reviewer pairwise distinct where those roles are used: architect owns design/defense, implementer owns code and implementation remediation, reviewer stays read-only. Dispatch one stage at a time; roadmap context does not authorize later work.

### Round budget (hard)

A **round** is one implementer dispatch → report → first-party grade cycle on the same landing. Count them aloud in every bounce message ("round N") and record the final count in the design file's Review log.

- **Rounds 1–2:** normal turbulence; remediate.
- **Rounds 3–4:** audit COMMUNICATION before touching code again — vague brief, non-deterministic fixture, dropped enumeration, mis-specified gate, or wrong acceptance evidence are the prime suspects. Rewrite the brief much more than the code.
- **Round 5 budget ceiling.** A round >5 is by definition a broken loop — not bad luck: the design is wrong, the brief is wrong, or the role is wrong. HALT, name the structural cause, and return to design review (or the user). Never start round 6 as if it were just another bounce.

### 3. Verify the user outcome

Run verification proportional to risk, starting with the landed criteria and representative real data, then relevant regression coverage. A check counts only if it proves part of the user outcome or a necessary boundary; passing incidental tests is not closure.

- **Pass:** criteria prove the outcome and no blocking mismatch remains → stop.
- **Implementation defect:** remediate within the landed design, then rerun affected verification.
- **Design mismatch or meaningful rework:** stop implementation, use `flow-retro`, revise the design, and return to `flow-grill-review` when architecture changed materially. Resume only after the design is landed again.

A concise `Design holds` note is optional evidence, never a required stage or no-op artifact. Refined reimplementation is not automatic.

### Commits

Commits follow explicit user authorization and meaningful artifact boundaries—not a fixed count or message template. A landed design and its implementation may be separate commits when useful; retro changes merit a commit only when they materially change an artifact. Never create no-op commits.

**Stop condition:** end when the landed current-scope outcome is demonstrated by fresh evidence, accepted blockers are resolved, and no authorized work remains. Do not continue into optional hardening, future compatibility, ritual retro, or reimplementation.

## Out of scope

- Rewriting grill/review/defend or retro section formats (owned by the composed skills)
- Project-specific product logic beyond following the design doc
- Creating the initial design draft

## Done checklist

- [ ] **P0 project-contract cleared (always first when the project has legislated one):** nothing the project law bans — template classes for zero-compat postures: second-world assumptions, dual-world support (temporary included), epoch vocabulary, history-predicated shape selection, structurally compat arms reachable only from past-era data; covers code/comments/fixtures/tests/docs
- [ ] Design landed before implementation
- [ ] Round budget respected (count stated per bounce; >5 halted as structural, not retried)
- [ ] Smallest real-data-first vertical slice implemented without scope expansion
- [ ] Fresh criteria prove the user outcome and required boundaries
- [ ] Retro/redesign run only if triggered by execution evidence
- [ ] Commits, if any, were authorized and match meaningful artifacts
