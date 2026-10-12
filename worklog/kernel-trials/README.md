# Kernel trials

Programme root for the question: **can a mature logic engine replace doc-verify's hand-written
evaluator as the kernel, preserving the project's invariants?** The invariants are stated in
`preregistration.md` §Constitution. The question fits no existing tree (the doc-verify worklogs
record design rounds, not kernel measurements), so it has its own root.

## Files

- `README.md` — this file.
- `preregistration.md` — round 1: hypothesis, axis, candidates, pass conditions and the expected
  outcome of each, written before the first run. Its review by an independent seat is appended
  under §Review before the run.
- `probe/` — the probe programs. `probe/prolog/*.pl` are the Prolog programs under test;
  `probe/run-*.mjs` drive them; `probe/vendor/` holds the installed runtime (its own
  `package.json`, not the repository's).
- `results/round-1-<candidate>.md` — one results file per candidate run, named for the probe that
  wrote it.
- `round-1-verdict.md` — the round's verdict: what measured, which candidate it selects, what it
  leaves unmeasured, which expectations it contradicted.
- `decisions.md` — one row per landed unit.
- `gate-ledger.md` — committed predicates, the seeded defect each was seen failing on, open items.
- `round-1-verdict.md`, `round-2-verdict.md`, `round-3-verdict.md` — written 2026-10-12.
- `results/round-2-review.md`, `results/round-3-review.md`, `results/round-4-review.md` — the
  independent seat's reviews, verbatim.
- `round-4-preregistration.md`, `round-4-verdict.md`, `results/round-4-*-live.txt` — round 4
  (2026-10-13): the evidence-cell grain. Its fixture sets are
  `probe/oracle-fixtures/evidence_reasons/` (the Markdown files, reused by the candidate sets
  `evidence_column_reason/`, `evidence_cells_reason/`, `evidence_reasons_paraphrase/` through
  `files_from`) and `probe/oracle-fixtures/real-cells/` (the lead's blind labels of goals/01–03's
  cells and the control module). Ledgers: `probe/oracle-fixtures/.question-count-round4-*`.
- `round-4c-preregistration.md`, `round-4c-verdict.md`, `results/round-4c-review.md`,
  `results/round-4c-*-live.txt` — round 4c (2026-10-13): `verification_falsifies` on the cell
  grain. Fixture sets `probe/oracle-fixtures/witness_observable/`, `witness_observable_in_row/`,
  `witness_observable_paraphrase/` (files reused from `verification_falsifies/`, which gained
  `controls.md`, `defective-swapped.md`, `defective-subtle3.md`); blind labels
  `probe/oracle-fixtures/real-cells/witness-labels.yaml`.
- `round-4b-preregistration.md`, `round-4b-verdict.md`, `results/round-4b-review.md`,
  `results/round-4b-*.txt` — round 4b (2026-10-13): clingo with free externals as subject S3
  (`probe/kernel3/subject-clingo.mjs`, `clingo-wasm` vendored beside swipl-wasm).
- `round-5-preregistration.md`, `round-5-verdict.md`, `results/round-5-review.md`,
  `results/round-5-*.txt` — round 5 (2026-10-13): the trust boundary (instance, sandbox gate,
  inference budget; seeds by layer, gate mutations) and a scheduler measurement track
  (`probe/run-boundary.mjs`).
- `round-6-preregistration.md`, `round-6-verdict.md`, `results/round-6-review.md`,
  `results/round-6-*-live.txt`, `results/round-6-compare.txt` — round 6 (2026-10-13): request
  shape, batched against per-atom (`probe/compare-shapes.mjs`; sidecars
  `probe/oracle-fixtures/.leaves-round6-*.json`; reversed-order fixtures under
  `probe/oracle-fixtures/.reversed/`).

## Not created yet

- `results/round-1-native.md` — the native-swipl candidate runs only if the WebAssembly candidate
  fails a condition (see preregistration §Candidates).

## Findings about the record itself

- `AGENTS.md` named no programme roles when this tree was opened; this tree followed the shape of
  `worklog/memory-spine-trials/` by analogy. **Resolved 2026-10-12**: `AGENTS.md` §Experiment
  programmes now binds the roles by file name (plan, probes, results, verdict, decision rows, gate
  ledger, the independent seat). A model-route table is still absent and is recorded there.

## Method

Rounds follow the loop bound in the repository `AGENTS.md` §Experiment programmes. Round 1 is
feasibility (`preregistration.md`); round 2 is model conformance (`round-2-preregistration.md`,
done, kernel selected); round 3 is the oracle toolkit's first live run (done;
`round-3-verdict.md`); round 4 is the evidence-cell grain for `doc-verify:goal`, which added the
table facts (`round-4-preregistration.md`; it displaced the planned `verification_falsifies`
extraction round, now round 4c, which those facts serve); round 4b is clingo as a third kernel
subject (done; the kernel stays); round 5 is the trust boundary, with the scheduler as a
measurement track (`round-5-preregistration.md`). The design the rounds feed is
`design/05-trusted-kernel-redesign.md`.
