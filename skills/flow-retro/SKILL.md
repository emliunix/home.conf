---
name: flow-retro
description: >-
  Use when the user says flow:retro, requests a design retrospective, or execution
  reveals design mismatch, meaningful rework, or avoidable complexity.
---

# Flow: Retro — closes the loop

> **Process is recommendation, not ceremony.** `flow-*` is a toolbox, not rigid enforcement. Weigh each step against the frozen requirements and current architecture. Skip any step that does not change the outcome. Completing a skill checklist is not success. Do not write designs, grills, or receipts whose only job is to bless work already specified.

**One job:** Close the loop on an executed design. Run the evidence-based retrospection, record it, route every finding to a verdict (§4), and — as the non-waivable bottom line — pass the **first-principles ↔ problem statement** check proving we didn't pile up accretions to make it work. When the pass is clean, set `Status: landed`.

This skill **composes** other skills — read and follow them; do not restate their internals:

- `flow-common` — the lifecycle vocabulary (four-word status table, supersession rule, only-route-back rule)
- `verification` — evidence levels, freshness, and the shared practice library

Does not run the full impl cycle or grill a brand-new draft (use `flow-grill-review` for that).

The design's status words (`draft` → `reviewed` → `pending-retro` → `landed`) and the only-route-back rule live in `flow-common`. This flow owns the `pending-retro` → `landed` transition and is the **only route back** out of `pending-retro` (an implementation-only defect returns to implementation but the status stays `pending-retro` until this flow re-closes).

## Trigger gate

Run this flow when requested, or when execution shows at least one of:

- A design assumption or boundary was wrong
- Meaningful rework, hacks, or silent deviation were required
- Verification did not prove the user outcome
- Complexity can be removed because the real operational shape is now known

Additionally, this flow is the **closing stage of every execution**: the implementer hands over at `pending-retro`, and a closing pass runs — heavy when a trigger exists, light when not. A light pass still answers the First-principles bottom line below and lands the design with an evidenced `Design holds` note; it is not a no-op ritual.

## Workflow

### 1. Gather concrete evidence

Compare the design with built artifacts, representative source data, diffs, and test results. Identify the exact mismatch and distinguish design error from implementation defect. Check the true operational and failure/atomicity boundary, minimum end-to-end path, existing architecture reuse, and whether compatibility/scale assumptions were evidenced or speculative.

Recheck the selected `verification` practices. Reject evidence that is stale,
does not include the claimed boundary, or comes from a gate with no demonstrated
failure witness.

### 2. First-principles bottom line (mandatory, non-waivable)

Every retro — even a light one — answers this pass; a retro without it does not count:

1. **Re-derive from the stated user problem** (the design's Problem statement, re-read fresh and checked against the frozen root or User inputs with their inline context and analysis, per `flow-common`) the minimal architecture that solves it given TODAY's observed reality. Derive from that grounded problem, not from memory of what got built; an isolated quote or an agent interpretation does not replace the owner's intent.
2. **Diff that derivation against the as-built system.** Classify every divergence:
   - **(a) constraint-justified** — a spec/runtime constraint still in force demands it; name the constraint.
   - **(b) known debt** — a pragmatic shortcut taken knowingly; name the removal path and condition.
   - **(P0) project-contract violation (always classified first):** anything the project's declared P0 contract bans — zero-compat template: dual-world support (temporary included), epoch vocabulary, history-gated shape selection, era-reachable compat arms — removal is unconditional and always routes back, ahead of (a)–(c): to implementation when only the code carries it (§4 verdict 3), to breakout when the design body prescribes it (verdict 4).
   - **(c) accretion** — code, flags, compat shims, abstractions, or indirection that exist only because of HOW the work unfolded (history), not because the problem demands them. Category (c) is the pile-up: schedule each item for removal in the follow-up file (§4 verdict 2) (removal is the default; keeping one requires explicit evidence it is load-bearing). Before calling a shim load-bearing because "existing data needs it", pin the release strategy (destructive reset vs. data-preserving migration) with the owner: a ruled reset voids that premise, and the shim becomes removable history.
3. **Re-validate the heads against reality:** is the Problem statement still THE problem (or did execution reveal it was mis-stated)? Did Scope hold (no creep during implementation)? Does the Rationale survive contact with the as-built (rejected alternatives still rejected for the stated reasons)?
4. **Write the bottom line explicitly** in the retro record: either "matches the first-principles minimal architecture — no pile-up" with the derivation shown, or the (b)/(c) list with removal actions. "It works" is not a bottom line.

### 3. Record proportionally

Append a dated `## Retrospective` entry to the design’s **corresponding worklog** (`worklog/NN-<same-topic>.md`), without overwriting prior passes. Do not paste retro prose into the design body. The **First-principles bottom line** heading is mandatory; the others only as needed for clarity:

- **First-principles bottom line:** the derivation, the divergence classification, removal actions, head re-validation verdicts (mandatory even when everything passed — prove the match, don't assert it)
- **Evidence:** what happened and where
- **Design mismatch / rework:** root cause and user impact
- **Complexity removed:** what can be deleted, narrowed, or reused
- **Design revisions:** smallest edits, with supporting facts
- **Design holds:** only for relevant decisions execution actually validated

**The retro makes no direct edits.** It changes no code, no design body and no module document; every change goes through the route its verdict names (§4). Preserve explicit scope/non-goals and classify observed facts versus inference/TBD. Do not invent future compatibility, generalized abstractions, or promotion rules from one case.

### 4. Route each finding (the verdict)

**The test.** A finding *blocks* the design when it makes one of the design's own falsifiable rows fail or become unprovable: its **Covers** acceptance rows when it belongs to a goal, otherwise the rows of its **Verification design**. An assumption is inside the design only when one of those rows depends on it.

The retro ends in exactly one verdict, written in the worklog entry:

1. **Land** — no finding blocks, and nothing needs further work.
2. **Land with follow-ups** — no finding blocks; the further findings go to **one follow-up file** per retro, in the `draft-followup` shape `flow-grill-review` §3 defines (next free `design/NN-<topic>.md`, findings grouped into units, no three heads, no obligation until picked up), with a back-pointer to this worklog entry. Each unit names its kind. The kinds are an open list of examples — clean-up or refactor, process or docs optimization, re-architecture, new feature, a retro of the retro process — and a retro names whatever kind a unit needs.
3. **Route back to implementation** — a blocking finding is an implementation defect, or a P0 project-contract violation carried by the code. Do not rewrite the design to describe a bug. Status stays `pending-retro`; the cycle counts one round of `flow-common`'s round budget; this flow re-closes afterwards.
4. **Breakout** — a blocking finding is a design defect, or a P0 violation the design body itself prescribes. Hand to `flow-common` **breakout adjudication** now, not at the round ceiling: halt and name the cause in the worklog; the manager reverts the impacted designs to `draft` for re-review. If the walk proves a **wrong machine**, `flow-common` supersession applies instead — do not revert that file.

### 5. Close the loop (set `landed`)

Before landing, check the module documents the design names against what was built (`project-skeleton` § Module docs). A module document that contradicts one of the design's rows is a blocking finding (verdict 3 or 4); any other mismatch is a follow-up unit.

Land on verdict 1 or 2: the worklog entry exists with the First-principles bottom line, heads are re-validated, no finding blocks, and for verdict 2 the follow-up file exists — then set `Status: landed`. `landed` means the whole loop finished: design + implementation + retro. A later discovery that a **landed** design is the wrong machine does not un-land it: open a new `design/NN`, grill it, and when it lands mark the old file `Superseded by:` (see `design/00-design-file-guide.md`).

**Stop condition:** stop when every finding has its verdict route, the worklog entry is written, and the next gate is explicit. Do not add ritual sections, lessons, or redesign unsupported by execution evidence.

## Out of scope

- `flow-grill-review` orchestration and commit messages
- Parallel attack-angle review of a fresh draft (`flow-grill-review`)
- The lifecycle vocabulary and implementation-gate machinery (hosted by `flow-common`)
- Mandatory promotion into AGENTS/`rules/` (recommend only unless asked)

## Done checklist

- [ ] Trigger is explicit (closing pass or evidence); evidence distinguishes design from implementation defects
- [ ] **First-principles bottom line passed and written out: derivation from the Problem statement, divergence classification (a/b/c), accretion removals scheduled, heads re-validated**
- [ ] Record is proportional and names concrete mismatch/rework
- [ ] Every finding routed by the row test; one verdict recorded (land / land with follow-ups / route back / breakout); no direct edits made
- [ ] Follow-up file (verdict 2) in the `draft-followup` shape, pointing back to the worklog entry
- [ ] Architecture failures run `flow-common` breakout adjudication (or supersession if wrong machine); retro ledger is the worklog
- [ ] Module documents match the as-built (`project-skeleton` § Module docs)
- [ ] `Status: landed` set on a clean closing pass; statuses preserved on routing back
- [ ] Stop condition and next gate are explicit
