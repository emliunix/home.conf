---
name: flow-retro
description: >-
  Use when the user says flow:retro, requests a design retrospective, or execution
  reveals design mismatch, meaningful rework, or avoidable complexity.
---

# Flow: Retro — closes the loop

> **Process is recommendation, not ceremony.** `flow-*` is a toolbox, not rigid enforcement. Weigh each step against the frozen requirements and current architecture. Skip any step that does not change the outcome. Completing a skill checklist is not success. Do not write designs, grills, or receipts whose only job is to bless work already specified.

**One job:** Close the loop on an executed design. Run the evidence-based retrospection, make the smallest evidence-backed corrections, and — as the non-waivable bottom line — pass the **first-principles ↔ problem statement** check proving we didn't pile up accretions to make it work. When the pass is clean, set `Status: landed`.

This skill **composes** other skills — read and follow them; do not restate their internals:

- `flow-common` — the lifecycle vocabulary (four-word status table, supersession rule, only-route-back rule)

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

### 2. First-principles bottom line (mandatory, non-waivable)

Every retro — even a light one — answers this pass; a retro without it does not count:

1. **Re-derive from the Problem statement alone** (the design's head, re-read fresh, not from memory of what got built) the minimal architecture that solves it given TODAY's observed reality.
2. **Diff that derivation against the as-built system.** Classify every divergence:
   - **(a) constraint-justified** — a spec/runtime constraint still in force demands it; name the constraint.
   - **(b) known debt** — a pragmatic shortcut taken knowingly; name the removal path and condition.
   - **(P0) project-law violation (always classified first):** anything the project's declared P0 contract bans — zero-compat template: dual-world support (temporary included), epoch vocabulary, history-gated shape selection, era-reachable compat arms — removal is unconditional and rides this retro, ahead of (a)–(c).
   - **(c) accretion** — code, flags, compat shims, abstractions, or indirection that exist only because of HOW the work unfolded (history), not because the problem demands them. Category (c) is the pile-up: schedule each item for removal **in this retro record** (removal is the default; keeping one requires explicit evidence it is load-bearing).
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

Bounded corrections rewrite the design body as current speech. A genuine architecture failure opens a **new** design file instead (see §4). Preserve explicit scope/non-goals and classify observed facts versus inference/TBD. Do not invent future compatibility, generalized abstractions, or promotion rules from one case.

### 4. Route by severity

- **No architecture failure:** make bounded corrections (or none for a light pass), record `Design holds`, and return to implementation/verification for the corrections — status stays `pending-retro` until the corrected execution is verified and this flow re-closes.
- **Genuine architecture failure:** stop. Hand to `flow-common` **breakout adjudication** (when/how there): propagate up the funnel, validate against the frozen root (root unchanged), status-revert impacted designs to fold the architecture in. If that walk proves a **wrong machine**, `flow-common` supersession applies instead — do not revert that file. Retro narrative stays in the worklog.
- **Implementation-only defect:** do not rewrite the design to describe a bug; return it to implementation remediation (status stays `pending-retro`).

### 5. Close the loop (set `landed`)

Land when the closing pass is complete: no blocking mismatch remains, the First-principles bottom line is written in the worklog, heads are re-validated, and all necessary corrections (or removals) are applied — then set `Status: landed`. `landed` means the whole loop finished: design + implementation + retro. A later discovery that a **landed** design is the wrong machine does not un-land it: open a new `design/NN`, grill it, and when it lands mark the old file `Superseded by:` (see `design/00-design-file-guide.md`).

**Stop condition:** stop when the concrete mismatch is explained, necessary design edits and complexity removals are applied, and the next gate is explicit. Do not add ritual sections, lessons, or redesign unsupported by execution evidence.

## Out of scope

- `flow-grill-review` orchestration and commit messages
- Parallel attack-angle review of a fresh draft (`flow-grill-review`)
- The lifecycle vocabulary and implementation-gate machinery (hosted by `flow-common`)
- Mandatory promotion into AGENTS/`rules/` (recommend only unless asked)

## Done checklist

- [ ] Trigger is explicit (closing pass or evidence); evidence distinguishes design from implementation defects
- [ ] **First-principles bottom line passed and written out: derivation from the Problem statement, divergence classification (a/b/c), accretion removals scheduled, heads re-validated**
- [ ] Record is proportional and names concrete mismatch/rework
- [ ] Smallest design correction and complexity removals applied
- [ ] Architecture failures run `flow-common` breakout adjudication (or supersession if wrong machine); retro ledger is the worklog
- [ ] `Status: landed` set on a clean closing pass; statuses preserved on routing back
- [ ] Stop condition and next gate are explicit
