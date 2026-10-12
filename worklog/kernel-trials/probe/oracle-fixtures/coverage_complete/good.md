# Modular verification language - OPEN

## Goal

Turn doc-verify's YAML from a rubric configuration into a program. Section facts, typed
judge predicates, and stratified rules must be able to state structure and content
contracts over a section tree. Every failure must be explained down to the facts that
caused it.

## User requirements - frozen root

### R1 - The YAML is the program

> And it's an engine, means the yaml is itself the program, jev-prolog is constructing the syntax and semantics only

The verification strategy is a program written in YAML. The engine supplies only its
syntax and semantics. Structure and verdict logic must not live in hard-coded
TypeScript checks or fixed clause templates.

### R2 - Micro-structure-aware classification

> it should be generic flexible machine to apply verifications to docs with micro structure awareness. say: 1. for a section that appears to be about purpose A, it's subsections should fall in categories of B, C, D

A program can classify sections, deterministically or by judgment, and can constrain
the classes of a section's children according to the parent's class.

### R3 - Content rules per class

> 2. and being a section B, it should not contain what, it should contain what

A program can state what a section of a given class must and must not contain.

### R4 - Diagnostics at the level of each finding

> 3. more fancy algorithms and designs welcome 4. it should produce comprehensive diagnostic level info when it doesn't meet standard

Each failing constraint reports:
- its bindings;
- the facts and judge answers that decided it;
- the population it ranged over;
- a repair hint.

### R5 - Modular with references

> So we need a syntax design with reference support so it's kind of modular.

Programs are modules. A module can be imported under an alias, parameterized,
extended, and referenced by qualified name. Nothing is bound by position or by joining
strings.

### R6 - Judge answers become thresholded predicates

> So are going or not the prob prolog way, or turn that into predicates immediately with a threshold say

> Ok, I take it

A judge answer becomes a three-valued fact through a threshold that can only demote.
Probabilities are not propagated through rules.

## Additions to the root

None.

## Design files

- `design/04-modular-verification-language.md` - covers R1-R6 - admin source: this goal

## Dependencies

- Design 04 replaces the rubric layer of landed design 02 and the rule-ownership clause
  of landed design 03. Those designs' pipeline, snapshot, and trust boundary stay.
- The evidence-binding fix `d0a02a9` is the base for the keyed-evidence contract.
- The owner ruled in #comp-agent-substrate (thread 8ea573f1, msg 192ca7ba): "Only spine
  change matured can we proceed to ensure doc structure with doc-verify."
  - sandbox-deploy's adoption of this engine waits on that ruling. Adoption means
    re-pinning, migrating its companions, and gating its documents.
  - The nesting-baseline row only reads a fixed commit, `c9edcf0`, and gates nothing.

## Workstreams

- **Rule language** - `design/04` - `draft` - covers R1-R6

## Workflows

### design/04-modular-verification-language.md - draft

- **Admin source:** `goals/03-modular-verification-language.md`
- **Covers:** R1-R6
- **Scope:** module syntax and resolution, section-tree facts, oracles, three-valued evaluation, diagnostics, migration of the v1 rubrics
- **Depends on:** landed design/02 and design/03
- **Loop:** `flow-grill-review` -> implementation gate -> `flow-retro`
- **Gate:** the verification table in design 04 passes, the pinned nesting baseline is reproduced, and the migrated home.conf contracts pass live

## AC coverage

| Row | Evidence required |
| --- | --- |
| R1 | A contract that previously needed a TypeScript check runs as rules in its companion YAML, and no fixed clause template remains |
| R2 | A fixture with a purpose-classified parent and a misclassified child yields exactly one violation that names both sections |
| R3 | `require` and `forbid` constraints each have a seeded document that flips them, and an `unknown` judge answer yields `undetermined`, never `satisfied` |
| R4 | A violation report contains the bindings, the proof facts with judge labels and probabilities, the printed population, and the repair hint |
| R5 | Two libraries that each define `problem` compose under different aliases, a parameterized import changes behaviour, and an attempt to weaken an inherited constraint without `waive:` is rejected |
| R6 | A judge answer below its threshold becomes `unknown` and never the opposite label, and no rule consumes a probability |

## Rulings in force

- 2026-09-29 - Thresholded three-valued predicates, no probabilistic propagation -> `design/04` §Oracles and thresholds
- 2026-09-29 - Rounds that depend on judge answers are bounded by a declared depth -> `design/04` §Evaluation
- 2026-09-29 - Rule bodies use hybrid syntax: YAML forms for common shapes, restricted terms otherwise -> `design/04` §Rule syntax
- 2026-09-29 - Migration is one-shot with no second reader for v1 rubrics -> `design/04` §Migration

## Open threads

- The v1 goal rubric's `user-requirements-frozen-root` does not match the slug of
  "User requirements - frozen root", so `goal.coverage_complete` judges `ac-coverage`
  alone. Goals 02 and 03 are `NEEDS-REVIEW` for this reason, not because of their
  content. This is out of scope for the v1 reader, which design 04 deletes. The
  migrated goal contract must select the frozen root, and design 04's printed
  populations must expose any selector that matches nothing.

## Worklog

`worklog/04-modular-verification-language.md`
