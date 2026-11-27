# 13 - Docs consolidation

## User inputs

The owner asked for the documentation under `docs/` to be consolidated into one coherent
tree. The survey ([worklog/13-docs-consolidation/inventory.md](../worklog/13-docs-consolidation/inventory.md))
found that the doc-verify user manual is the root README's `## doc-verify` section, and that the
module documents are stale against the code. Asked whether the tree should take in the README,
the owner chose to include it, with this qualification:

> For README, it's required to be duplicate but it's user facing. while docs/ are for development tracking

So the README stays where it is and keeps its own copy of the user-facing facts. `docs/` is the
development record, and the README must agree with it. Asked whether "consolidate" means only
restructuring, the owner chose to refresh the content against the code as well. That refresh is
design 08's open follow-up: home.conf applies the module-docs convention to its own documents.

## Problem statement

A developer changing doc-verify cannot tell which document owns a fact, or trust what it says.
Neither `AGENTS.md` nor `docs/` routes anywhere: within `docs/`, only the constitution and the
model link to each other. Verdict precedence is stated in five places and the CLI modes in four,
and they disagree: `selection/contract.md` and the CLI help give `--range A..B`, while the code
requires `BASE...HEAD`. The evaluation semantics are stated twice, from two eras of the engine.
The contracts name an export that is not exported (`cli` `main`) and omit ones callers use
(`judgePrerequisiteGap`, `core.section_ref`, the coverage record). The kernel and `mutate` have
no module documents, and nothing catches the drift: every configured document passes
`check --all` while it misstates the code.

## Scope - what we touch

- **Entry points.** `AGENTS.md` gains a Documentation section that routes to `docs/index.md`
  and states the pull-request rule of the `project-skeleton` skill (its Module docs section). `docs/index.md` (the
  routing table) and `docs/architecture.md` (the package map and boundary) are new. Both are
  governed by the skeleton's own types: `artifact_kind: index` and `architecture` under
  `doc-verify/modules/canon.yaml`, copied from `skills/project-skeleton/init/`. Each has a
  companion.
- **The four existing modules `docs/modules/{language,oracles,report,selection}/`**: each fact
  gets one development authority (table below). The contracts' Module column names the source
  file by repository path, and exports, properties and verification rows are brought to the code.
- **New modules `docs/modules/kernel/` and `docs/modules/mutate/`**, four documents and four
  companions each, matched by the existing `docs/modules/*/` rules.
- **A module-docs gate**, `doc-verify/tests/docs/module-docs.test.ts` (the `unit` tier), defined
  under Verification design.
- **User-facing copies**, made to agree with their authority: the root `README.md` §doc-verify
  (it keeps its duplicates; it gains one line routing developers to `docs/index.md`), the CLI help
  text in `doc-verify/src/cli.ts`, and the v1-migration error text in `doc-verify/src/config.ts`,
  which names `README.md` §Migrating from v1 rubrics instead of a missing "doc-verify README". The
  README's quotation of that text and `doc-verify/tests/language/modules-check.test.ts` change in
  the same commit.

Non-goals: moving or renaming `docs/doc-verify-constitution.md`, `docs/doc-verify-model.md` or
`docs/doc-verify-intro/`; amending or governing the constitution and the model; the intro deck's
content, which is a capture frozen at `6937c15` and is exempt from the authority rule; `design/`,
`goals/`, `receipts/`, `worklog/` and `tskill/docs/`, which are not development canon; source
layout and code smells, which are recorded in the worklog, not fixed.

## Rationale

The spine convention (`skills/project-skeleton`) defines the shape: an `AGENTS.md` route, a
routing index, an architecture page, and one four-document module per package that other code
relies on. home.conf has only the modules, and they are stale. This design adds the missing
pieces using the skeleton's own types and corrects the modules. It moves no files. No configured
document is deleted, moved or renamed, so every `design/NN §` citation stays valid, as do the code
comments that cite `docs/doc-verify-model.md` (`doc-verify/src/kernel/index.ts`,
`doc-verify/src/kernel/core.pl`) and the fragment fixtures. The work also does not depend on how
`check` reports a deleted document (PR #26).

**Authority, one per fact.** Corrections flow from the code to the authority. In `docs/`, every
other mention of the fact cites the authority. The user-facing copies (README, CLI help, error
text) restate the fact, as the owner requires, and must agree with the authority.

| Fact | Development authority | Cites it in `docs/` | User-facing copy |
|---|---|---|---|
| Proposition, roots, invariants | `docs/doc-verify-constitution.md` | model, `kernel` | none |
| Evaluation semantics: values, well-founded model, demand, verdict derivation, gates | `docs/doc-verify-model.md` | `language`, `kernel` | README |
| A package's exports and caller rules | `docs/modules/<pkg>/contract.md` | `docs/architecture.md` | README |
| CLI commands, modes, flags, exit codes | `docs/modules/report/contract.md` (`cli` row) | `docs/modules/selection/contract.md` | README, CLI help |
| Finding verdicts and the report's precedence | `docs/modules/report/model.md`, citing model §5 | `docs/modules/report/properties.md` | README |
| Cache key and replay | `docs/modules/oracles/model.md` | `docs/modules/oracles/contract.md` | README |
| Affected set | `docs/modules/selection/model.md` | none | README |
| Package boundaries and import direction | `docs/architecture.md` | `docs/index.md` | none |
| Where each document lives | `docs/index.md` | `AGENTS.md` | README (one line) |

The language module describes design 04's two-bound evaluator, which the kernel replaced. Its
contract summary, §Two bounds, P-language-03 and the "two bounded rounds" verification text become
statements of what the language hands the kernel, with citations of the model's sections.
P-language-04 (verdict precedence) is decided by a report test and states the report's rule, so it
is retired, together with its verification row, and P-report-01 carries it. No property id is
cited outside `docs/`. The README's pointers to design 04 (the language) and design 02 (the
affected closure) are replaced by pointers to their authorities.

**Packages.** Every file under `doc-verify/src/` has an owner, stated in `docs/architecture.md`:
- `language`: `doc-verify/src/engine/{module,compose,facts,checker,terms,prolog,demand,index}.ts`.
  `engine/index.ts` is the language's entry: it compiles a module and runs it on the kernel,
  importing the kernel's `Kernel`, key and `translateProgram` exports directly.
- `oracles`: `engine/oracles.ts`, `judge.ts`, `cache.ts`, `local-env.ts` (judge key resolution).
- `report`: `checker.ts`, `engine/diagnostics.ts`, `engine/kernel-bridge.ts`, `report.ts`,
  `cli.ts`, `segments.ts`, `normalize.ts`. `kernel-bridge.ts` turns the kernel's report into the
  engine report's constraint rows, and only `engine/diagnostics.ts` imports it.
- `selection`: `config.ts`, `selection.ts`, `snapshot.ts`, `dependencies.ts`.
- `kernel`: `doc-verify/src/kernel/`. Its specification is the model, which
  `doc-verify/src/kernel/index.ts` names. The language entry and `kernel-bridge.ts` rely on its
  exports. It imports from the language (`doc-verify/src/engine/terms.ts`, `engine/demand.ts`,
  `engine/checker.ts`, `engine/module.ts`, and `compileModule` from `engine/index.ts`) and from
  the oracles (`OracleStore`), so the import direction between language and kernel runs both ways.
- `mutate`: `mutate.ts`, `mutate-table.ts`. The CLI, the README, `scripts/run-mutate-tables.mjs`
  and the `*.mutations.yaml` tables rely on the table format.
- Shared foundation: `types.ts` and `hash.ts` are imported by every package except the kernel. `project-skeleton`
  §Module docs has no slot for a foundation that every package imports, so the architecture page
  names them as the foundation instead of inventing a module, and the gap is recorded as a
  follow-up against the convention. `trace.ts` has no production importer; the architecture page
  says so, and the worklog records it as a smell.

The package edges are not acyclic: language imports report (`engine/diagnostics.ts`) and oracles,
both of which import language types; language and kernel import each other; and `types.ts`
imports `EngineReport` from `engine/diagnostics.ts`. The architecture page records every cyclic
edge and that dependency as they are, and the worklog records them as smells. This design does
not change them.

**Why a test rather than a doc-verify rule.** Whether an export exists is a fact about
TypeScript, and doc-verify's fact vocabulary does not read code. The TypeScript compiler API
(`typescript` is already a dependency) resolves re-exports and aliases. A `unit`-tier test runs in
the `npm test` gate that every commit already passes.

## Verification design

The module-docs gate reads every `docs/modules/*/` quad. Its grammar:
- **Contract rows.** A Public surface row's Module cell holds exactly one backticked repository
  path to a file (a directory is refused; the kernel contract names `doc-verify/src/kernel/index.ts`
  and its other files row by row). Its Exports cell holds a comma-separated list of backticked identifiers, or `none (entry
  point)` for a file that exports nothing (`doc-verify/src/cli.ts`). An entry point's surface is
  stated in its own section: the report contract's `## Command line` section is the authority for
  CLI commands, modes, flags and exit codes.
- **Verification rows.** The table's columns are Property, Check (deciding test) and Limit. The
  Check cell holds one or more comma-separated backticked repository paths of test files
  (`*.test.ts`, or a file under `doc-verify/tests/kernel-slow/`), or
  `none` for a property with no witnessing test. The Limit cell begins with the tier: `unit`,
  `subprocess` or `kernel-slow`, followed by `;` and the limit. A `none` row's Limit begins with
  `not in force`. Prose outside the table may name tests; `paths-resolve` covers those.

The gate fails when:
1. a Module path does not exist or is not a file;
2. an export is not in the TypeScript compiler's export list for that file, re-exports and
   aliases resolved, or an entry point exports something;
3. a `P-<pkg>-NN` id in `properties.md` has no row in `verification.md`, or a verification row
   names an id that `properties.md` does not claim;
4. a Check path does not exist;
5. a row's tier does not match where the test runs: `vitest.config.ts` puts it in the `unit`
   or `subprocess` project, and `doc-verify/tests/kernel-slow/` is `kernel-slow`;
6. a cell does not follow the grammar.

| Property | Failure witness | Command |
|---|---|---|
| Module paths exist | a Module cell renamed to a missing file, or set to a directory, keeps the suite green | `npm test` (clause 1) |
| Cells follow the grammar | a bare Module name (main's form), a Limit with no tier, or a Check path that is not a test file keeps the suite green | `npm test` (clause 6; red on main's documents) |
| Contracts name only real exports | `cli` `main` (not exported) listed in the contract keeps the suite green | `npm test` (module-docs gate, clause 2) |
| Aliases are resolved | `constraintReports` (an alias re-export) is reported missing | `npm test` (same) |
| Pairing in both directions | a `P-<pkg>-NN` id removed from `verification.md`, or a row left for a retired id, keeps the suite green | `npm test` (clause 3) |
| Named tests exist | a verification row naming a missing test file keeps the suite green | `npm test` (clause 4) |
| Tiers are stated and true | a row naming a `subprocess` test as `unit`, or a `kernel-slow` test as `unit`, keeps the suite green | `npm test` (clause 5) |
| Entry points are honest | `none (entry point)` on a file that exports, or an export listed for `cli.ts`, keeps the suite green | `npm test` (clause 2) |
| The index and architecture are governed | renaming `docs/index.md`'s `## Document index` heading, or linking a missing page, keeps `check --all` at PASS | `node doc-verify/dist/cli.js check --all --profile draft` |
| No configured document lost | the configured path list after each PR differs from the expected list in the worklog (29 at `6a87056`; 30 after PR 1; 32 after PR 2; 40 after PR 3) | `check --all --profile draft --format json`, the artifact paths compared with the list |
| The migration message names a real heading | the heading the message names is missing from `README.md` | `npm test` (`doc-verify/tests/language/modules-check.test.ts`, which also asserts the heading) |
| Contracts omit nothing callers use | an export another package imports is missing from its contract | reviewer seat, on each execution PR's diff (a mechanical check is a recorded follow-up) |
| User copies agree | the README or the CLI help states a mode, flag, exit code or verdict that differs from `docs/modules/report/contract.md` | reviewer seat, on each execution PR's diff |
| Whole tree green | any gate red | `npm test`, `npm run typecheck`, `npm run lint`, `check --all --profile draft` |

Each gate clause is first seen failing on main's documents, or on its seeded defect, before the
documents are corrected.

Execution is three pull requests, each green:
1. This design and its worklog, and the four existing modules made correct and single-sourced.
   The module-docs gate lands first and is red on main's documents. Also in this PR: the README,
   CLI help and error-text agreement, the README's quotation of the error, and the retirement of
   P-language-04 and its row. The language documents cite only the model, not the kernel module.
2. Entry points, routing only to corrected documents: the `AGENTS.md` section, the README's
   routing line, `docs/index.md`,
   `docs/architecture.md`, `doc-verify/modules/canon.yaml`, and their companions and rules. The
   architecture page owns every file; the `kernel` and `mutate` packages are listed without a
   module until PR 3.
3. The `kernel` and `mutate` modules, with their rows in the index and the architecture page.

## Open questions

- Settled 2026-11-27: design 08's follow-up held the kernel module until the owner ruled on
  bringing designs 05 to 07 to `main`. The owner ruled that this design writes it now, from the
  model, which is on `main` and is the specification `doc-verify/src/kernel/index.ts` names.
- Whether the constitution and the model should be governed by doc-verify. Recorded as a
  follow-up.

## Goal

This design has no goal file. The owner's direction is quoted in User inputs.

## Review

worklog/13-docs-consolidation.md

## Status

reviewed
