# 10 - Eval corpus triage

## User inputs

Bob reported that the first real L1 run (design 09's follow-on eval) scored 64/126
on deepseek-flash over 3 repeats and 19/42 on deepseek-v4-pro. He proposed
calibrating the corpus to a 90% pass rate. The owner corrected the aim:

> if that's the correct semantics, corpus is to serve test the tool's desired semantics, right?

Earlier, the owner asked for the older eval cases to be fixed and for their
citations to be checked mechanically, so they cannot drift again.

## Problem statement

The L1 corpus in `flow-skills-eval/src/eval/cases.ts` is the spec of what the
skills should make a model decide. It has never been run against a real model,
because vieval skipped the project (fixed separately in PR #17). Now that it runs,
62 of 126 answers miss, and a miss can mean three different things:
- the skills do not lead a model to the intended decision (a real finding);
- the question or a schema field can be read two ways, so the expected answer is
  one valid reading out of several. The `submit_decision` tool gives its four fields
  no meaning beyond their enum words. `status_to_set: unchanged` and
  `pending-retro` both mean "the status stays `pending-retro`". `write_target` does
  not say whether it names the file the status line is in, or the file the
  decision's content goes to;
- the expected answer predates the merged skills. Each case cites a `SKILL.md`
  line, but nothing checks that the cited text still exists.

Until each miss is sorted into one of these, a red case is not evidence against a
skill. A green run would not be evidence for one either, because changing expected
answers until the run is green would turn the corpus into a record of what the
model already does. Designs 08 and 09 cannot land on this corpus yet.

## Scope - what we touch

- **The triage rule**, stated in `flow-skills-eval/design/ref-eval-design-guide.md`
  as a new section, *Triaging a red case*. Every case that misses gets exactly one
  disposition:
  1. **skill finding:** the expected answer follows from the cited skill text, read
     the only way the fixture allows, and the model answers otherwise. The case
     stays as it is and stays red. The fix goes to the skill, through the normal
     route (design → module docs → code), and the case re-runs afterwards;
  2. **ambiguous instrument:** the question or a field admits another reading under
     which the model's answer is also correct. The fix makes the instrument say one
     thing (a field definition, or a question that names which act it asks about).
     The meaning of the expected answer stays the same;
  3. **stale expectation:** the expected answer contradicts the skills as merged.
     The case is rewritten to the merged skill, and its citation points to the
     sentence that now decides it.
  Agreement between models is a signal, not a verdict. When two models give the
  same wrong answer, check the reading first (2) before calling it a skill finding
  (1). Whatever the disposition, the case's expected answer never changes just
  because a model said something else.
- **Field definitions** in `flow-skills-eval/src/eval/agent.ts`: each
  `submit_decision` field and enum value gets a `description` that defines the
  value as an act, without saying which situation calls for it:
  - `status_to_set`: the status word this decision writes. `unchanged` means the
    decision writes no status line. Naming the design's current status word means
    the same thing;
  - `write_target`: the one file the decision's *content* goes to (the reasoning,
    the record or the new text), not the file whose status line changes;
  - `next_action` and `opens_new_design`: one line each, in the same style.
  Situation-specific guidance stays in the skills. A definition that names a case
  shape ("when a retro finds…") is a leak of the answer.
- **Parse rule** in `flow-skills-eval/src/eval/decisions.ts`: an answer whose
  `status_to_set` equals the fixture's current status (its `## Status` word, which
  `fixtureProblems` already parses) is graded as `unchanged`, as the definition
  above says.
- **The cases** in `flow-skills-eval/src/eval/cases.ts`: every case that misses in
  the baseline run is dispositioned in the worklog. Where the disposition is 2 or 3,
  the case is edited as that disposition says. A retro case asks "what verdict does
  the retro reach?", which names the act and leaves "run the retro" with no reading.
- **Citation check**, an L0 test in `flow-skills-eval/tests/`: every `// Cite:`
  comment names a skill file that exists. Each quoted fragment (split on `…`) occurs
  in that file after whitespace normalization. Line numbers are not checked, because
  they move on every edit.
- **Lock:** the tool schema joins the frozen prefix that
  `frozen-prefix.lock.json` hashes, since a definition edit changes what the model
  is told. The lock is re-approved.

Non-goals:
- A pass-rate target. The gate is that every miss has a disposition.
- Editing a skill in this design. A disposition-1 finding becomes its own design
  or a small task under design 08's routes. This design only records it.
- Changing the Decision schema's fields or enums. If triage shows that a field
  cannot carry a decision, that is a finding, and its fix is a follow-up.
- L2 sandbox runs.

## Rationale

A corpus checks the skills only if its expected answers are fixed independently of
any model. So the expected meaning of a case is the one thing triage may not move.

The instrument, though, is part of the measurement. An undefined field turns a
correct decision into a coin flip between two spellings. Defining the vocabulary
fixes the instrument without touching what is measured. Keeping definitions free
of situations is what stops this from turning into teaching to the test.

Citations are where staleness hides. A quoted fragment that no longer occurs in
the skill is the cheapest mechanical signal that a case was written against older
text. Line numbers fail on every unrelated edit, so the check ignores them.

Two models are used because one model's systematic misreading looks exactly like
a skill defect. Two models from different sizes agreeing on a reading is a reason
to suspect the question. It is still not proof, so disposition 2 needs its second
reading written out.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| The guide states the triage rule | `ref-eval-design-guide.md` lacks the three dispositions or the "expected answer never changes because a model said otherwise" rule | new L0 assertion, `vp test` |
| Fields are defined without situations | a `submit_decision` field or enum value has no description, or a description names a skill stage or case shape (`retro`, `review`, `sweep`, `grill`) | new L0 assertion on the exported tool schema, `vp test` |
| Same-word status is graded as no write | an answer of `status_to_set` equal to the fixture status is scored as a miss against `unchanged` | unit test in `tests/decisions.test.ts` |
| Citations resolve | a `// Cite:` names a missing file, or a quoted fragment does not occur in it | new L0 citation test, `vp test` |
| Every baseline miss is dispositioned | a case that missed in the recorded baseline has no row in the worklog's disposition table | review of `worklog/10-eval-corpus-triage.md` against the recorded baseline run |
| No expected answer moved for a model | a case with disposition 1 or 2 has a changed `expected` tuple in the diff | review of the `cases.ts` diff against the disposition table |
| The lock covers the tool schema | editing a field description leaves the lock green | `prek run --all-files` (flow-skills-eval frozen prefix lock) |
| Re-run | after the edits, the run on both models is recorded, with each remaining miss tied to a disposition-1 row | `vp run eval:full` on deepseek-flash ×3 and deepseek-v4-pro ×1 |

Each L0 witness is first observed failing on a seeded defect.

## Open questions

- Whether the parse rule (a same-word status counts as `unchanged`) should instead
  make the case a miss, so that the definition itself is what gets tested. Bob's
  reading: the definition is the instrument, and grading both spellings the same
  removes a spelling test that no skill asks for.

## Goal

This design has no goal file. The owner's direction is quoted in User inputs.

## Review

worklog/10-eval-corpus-triage.md

## Status

draft
