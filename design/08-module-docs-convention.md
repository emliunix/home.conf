# 08 - Module docs convention in the skills

## User inputs

The owner named the module documents as the per-package canon:

> docs/modules/<pkg>/{contract,model,properties}.md yes that's what I mean

The owner stated that some documents sit beside that set rather than inside it:

> language is special doc additional to the triple or quad

The owner stated the order in which a change moves:

> It's actually a design file updates these docs, then the code

The owner asked to formalize the convention in the skills, and named where its rules
already live:

> I'm thinking if we should refine skills to formalize the module docs convention

> and that skill itself provides template doc-verify rules to the module docs quad

> I mean what skills we refine to make the modules doc convnetion formal

The owner accepted this scope: the skills and the project-skeleton template here,
and home.conf's own module documents as a follow-up task.

## Problem statement

The module documents under `docs/modules/<pkg>/` are meant to be each package's
current law, and the order is design → module docs → code. No skill says so. Only
`skills/project-skeleton` mentions the documents, as a template: a table row, a
worked `core` example and a rule module. No flow skill asks a design to name the
module documents it changes, asks the implementer to update them before the code,
or asks the closing retro to check them against what was built. The template's own
design guide says a decision "folds into `docs/`" after landing, which reverses the
order.

The cost is visible in home.conf. Three merges in a row changed doc-verify's code
with no change to `docs/` or `design/`:
- PR #11 deleted the old evaluator and made `doc-verify/src/kernel/` the only one.
  `docs/modules/language/contract.md` still lists an `evaluate` module, and no
  module document covers the kernel.
- Fix #317 added a coverage record and made an incomplete PASS become BLOCKED.
  `docs/modules/report/` does not mention coverage.
- PR #13 added `core.section_ref`, which the language facts list does not name.

Every flow gate passed, because none of them looks at the module documents.

## Scope - what we touch

Skill texts:
- `skills/project-skeleton/SKILL.md` owns the convention. It gains a module-docs
  section that defines:
  - the quad: contract (public surface and the rules callers rely on), model
    (concepts and state), properties (the claimed `P-<pkg>-NN` ids), verification
    (each id paired with the check that witnesses it, and its limit);
  - additional documents beside the quad, such as `language`, which describe a
    language or protocol rather than one package;
  - when a package earns its own module;
  - the order: a reviewed design names the module documents it changes, those
    documents are updated from the design, and then the code follows.
- `skills/flow-grill-review/SKILL.md`: a draft's Scope names the module documents
  it changes. Item 0 returns a draft that changes a package's behaviour without
  naming them.
- `skills/flow-common/SKILL.md`, implementation gate: before dispatch, the module
  documents named by the design are updated. The done checklist confirms it.
- `skills/flow-retro/SKILL.md`, closing pass: before `landed`, the module documents
  match what was built. A mismatch is a bounded correction, not a note.
- One line each:
  - `skills/raft-task-card/SKILL.md`: a card that changes a package's behaviour
    names its module documents next to its design link.
  - `skills/spine-orient/SKILL.md`: for a fact about a package, the module
    documents are the owning document. A landed design is history.
  - `skills/finding-triage/SKILL.md`: moving canon includes the module documents,
    and the change cites the design that moved them.

Template files in `skills/project-skeleton/init/`:
- `design/00-design-file-guide.md`: a design's decision updates `docs/modules`
  before the code that implements it lands.
- `skills/project-skeleton/init/doc-verify/modules/canon.yaml` is retired. Its rules duplicate the engine's
  `doc-verify:module-*` libraries. The four `docs/modules/*` rules in
  `.doc-verify.yaml` point at those libraries instead.
- `skills/project-skeleton/init/AGENTS.md` and `skills/project-skeleton/init/docs/index.md`: one line each pointing at the convention.
- `docs/modules/core/*`: the worked example follows the section definitions.

Follow-up, not in this design: home.conf applies the convention to its own
documents. That covers an `AGENTS.md` pointer, a `kernel` module, the `language`
contract (no `evaluate` row; `core.section_ref` and the spine relations named), and
the `report` coverage record. The kernel module is written from designs 06 and 07,
so it waits for the owner's ruling on bringing designs 05 to 07 to `main`.

Non-goals:
- Any change to doc-verify's code or its engine libraries.
- A mechanical gate that ties module documents to code paths. It is a possible
  follow-up once the written convention has been used.
- Checking that a document's prose matches the code's behaviour. That stays with
  the judge-backed `current_not_history` and `pairs_every_property` questions.

## Rationale

The convention fails at the hand-offs between flow stages, so it is written at
those hand-offs. A rule kept only in project-skeleton is read once, when a project
is created. The flow skills are read at every design, implementation and retro,
which is where the module documents were skipped.

Each stage gets one check, in the skill that owns that stage:
- review: the design names the documents (flow-grill-review);
- implementation: the documents move before the code (flow-common);
- closing: the documents match the build (flow-retro).

A check placed in only one stage leaves the others open. Review alone cannot catch
a build that drifted from its design. Retro alone finds the drift after the code
has merged, which is what happened with #11 and #317.

The definitions live once, in project-skeleton. The flow skills point there and do
not restate them, following the one-statement-per-fact rule in spine-orient.

`canon.yaml` is retired rather than extended, because home.conf already checks its
own module documents with `doc-verify:module-*`. Two copies of one rule set drift
the same way the documents did.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| The skeleton states the convention | A scratch project initialized from the skill has no module-docs definition, or `design/00-design-file-guide.md` still says the decision folds into `docs/` after landing | `skills/project-skeleton/scripts/init.sh` into a scratch directory, then `grep` the copied files |
| One copy of the rules | The template still ships `canon.yaml`, or a scratch project's module documents are not checked by `doc-verify:module-*` | the skill's validation protocol, steps 1 and 3 |
| The template still gates | A seeded module contract without `Public surface` passes `doc-verify check --all` in the scratch project | the skill's validation protocol, step 3 |
| Review names the documents | A seeded draft that changes a package and names no module documents passes item 0 of flow-grill-review | a reviewer seat run on the seeded draft, recorded in the worklog |
| The flows point, not restate | A flow skill defines the quad itself instead of pointing at project-skeleton | `grep -n "contract, model" skills/flow-*/SKILL.md` |
| Skill packages stay valid | A changed skill fails its package lint or trigger cases | `prek run --all-files` (skill package lint, skill dispatch coverage) |

Each witness is first observed failing on a seeded defect, as the skeleton's
validation protocol requires.

## Open questions

- **Numbering.** The lowest unused number on `main` is 05, but 05 to 07 exist on
  `dv/trusted-kernel-trials`. This file takes 08 so that bringing those designs to
  `main` causes no collision.

## Goal

This design has no goal file. The owner's request is quoted in User inputs.

## Review

worklog/08-module-docs-convention.md

## Status

draft
