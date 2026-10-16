# Worklog - eval corpus triage

## C1 - Draft (2026-10-16)

Bob drafted design 10 after the first real L1 run. The owner ruled that the corpus
is the spec of the skills' desired semantics, so a red case is triaged, never
re-targeted to a model's answer. Evidence on `main` at `0fa68e4` plus PR #17:

- `flow-skills-eval/src/eval/agent.ts`: `submit_decision` declares four enum
  fields with no `description`, so `unchanged` vs the current status word, and
  which file `write_target` names, are undefined.
- Baseline (full profile): deepseek-flash 64/126 over 3 repeats; deepseek-v4-pro
  19/42 over 1. Misses are mostly deterministic per case (0/3 or 3/3).
- Miss classes seen: same-meaning status spellings (`pending-retro` for
  `unchanged`); `write_target` read as the record file rather than the status
  file; retro cases answered with the act "run the retro" instead of a verdict;
  old sweep cases; scattered single cases.
- The per-case baseline table is recorded below, at C2, as the input to triage.

## C2 - Baseline (2026-10-16)

Run on `0fa68e4` + PR #17 (`ede3368`), full profile, `thinking` disabled. Totals:
deepseek-flash 58/126 (×3; the earlier run scored 64/126, so a few cases are not
deterministic), deepseek-v4-pro 20/42 (×1). Tuples are
`next_action,status_to_set,write_target,opens_new_design`; *got* is the first miss.

| Case | flash | pro | Expected | flash got | pro got |
| --- | --- | --- | --- | --- | --- |
| `gate-draft-reviewed-canonical` | 3/3 | 0/1 | `set_status,reviewed,design_body,false` |  | `set_status,reviewed,none,false` |
| `gate-reviewed-pending-canonical` | 3/3 | 0/1 | `set_status,pending-retro,design_body,false` |  | `set_status,pending-retro,none,false` |
| `gate-reviewed-pending-trap` | 0/3 | 0/1 | `implement,unchanged,none,false` | `implement,unchanged,worklog,false` | `remediate,unchanged,none,false` |
| `gate-pending-landed-canonical` | 0/3 | 0/1 | `set_status,landed,design_body,false` | `set_status,landed,none,false` | `set_status,landed,none,false` |
| `gate-pending-landed-paraphrase` | 3/3 | 0/1 | `set_status,landed,design_body,false` |  | `set_status,landed,none,false` |
| `fork-impl-defect-canonical` | 0/3 | 1/1 | `remediate,unchanged,none,false` | `remediate,pending-retro,worklog,false` |  |
| `fork-impl-defect-trap` | 0/3 | 1/1 | `remediate,unchanged,none,false` | `remediate,pending-retro,worklog,false` |  |
| `fork-impl-defect-paraphrase` | 0/3 | 1/1 | `remediate,unchanged,none,false` | `remediate,pending-retro,worklog,false` |  |
| `fork-retro-followup-canonical` | 0/3 | 0/1 | `set_status,draft-followup,followup_design_file,false` | `run_retro,landed,worklog,false` | `run_retro,landed,worklog,false` |
| `fork-retro-followup-trap` | 0/3 | 0/1 | `set_status,draft-followup,followup_design_file,false` | `run_retro,landed,worklog,false` | `run_retro,landed,followup_design_file,false` |
| `fork-retro-followup-paraphrase` | 0/3 | 0/1 | `set_status,draft-followup,followup_design_file,false` | `run_retro,landed,followup_design_file,true` | `run_retro,landed,worklog,false` |
| `fork-retro-design-defect-canonical` | 0/3 | 0/1 | `halt_structural,unchanged,worklog,false` | `open_new_design,unchanged,worklog,true` | `run_retro,unchanged,worklog,false` |
| `fork-retro-design-defect-trap` | 3/3 | 0/1 | `halt_structural,unchanged,worklog,false` |  | `run_retro,unchanged,worklog,false` |
| `fork-retro-design-defect-paraphrase` | 0/3 | 0/1 | `halt_structural,unchanged,worklog,false` | `run_retro,unchanged,worklog,false` | `run_retro,unchanged,worklog,false` |
| `fork-retro-p0-canonical` | 0/3 | 1/1 | `remediate,unchanged,none,false` | `remediate,pending-retro,worklog,false` |  |
| `fork-retro-p0-trap` | 0/3 | 0/1 | `remediate,unchanged,none,false` | `remediate,pending-retro,worklog,false` | `remediate,unchanged,worklog,false` |
| `fork-retro-p0-paraphrase` | 0/3 | 0/1 | `remediate,unchanged,none,false` | `remediate,pending-retro,worklog,false` | `remediate,pending-retro,none,false` |
| `fork-retro-p0-design-canonical` | 0/3 | 0/1 | `halt_structural,unchanged,worklog,false` | `open_new_design,unchanged,worklog,true` | `run_retro,unchanged,worklog,false` |
| `fork-retro-p0-design-trap` | 0/3 | 0/1 | `halt_structural,unchanged,worklog,false` | `open_new_design,unchanged,worklog,true` | `run_retro,unchanged,worklog,false` |
| `fork-retro-p0-design-paraphrase` | 3/3 | 0/1 | `halt_structural,unchanged,worklog,false` |  | `run_retro,unchanged,worklog,false` |
| `fork-p0-violation-canonical` | 3/3 | 0/1 | `remediate,unchanged,design_body,false` |  | `reject_finding,unchanged,none,false` |
| `fork-p0-violation-trap` | 0/3 | 0/1 | `remediate,unchanged,design_body,false` | `reject_finding,unchanged,worklog,false` | `reject_finding,unchanged,worklog,false` |
| `fork-p0-violation-paraphrase` | 1/3 | 0/1 | `remediate,unchanged,design_body,false` | `reject_finding,unchanged,worklog,false` | `reject_finding,unchanged,design_body,false` |
| `sweep-destination-canonical` | 0/3 | 1/1 | `set_status,draft-followup,followup_design_file,false` | `set_status,reviewed,followup_design_file,true` |  |
| `sweep-destination-trap` | 0/3 | 0/1 | `set_status,draft-followup,followup_design_file,false` | `set_status,reviewed,followup_design_file,true` | `reject_finding,unchanged,followup_design_file,false` |
| `sweep-destination-paraphrase` | 0/3 | 1/1 | `set_status,draft-followup,followup_design_file,false` | `set_status,reviewed,followup_design_file,true` |  |
| `budget-paraphrase` | 0/3 | 0/1 | `remediate,unchanged,worklog,false` | `halt_structural,unchanged,worklog,false` | `halt_structural,unchanged,worklog,false` |
| `write-target-retro-canonical` | 0/3 | 0/1 | `run_retro,unchanged,worklog,false` | `run_retro,landed,worklog,false` | `run_retro,landed,worklog,false` |
| `write-target-retro-trap` | 0/3 | 1/1 | `run_retro,unchanged,worklog,false` | `reject_finding,unchanged,worklog,false` |  |

Cases at 3/3 and 1/1 are omitted. Every row above gets a disposition at C3.

The raw per-case output of both runs is committed in
`worklog/10-eval-corpus-triage/baseline-flash-x3.tsv` and `baseline-v4pro-x1.tsv`.
The earlier 64/126 flash run was not saved; only its total is known.

## C3 - Design review round 1 (2026-10-16)

The Claude seat reviewed `800c8ab`: 1 blocking, 4 should-fix, 4 notes
(https://github.com/emliunix/home.conf/pull/18).

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | blocking: the `write_target` definition ("not the file whose status line changes") contradicts the six `set_status … design_body` tuples, so adopting it re-targets them | Taken: definitions derived from the existing tuples; consistency table over every distinct tuple (12, including `remediate, unchanged, worklog`) plus an L0 row |
| 2 | should-fix: "what verdict does the retro reach?" invites the landing act | Taken: a two-act situation names the scored act; landing stays with `gate-pending-landed-*` |
| 3 | should-fix: disposition 3 moves a tuple unguarded | Taken: before/after tuple, quoted deciding sentence, derivation from it, second-seat confirmation; verification row |
| 4 | should-fix: fixture gaps and intermittent cases | Taken: disposition 2 covers the fixture; dispositions are per case, below k/k needs its own |
| 5 | should-fix: the leak word list conflicts with enum names | Taken: check conditionals and stage words other than the value's own name |
| 6 | note: keep the parse rule in the grader only; exactly one `## Status`; no `draft` value | Taken; open question closed |
| 7 | note: citations without a fragment pass vacuously; strip emphasis | Taken |
| 8 | note: both models are deepseek | Taken: a disposition-1 row records whether another family confirmed it (no other-family key on this machine) |
| 9 | note: keep the raw baseline | Taken: both runs committed under `worklog/10-eval-corpus-triage/` |

## C4 - Design review round 2 (2026-10-16)

The Claude seat re-reviewed `20495e9`: **design passes**, nothing blocking. It
recomputed the 12 distinct tuples on `main` and found each consistent with the
definitions. One implementation note: don't parse the grouped prose table. Taken:
the canonical list is `CONSISTENT_TUPLES` in `tests/definitions.test.ts`, one tuple
per row, and the design's table points at it. Status → `reviewed`.

## C5 - Implementation (2026-10-16)

- `decisions.ts`: `SUBMIT_DECISION_TOOL` moved here with `FIELD_DEFINITIONS` and
  `VALUE_DEFINITIONS`; `normalizeDecision` grades the current status word as
  `unchanged`. `cases.ts`: `fixtureStatus`, and exactly one `## Status`.
- `agent.ts`: `buildRequestBody` (extra fields first, harness fields win) and
  `runProvenance` (model + extra-body key names, no values); the eval records both.
- `prompt.ts` / lock: `toolSchemaHash` joins the lock; re-approved.
- `ref-eval-design-guide.md`: new section *Triaging a red case*.
- Citations: the new check found 4 stale quotes (`gate-reviewed-pending-canonical`,
  `budget-canonical` "return to design review" now "run breakout adjudication",
  `write-target-retro-canonical`, `defense-reject-canonical` "Reject:" now
  "Reject / WON'T DO:") and 23 citations with no quote. All 27 re-anchored to the
  merged text. No tuple moved.
- `vp test --run` 66/66, `tsc` clean. Each new L0 witness was first seen failing on
  a seeded defect: guide rule removed; a definition given "when the review passes";
  a `CONSISTENT_TUPLES` row dropped; the grading rule disabled; a quoted fragment
  altered; a definition edited without the lock; extra fields spread after the
  harness fields (2 tests fail); the one-`## Status` check disabled.

## C6 - Triage (2026-10-16)

Raw runs in `worklog/10-eval-corpus-triage/`: `baseline-*` (C2), `defs-only-*`
(definitions and grading rule, no case edited), `final-*` (after the question and
fixture edits). Totals:

| Run | deepseek-flash | deepseek-v4-pro |
| --- | --- | --- |
| baseline | 58/126 (×3) | 20/42 (×1) |
| definitions only | 87/126 (×3) | 29/42 (×1) |
| final | 102/126 (×3) | 96/126 (×3) |

`git diff origin/main -- flow-skills-eval/src/eval/cases.ts` changes **no
`expected` line**: no case took disposition 3. Two intermediate runs (106/93 and
102/96) tried definition wordings; one wording (`set_status` "a new file's first
status included") moved flash's `opens_new_design` on the sweep cases and was
reverted. Wording is not iterated further, because past this point it tunes the
instrument to a model.

Dispositions, one per case that missed in any recorded run (D = disposition):

| Case(s) | D | Second reading / evidence | Edit | Final flash / pro |
| --- | --- | --- | --- | --- |
| `gate-draft-reviewed-canonical`, `gate-reviewed-pending-canonical`, `gate-pending-landed-canonical`, `gate-pending-landed-paraphrase` | 2 (field) | `write_target: none`: no content is written, so "no file". Under the definition, the status line's file is the target | definitions | 3/3 · 3/3; landed-paraphrase pro 2/3: `run_retro, landed` (see S below) |
| `fork-impl-defect-*`, `fork-retro-p0-*` (status) | 2 (field) | `pending-retro` = "stays pending-retro" = `unchanged` | grading rule + definition | 3/3 · 3/3, except below |
| `gate-reviewed-pending-trap` | 2 (field) | `worklog`: the gap is recorded | definitions | 3/3 · 3/3 |
| `fork-retro-followup-*` | 2 (question) → **S** | "How is this routed?" scores one act of a two-act verdict (land + follow-up) | questions name the scored act | 0/3 · 0/3: both answer `run_retro, draft-followup, followup_design_file`; only `next_action` differs |
| `fork-retro-design-defect-*`, `fork-retro-p0-design-*`, `fork-retro-p0-*` (action) | 2 (question) | "routed?" during a retro admits "the retro continues" (`run_retro`) | questions say the verdict is reached | flash 3/3 (p0-design-trap 1/3: `remediate, none`, see M); pro paraphrases 0–1/3: `run_retro` (S) |
| `sweep-destination-*` | 2 (question) | "where do items go?" admits passing the gate (`set_status, reviewed`) | questions name file + status | flash canonical 0/3, others 2/3: `opens_new_design: true` (M); pro trap 0/3: `reject_finding` (S) |
| `write-target-retro-canonical` | 2 (fixture + question) | the fixture said a correction was "applied to the design body", which design 09 forbids; "where does the record go?" admits landing | fixture fact fixed; question names the act | 3/3 · 3/3 |
| `write-target-retro-trap` | 2 (question) | the proposal reads as a finding to reject (`reject_finding, worklog`: right file) | question names the act | 3/3 · 3/3 |
| `fork-p0-violation-canonical`, `-trap`, `-paraphrase` | 2 (question) → **S** | rejecting the reviewer's "sweep it" filing is itself an act | trap question names the reader | trap 1/3 · 0/3 `reject_finding`; canonical and paraphrase 3/3 · 3/3 |
| `gate-reviewed-pending-paraphrase` | **S** | pro answers the handoff (`run_retro`) instead of the status write; the skill sentence holds both ("set … and hand to `flow-retro`") | none | 3/3 · 0/3 |
| `fork-impl-defect-canonical` | **M** | flash `remediate, unchanged, worklog`: 0/3 in the final run, 3/3 in both intermediate runs | none | 0/3 · 3/3 |
| `budget-paraphrase` | **1** | Both models halt at round 3 of a loop whose brief is misread. `flow-common` gives rounds 3–4 "Rewrite the brief", but the round-5 sentence lists "the brief is wrong" as a halt cause. No other model family available to confirm | none; stays red | 0/3 · 0/3 |

**S (schema, stage vs act):** a disposition-2 reading that definitions cannot remove
without naming situations. `next_action` mixes *which stage is running* (`run_retro`)
with *what act it takes* (`set_status`, `remediate`, `halt_structural`). In a retro or
a handoff, "the retro" is a true answer for every act inside it. The design's
non-goals put a schema change out of scope, so this is recorded as a finding; the
cases stay red.
**M (model-specific, intermittent):** one model, below k/k, with a reading the
definitions exclude and the other model 3/3. Recorded, no edit; flakiness is not a
skill finding.

Follow-ups (for a `draft-followup` file at this design's retro):
1. **Schema: split stage from act**, e.g. score `act` only, or add a `stage` field.
   This covers every S row (11 cases).
2. **Skill finding, `flow-common` round budget:** the rounds 3–4 "rewrite the brief"
   rule vs "the brief is wrong" as a round-5 halt cause (`budget-paraphrase`).
3. **Model diversity:** confirm row 2 and the M rows with another model family
   (no key on this machine).
