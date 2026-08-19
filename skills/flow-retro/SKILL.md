---
name: flow-retro
description: >-
  Use when the user says flow:retro, requests a design retrospective, or execution
  reveals design mismatch, meaningful rework, or avoidable complexity.
---

# Flow: Retro

**One job:** When triggered, run a **full design retrospection**: compare execution evidence with the design, make the smallest evidence-backed corrections, and — as the non-waivable bottom line — pass the **first-principles ↔ problem statement** check proving we didn't pile up accretions to make it work.

Does not run the full impl cycle or grill a brand-new draft (use `flow-grill-review` for that).

## Trigger gate

Run this flow when requested, or when execution shows at least one of:

- A design assumption or boundary was wrong
- Meaningful rework, hacks, or silent deviation were required
- Verification did not prove the user outcome
- Complexity can be removed because the real operational shape is now known

Do not require a retro after every execution. If no trigger exists, a concise `Design holds` note with fresh evidence is sufficient—or no retro artifact at all. Process cost must stay below task complexity.

## Workflow

### 1. Gather concrete evidence

Compare the design with built artifacts, representative source data, diffs, and test results. Identify the exact mismatch and distinguish design error from implementation defect. Check the true operational and failure/atomicity boundary, minimum end-to-end path, existing architecture reuse, and whether compatibility/scale assumptions were evidenced or speculative.

### 2. First-principles bottom line (mandatory, non-waivable)

Every retro — even a small one — answers this pass; a retro without it does not count:

1. **Re-derive from the Problem statement alone** (the design's head, re-read fresh, not from memory of what got built) the minimal architecture that solves it given TODAY's observed reality.
2. **Diff that derivation against the as-built system.** Classify every divergence:
   - **(a) constraint-justified** — a spec/runtime constraint still in force demands it; name the constraint.
   - **(b) known debt** — a pragmatic shortcut taken knowingly; name the removal path and condition.
   - **(P0) project-law violation (always classified first):** anything the project's declared P0 contract bans — zero-compat template: dual-world support (temporary included), epoch vocabulary, history-gated shape selection, era-reachable compat arms — removal is unconditional and rides this retro, ahead of (a)–(c).
   - **(c) accretion** — code, flags, compat shims, abstractions, or indirection that exist only because of HOW the work unfolded (history), not because the problem demands them. Category (c) is the pile-up: schedule each item for removal **in this retro record** (removal is the default; keeping one requires explicit evidence it is load-bearing).
3. **Re-validate the heads against reality:** is the Problem statement still THE problem (or did execution reveal it was mis-stated)? Did Scope hold (no creep during implementation)? Does the Rationale survive contact with the as-built (rejected alternatives still rejected for the stated reasons)?
4. **Write the bottom line explicitly** in the retro record: either "matches the first-principles minimal architecture — no pile-up" with the derivation shown, or the (b)/(c) list with removal actions. "It works" is not a bottom line.

### 3. Record proportionally

Append a dated `## Retrospective` entry without overwriting prior passes. The **First-principles bottom line** heading is mandatory; the others only as needed for clarity:

- **First-principles bottom line:** the derivation, the divergence classification, removal actions, head re-validation verdicts (mandatory even when everything passed — prove the match, don't assert it)
- **Evidence:** what happened and where
- **Design mismatch / rework:** root cause and user impact
- **Complexity removed:** what can be deleted, narrowed, or reused
- **Design revisions:** smallest edits, with supporting facts
- **Design holds:** only for relevant decisions execution actually validated

Apply accepted revisions to the design body. Preserve explicit scope/non-goals and classify observed facts versus inference/TBD. Do not invent future compatibility, generalized abstractions, or promotion rules from one case.

### 4. Route by severity

- **No architecture failure:** make bounded corrections and return to implementation/verification.
- **Genuine architecture failure:** stop; set the design back to draft (or equivalent), state the invalid assumptions, and send it through `flow-grill-review` before more implementation.
- **Implementation-only defect:** do not rewrite the design to describe a bug; return it to implementation remediation.

**Stop condition:** stop when the concrete mismatch is explained, necessary design edits and complexity removals are applied, and the next gate is explicit. Do not add ritual sections, lessons, or redesign unsupported by execution evidence.

## Out of scope

- `flow-impl` orchestration and commit messages
- Parallel attack-angle review of a fresh draft (`flow-grill-review`)
- Mandatory promotion into AGENTS/`rules/` (recommend only unless asked)

## Done checklist

- [ ] Trigger is explicit; evidence distinguishes design from implementation defects
- [ ] **First-principles bottom line passed and written out: derivation from the Problem statement, divergence classification (a/b/c), accretion removals scheduled, heads re-validated**
- [ ] Record is proportional and names concrete mismatch/rework
- [ ] Smallest design correction and complexity removals applied
- [ ] Architecture failures routed back to `flow-grill-review`
- [ ] Stop condition and next gate are explicit
