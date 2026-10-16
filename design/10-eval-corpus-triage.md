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
because vieval skipped the project (fixed in PR #17, `e47dabc`). Now that it runs,
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
  2. **ambiguous instrument:** the question, a field or the fixture admits another
     reading under which the model's answer is also correct (a fixture may leave out
     a fact the decision needs, such as the round count). The second reading is
     written out. The fix makes the instrument say one thing: a field definition, a
     question that names the scored act, or the missing fact. The expected tuple
     stays the same;
  3. **stale expectation:** the expected tuple contradicts the skills as merged.
     This is the one disposition that changes a tuple, so its row carries the
     before and after tuple, the quoted deciding sentence of the merged skill
     (which passes the citation check), a derivation of the new tuple from that
     sentence alone, and a second seat's confirmation.
  A disposition is per case. A case that misses only sometimes after the edits
  (below k/k over the repeats) needs its own disposition; flakiness alone is not a
  skill finding. Agreement between models is a signal, not a verdict: when two
  models give the same wrong answer, check the reading (2) before calling it a
  skill finding (1). Both models available here are deepseek, so a disposition-1
  row records whether a model from another family confirmed it. Whatever the
  disposition, an expected tuple never changes because a model said something
  else.
- **Field definitions** in `flow-skills-eval/src/eval/agent.ts`: each
  `submit_decision` field and enum value gets a `description` that defines the
  value as an act, without saying which situation calls for it. The definitions are
  derived from the expected tuples already in `cases.ts`, not from a reading of the
  words, so that defining them moves no tuple:
  - `status_to_set`: the status word this decision writes; `unchanged` means it
    writes no status line;
  - `write_target`: the file this decision writes. That is the file holding the
    status line when the decision sets one; otherwise the document its content goes
    to; `none` when the change goes only to code, or nowhere;
  - `next_action` and `opens_new_design`: one line each, in the same style.
  Every distinct expected tuple in the corpus is consistent with these definitions.
  The canonical list, one tuple per row, lives in `flow-skills-eval/tests/definitions.test.ts`
  (`CONSISTENT_TUPLES`); this table summarizes it:

  | Tuple | Consistent because |
  | --- | --- |
  | `set_status, reviewed/pending-retro/landed, design_body` | the status line is in the design |
  | `set_status, draft-followup, followup_design_file` | the status line is in the new follow-up file |
  | `run_retro` or `halt_structural`, `unchanged, worklog` | the record goes to the worklog |
  | `remediate` or `implement`, `unchanged, none` | the change is code only |
  | `remediate, unchanged, design_body` | the fix is in the design |
  | `remediate, unchanged, worklog` | the correction is recorded in the worklog (`budget-paraphrase`, a disposition-3 candidate) |
  | `open_new_design, unchanged, new_design_file` | the content goes to the new design |
  | `reject_finding, unchanged, worklog` | the defense is recorded in the worklog |

  Situation-specific guidance stays in the skills. A definition that uses a
  conditional (`when`, `if`, `after`, `once`), or a stage or case-shape word other
  than its own value's name, leaks the answer.
- **Parse rule** in `flow-skills-eval/src/eval/decisions.ts`: an answer whose
  `status_to_set` equals the fixture's current status is graded as `unchanged`.
  The skills never specify that spelling, so grading it would measure nothing the
  corpus is for. The rule lives only in the grader, not in the tool description.
  The current status is the fixture's `## Status` word, and `fixtureProblems` now
  requires exactly one such line, so the rule cannot compare against the wrong
  file. `status_to_set` has no `draft` value, so the rule acts only on `reviewed`,
  `pending-retro` and `landed` fixtures.
- **The cases** in `flow-skills-eval/src/eval/cases.ts`: every case that misses in
  the baseline run is dispositioned in the worklog. Where the disposition is 2 or 3,
  the case is edited as that disposition says. A case whose situation holds two
  acts names the act its tuple scores. For example, a `fork-retro-followup-*`
  question asks "what file does the retro create for these findings, and with what
  status?", and the landing act stays with `gate-pending-landed-*`.
- **Citation check**, an L0 test in `flow-skills-eval/tests/`: every `// Cite:`
  comment names a skill file that exists and carries at least one quoted fragment.
  Each fragment (split on `…`) occurs in that file after normalizing whitespace and
  stripping Markdown emphasis (`**`, `*`, backticks). Line numbers are not checked,
  because they move on every edit.
- **Run provenance** (from PR #17's review): a run's output records the model and
  the names of the `FLOW_SKILLS_EVAL_EXTRA_BODY` keys, so a baseline score can be
  traced to its configuration. A stubbed-fetch unit test pins that the harness's
  own request fields win over extra fields.
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
| Fields are defined without situations | a `submit_decision` field or enum value has no description, or a description has a conditional (`when`, `if`, `after`, `once`) or a stage word other than its own value's name | new L0 assertion on the exported tool schema, `vp test` |
| Definitions move no tuple | a distinct expected tuple in `cases.ts` has no row in `CONSISTENT_TUPLES` | new L0 assertion listing the distinct tuples against the table, `vp test` |
| Same-word status is graded as no write | an answer of `status_to_set` equal to the fixture status is scored as a miss against `unchanged` | unit test in `tests/decisions.test.ts` |
| Citations resolve | a `// Cite:` names a missing file, has no quoted fragment, or a fragment does not occur in it | new L0 citation test, `vp test` |
| Every baseline miss is dispositioned | a case that missed in either committed raw baseline run has no row in the worklog's disposition table | review of `worklog/10-eval-corpus-triage.md` against `worklog/10-eval-corpus-triage/baseline-*.tsv` |
| No expected answer moved for a model | a case with disposition 1 or 2 has a changed `expected` tuple in the diff | review of the `cases.ts` diff against the disposition table |
| Disposition 3 is derived, not re-targeted | a disposition-3 row lacks the before and after tuple, the quoted deciding sentence, the derivation, or a second seat's confirmation | review of the disposition table by the reviewer seat |
| The lock covers the tool schema | editing a field description leaves the lock green | `prek run --all-files` (flow-skills-eval frozen prefix lock) |
| Runs are traceable | a run's output omits the model or the extra-body key names, or an extra field overrides `model`, `temperature` or `tool_choice` | unit tests with a stubbed `fetch`, `vp test` |
| Re-run | after the edits, the run on both models is recorded, and each case below k/k is tied to a disposition-1 row or to its own disposition | `vp run eval:full` on deepseek-flash ×3 and deepseek-v4-pro ×1 |

Each L0 witness is first observed failing on a seeded defect.

## Open questions

- None. The parse-rule question was settled at review round 1: keep the rule, in
  the grader only.

## Goal

This design has no goal file. The owner's direction is quoted in User inputs.

## Review

worklog/10-eval-corpus-triage.md

## Status

pending-retro
