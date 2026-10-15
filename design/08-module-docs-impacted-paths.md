# 08 - Module docs and impacted paths

## User inputs

The owner named the module documents as the per-package canon:

> docs/modules/<pkg>/{contract,model,properties}.md yes that's what I mean

The owner stated that some documents sit beside that set rather than inside it:

> language is special doc additional to the triple or quad

The owner stated the order in which a change moves:

> It's actually a design file updates these docs, then the code

The owner asked whether the convention should be formalized, and where its rules live:

> I'm thinking if we should refine skills to formalize the module docs convention

> and that skill itself provides template doc-verify rules to the module docs quad

The owner named the link that ties the documents to the code:

> the impacted paths

## Problem statement

The module documents under `docs/modules/<pkg>/` are meant to be the current law of
each package, but nothing ties them to the code they describe or to the design that
changed them. A change to a package's code passes every gate without touching its
module documents. Three merges in a row did exactly that:

- PR #11 deleted the old evaluator, `evaluate.ts`, and made `doc-verify/src/kernel/` the
  only evaluator. `docs/modules/language/contract.md` still lists an `evaluate`
  module, and no module document covers the kernel.
- Fix #317 added a `coverage` record to the report and made an incomplete PASS
  become BLOCKED. `docs/modules/report/` does not mention coverage.
- PR #13 added `core.section_ref`. The language facts list does not name it.

The designs that decided the kernel and the section relations (05, 06, 07) are on
`dv/trusted-kernel-trials` only, so the code on `main` has no design on `main`
behind it.

The convention is written down only as a template. `skills/project-skeleton`
ships the four files, a worked `core` example and a rule module (`canon.yaml`), and
says nothing about when the documents move. The design guide says a decision "folds
into `docs/`" after landing, which reverses the owner's order.

## Scope - what we touch

The convention, in `skills/project-skeleton`:
- `skills/project-skeleton/SKILL.md`: a module-docs section that defines the quad (contract, model,
  properties, verification), additional documents such as `language`, when a
  package earns its own module, and the order design → module docs → code.
- `skills/project-skeleton/init/design/00-design-file-guide.md`: a design's decision updates
  `docs/modules` before the code that implements it lands.
- `skills/project-skeleton/init/docs/modules/core/*.yaml`: each companion declares `governs:`.
- `skills/project-skeleton/init/doc-verify/modules/canon.yaml`: retired in favour of the engine's
  `doc-verify:module-*` libraries, which already carry the same rules, plus the new
  constraints below.

The engine, in `doc-verify/`:
- `doc-verify/src/config.ts`: a companion's `document.governs` (repository globs).
- `doc-verify/src/snapshot.ts`: a changed path that a module document governs puts that
  document in the affected closure.
- `doc-verify/src/engine/facts.ts`: `core.changed/1` (a path in the change set) and
  `core.governs/2` (document, path).
- `doc-verify/lib/module-*.yaml`: the constraints `module-docs-track-code` and
  `governed-paths-exist`. A new library, `module-coverage`, reports source paths that
  no module governs.

The review, in `skills/flow-grill-review/SKILL.md`: a design's Scope lists the module
documents and code paths it impacts, and the review checks that list.

home.conf adopts the result:
- `AGENTS.md` points at `docs/modules`.
- Every companion under `docs/modules/` declares `governs:`.
- A `kernel` module joins the four existing ones, from designs 06 and 07 once
  they are on `main`.
- `docs/modules/language/contract.md` drops its `evaluate` row and names the spine relations and
  `core.section_ref`.
- `docs/modules/report/` states the coverage record and the coverage verdict rule.

Non-goals:
- Checking that a document's prose matches the code's behaviour. That stays with the
  judge-backed `current_not_history` and `pairs_every_property` questions.
- Symbol-level governance. `governs:` is path globs only.
- Bringing designs 05 to 07 to `main`. That is the owner's ruling; this design
  names it as a precondition for the kernel module only.
- Any change to the kernel's semantics.

## Rationale

The documents drift because every gate looks at documents alone. doc-verify already
knows the change set: `--staged` and `--range` compute it in `snapshot.ts` to build
the affected closure. It is not exposed to rules. Exposing it, and letting a module
document declare the paths it governs, turns "this commit changed governed code" into
a fact a deterministic rule can read. No judge and no key are needed, so the commit
hook can enforce it.

Three candidates were weighed:

1. **A separate hook script** that maps paths to documents. It needs no engine
   change, but it duplicates the selection logic, lives outside the language, and
   cannot give a proof tree.
2. **`governs:` in the companion, with change facts in the engine** (chosen). The
   mapping sits next to `depends_on`, where the document already declares its edges.
   The rule is ordinary module code with a population and a proof, and other
   repositories get it through `doc-verify:module-*`.
3. **Governance declared in the design files.** A design is frozen after landing,
   so it cannot describe today's mapping. The design names impacted paths for its
   own change. The standing mapping belongs to the module documents.

The gate passes a change to governed code in one of two ways: the governing module
document changes in the same change set, or a design in the same change set lists
the path in its Scope. The second keeps a pure refactor possible without editing
the documents, while still making someone name it.

The project-skeleton copy of the rules (`canon.yaml`) and the engine's
`doc-verify:module-*` libraries say the same thing twice. home.conf already uses the
libraries. Retiring the copy leaves one place to add the new constraints.

## Mechanism

A module companion:

```yaml
schema_version: 1
kind: document-contract
document:
  path: docs/modules/report/contract.md
  kind: module-contract
  governs:
    - doc-verify/src/report.ts
    - doc-verify/src/types.ts
```

The facts, for a change set C and a document D with `governs` globs G:
- `core.changed(P)` for each path P in C. Under `--all` the set is empty and the
  constraint is vacuous.
- `core.governs(D, P)` for each path P in C that matches a glob in G.
- `core.changed(D)` holds when D's own path is in C.

The constraint lives in `doc-verify:module-contract` and its siblings. The rule body has no disjunction, and a rule head is a YAML key, so it cannot take
two clauses. The constraint is written as a `forbid` over a stratified negation:

```yaml
rules:
  untracked(D, P): core.governs(D, P), not core.changed(D), not design_scope_names(P)
constraints:
  module-docs-track-code:
    forall: core.governs(D, P)
    forbid: untracked(D, P)
    severity: error
    message: "{P} changed, but {D}, which governs it, did not"
    repair: "Update {D} first, or list {P} in the Scope of the design in this change."
```

`design_scope_names(P)` holds when a design in the change set has a Scope section
whose code spans include P.

`governed-paths-exist` fails when a `governs` glob matches no file. `module-coverage`
lists the source files under configured roots that no module governs, as a warning.

## Open questions

- **Cross-document facts.** `design_scope_names(P)` reads a design's sections while the
  constraint ranges over a module document. If the engine evaluates one document's
  facts at a time, the design half needs either a run-level fact
  (`core.scoped(P)`, computed from the designs in the change set) or the gate drops
  that escape and requires the module document to change. Settle this at review,
  against `doc-verify/src/engine/index.ts`.
- **Numbering.** The lowest unused number on `main` is 05, but 05 to 07 exist on
  `dv/trusted-kernel-trials`. This file takes 08 so that bringing those designs to
  `main` causes no collision.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| Drift is caught | A staged change to `doc-verify/src/report.ts` with no change to `docs/modules/report/*` passes `check --staged` | seeded scratch commit in a throwaway worktree; `npm test -- governs` |
| A design can carry the change | The same change with a design whose Scope names `doc-verify/src/report.ts` fails | `npm test -- governs` |
| Vacuous under `--all` | `check --all` reports a `module-docs-track-code` finding | `npm test -- governs` |
| Stale globs fail | A `governs` glob that matches no file loads without a finding | `npm test -- governs` |
| Closure follows governance | Changing a governed path does not select the governing document | `npm test -- selection` |
| The three motivating merges | Replaying #11, #317 and #13 on their parents with the new rules gives no finding for each | `check --range <parent>..<merge>` per merge, recorded in the worklog |
| One copy of the rules | `skills/project-skeleton/init` still ships `canon.yaml`, or a skeleton project's module documents are not checked by `doc-verify:module-*` | the skill's validation protocol, steps 1 and 3 |

Each witness must first be observed failing on a seeded defect, as the skeleton's
validation protocol requires.

## Goal

This design has no goal file yet. The owner's request is quoted in User inputs.

## Review

worklog/08-module-docs-impacted-paths.md

## Status

draft
