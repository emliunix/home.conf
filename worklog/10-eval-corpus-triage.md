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
