# docs consolidation: inventory

Survey of `docs/` and adjacent material, 2026-11-27, at `6a87056`. Evidence, not law.

## What each page owns

| Page | Owns | Governed | Inbound references |
|---|---|---|---|
| `docs/doc-verify-constitution.md` | proposition, roots R1-R6, invariants 1-7 with falsifiers | no | the model; the kernel corpus fixture |
| `docs/doc-verify-model.md` | the formal semantics the kernel implements (WFS, demand, verdict, gates) | no | `doc-verify/src/kernel/core.pl`, `kernel/index.ts`, `tests/kernel-slow/reference/reference.mjs`, `tests/references/fragment-fixture/` (anchored links to §3, §4, "where u comes from") |
| `docs/doc-verify-intro/` | the intro deck and replayable demos (captured at `6937c15`) | no (its README says so) | none outside itself |
| `docs/modules/{language,oracles,report,selection}/` | per-package contract, model, properties, verification (16 configured documents + companions) | yes, `doc-verify:module-*` | `.doc-verify.yaml`; designs 08, 12; `skills/project-skeleton` (the convention's owner); `flow-skills-eval` cases (as an example path); the frozen kernel corpus fixture |
| root `README.md` §doc-verify (~360 of 371 lines) | the doc-verify user manual: CLI, flags, exit codes, cache, config, mutation tables, `matches/2`, `core.present/3`, engine libraries, companions, v1 migration | no | the CLI's own error text ("the doc-verify README") |

## Out of scope by content

- `tskill/docs/`: the TSkill Python TUI. Unrelated to doc-verify.
- `design/`, `goals/`, `receipts/`, `worklog/`: decision records, epics and evidence. The
  spine convention (`skills/project-skeleton`) keeps them as siblings of `docs/`, not inside
  it; `docs/` is current law.
- `doc-verify/README.md`: does not exist.

## Duplicated facts

1. CLI modes, flags and exit codes: README §doc-verify, `report/contract.md`, `selection/contract.md`
   (the modes sentence is stated in both contracts).
2. Verdict precedence: `doc-verify-model.md` §5, `report/model.md` §Verdict, `language/properties.md`
   P-language-04, `report/properties.md` P-report-01, README.
3. Evaluation semantics: `doc-verify-model.md` (WFS, the kernel's spec) and `language/model.md`
   §Two bounds (design 04's two-bound reading). Two descriptions of one thing, at different eras.
4. Keyless behaviour: README and `report/properties.md` P-report-04.
5. Cache key: README, `oracles/contract.md`, `oracles/model.md`.

## Stale or contradictory

1. `language/contract.md` lists an `evaluate` module and export; it was removed by PR #11
   (already recorded by design 08 §Problem statement). `index` is said to "return the engine
   report" via the TS evaluator; the kernel now evaluates.
2. `report/contract.md` lists `cli` → `main`, which is not exported. (Corrected at review round 1: `constraintReports` does exist, as an alias re-export at `doc-verify/src/engine/diagnostics.ts:15`.)
3. No module document covers `doc-verify/src/kernel/`, `engine/{demand,kernel-bridge,prolog,terms}`,
   `mutate`, `trace`, `local-env`, or the coverage record (fix #317; design 08).
4. `report/contract.md` `cli`: "`check` and `segments`"; the CLI also has `mutate` (README).
5. Exit codes: `report/contract.md` and P-report-03 list 0-3; README adds 64, 65, 66.
6. Module "packages" do not match the source layout: `language` and `oracles` live in
   `src/engine/`, `report` and `selection` are flat files in `src/`. The package boundary the
   docs name is not one the code has.
7. The constitution cites `AGENTS.md` §Experiment programmes and designs 05-07; none is on `main`
   (the constitution says so itself, so this is disclosed, not hidden).
8. The README's language-link "design 04" is the README's authority for the language; the kernel
   model supersedes design 04's evaluator.
9. design 08's follow-up "home.conf applies the convention to its own module documents" is
   still open; design 12 is a draft-followup.

## Broken or one-way links

- CLI error text points at "the doc-verify README", which does not exist (the section is in the
  root README).
- No page in `docs/` links to another except model → constitution and constitution → model.
  Nothing links into `docs/modules/` from a reader's entry point; nothing routes from the README to
  `docs/`. There is no `docs/index.md` (the spine convention's routing table).

## Frozen references that need no change on a move

`doc-verify/tests/kernel/corpus-facts.pl` and `witnesses/corpus-draft.yaml` are a frozen snapshot
(they list `design/05`, not on `main`); paths in them are data, not links. `corpus.test.ts` reads
only the module YAML from the live tree. `flow-skills-eval` cases use `docs/modules/...` as example
paths inside scenario text.
