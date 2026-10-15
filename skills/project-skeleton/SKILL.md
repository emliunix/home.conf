---
name: project-skeleton
description: "Initialize a repository or subproject with the document spine: constitution, design/goal/worklog, typed docs canon, doc-verify modules, and optional Git hook. Use when asked to skeleton a project, set up the spine, or install doc gates in a new or existing repository."
---

# Project skeleton

`init/` is the reference document spine. `scripts/init.sh TARGET_DIR NAME` copies it
without Git setup, so the target can be a subproject in an existing repository.
`git/` holds optional Git files; `scripts/git.sh TARGET_DIR` installs those files
and initializes Git only when the target is not already a repository. It refuses
to initialize a nested repository. Neither script commits or installs hooks.

## What the skeleton installs

| Piece | File | Gate it provides |
|---|---|---|
| Spine | `constitution.md`, `AGENTS.md`, `docs/architecture.md`, `docs/index.md` | orientation; spine module checks roots/falsifiers |
| Decision records | `design/00-design-file-guide.md` + `doc-verify/modules/{artifact,design}.yaml` | status vocabulary, heads, claim-level falsification |
| Epics | `goals/00-goal-file-guide.md` + `doc-verify/modules/goal.yaml` | anchored root, coverage, ledger rules |
| Typed canon | `docs/modules/<pkg>/{contract,model,properties,verification}.md` (see Module docs) | `doc-verify:module-*` shape rules + current-not-history and pairing oracles |
| Project docs | `docs/architecture.md`, `docs/index.md` + `canon.yaml` | boundary and routing-table rules + current-not-history oracle |
| Untyped docs | `docs/**` remainder + `doc-verify/modules/docs.yaml` | current-not-history oracle + link/path resolution |
| Worklog | `worklog/` + `doc-verify:references` (`worklog.yaml` for `type: record` companions) | links resolve; record-typed entries run evidence-not-law |
| Docs gate | `.doc-verify.yaml` + optional Git hook config (pinned `b9e950d`) | `doc-verify check --all` |
| Layering gate | `tests/test_layering.py` | import direction between packages |
| Pairing gate | `tests/test_canon_docs.py` | every P-`<pkg>`-NN has a runnable check row |
| Rule quality | `tools/rule_quality/` | seeded mutations prove the doc rules bite |

## Module docs

`docs/modules/<pkg>/` holds a package's current law. This section is the one
statement of the convention; the flow skills point here.

| Document | Holds |
|---|---|
| `contract.md` | the public surface (stable exports) and the rules callers rely on |
| `model.md` | the concepts and state the package rests on |
| `properties.md` | the properties it claims, as `P-<pkg>-NN` ids |
| `verification.md` | each claimed id paired with the check that witnesses it, and that check's limit |

Each document has a companion `.yaml` that declares its kind, so the engine's
`doc-verify:module-*` libraries check it.

**Additional documents** sit beside the quad when the subject is a language or a
protocol rather than one package: for example `docs/modules/language/`, which
states what a module author can write. They follow the same four-document shape.

**A package earns its own module** when other code or documents rely on its
exports. A helper that only its own package imports stays inside its owner's
module.

**Order: design → module docs → code.** A design names, in its Scope, the module
documents it changes. Those documents are updated from the reviewed design before
the implementing code is dispatched, and the closing retro checks them against
what was built.

**Two routes.**
- **Design-backed:** the change alters a package's contract, model or claimed
  properties. It needs a design, and the flow gates check the documents
  (`flow-grill-review` Draft contract, `flow-common` implementation gate,
  `flow-retro` closing pass).
- **No design:** the change alters none of them. This is `raft-task-card`'s
  small-task test; a change that fails it is not small.

**Pull-request rule, both routes.** A pull request that changes a package's code
carries a `Module docs:` line in its description: the module documents it
updates, or `none` with the reason the contract is unchanged.

## Setup

1. Run `scripts/init.sh ../my-project my-project`. This only copies the spine.
   To create a standalone Git repository, also run `scripts/git.sh ../my-project`.
   For a subproject, keep its parent's Git repository. Doc-verify resolves the
   Git root, not the current directory: move the copied `.doc-verify.yaml` to
   that root, prefix its patterns and module paths with the subproject path,
   and prefix companion `document.path` and `depends_on` values too. If the
   parent already has a doc-verify config, merge the subproject's rules into it
   instead. Put the protected `.env.doc-verify` link at the Git root. Merge
   `git/.pre-commit-config.yaml` into the parent's hook config with a file
   filter for the subproject. Copy `git/.gitignore` into the subproject if the
   parent does not already ignore its local verifier cache and test environment.
   Do not create a nested Git repository or hook.
2. Fill the constitution's `>` placeholders and the `docs/modules/core/` example with
   real content (the placeholders pass the gates; they are not honest law).
3. Edit `tests/test_layering.py`'s `PACKAGES`/`LAYER_OF` for the project's layout the
   first time a package splits out.
4. Point a gitignored `.env.doc-verify` symlink at the protected judge-key file.
   Install the Git hook only when the key exists and the owner opts in:
   `uv tool install prek && prek install` at the Git repository root.
5. Run `uv run --group test python -m pytest -q` from the initialized project.
   Run `npm exec --yes --package=github:emliunix/home.conf#b9e950d7b2e7dca392bd9f6091863f6d16aabe52 -- doc-verify check --all`
   from the Git root, which is the same directory for a standalone project.

## Validation protocol (how this skill was proven, and how to re-prove it)

Initialize a scratch standalone project with both scripts, then require:

1. `doc-verify check --all` → PASS (structural + semantic, with the key).
2. `pytest -q` → green (layering + canon pairing + the placeholder witness).
3. Seed one defect per gate and show each goes red:
   - constitution falsifier made vague → `spine-falsifiers-observable` NO-GO;
   - a design Status line made multi-word → `design-status-is-one-word` NO-GO;
   - a module contract's `Public surface` heading renamed → `module-contract-has-surface` NO-GO;
   - `docs/architecture.md`'s `Boundary` heading renamed → `architecture-states-boundary` NO-GO;
   - `docs/index.md`'s `Document index` heading renamed → `index-routes-one-hop` NO-GO;
   - a canon verification row stripped of its node id → `test_canon_docs` red;
   - a property's row removed entirely → `test_canon_docs` red;
   - a cross-layer import against the table (configure `PACKAGES`/`LAYER_OF`/`MAY_IMPORT`
     first) → `test_layering` red, while an allowed-direction import stays green;
   - a seeded doc mutation → `tools/rule_quality` reports the flip.

Also initialize a child directory in an existing scratch Git repository with
`scripts/init.sh`: it must copy the spine without creating `.git`; running
`scripts/git.sh` on the child must refuse the nested Git setup.

## Limits

- The template's placeholder content passes the gates but is not real law; the first
  real edit should replace it.
- `tools/rule_quality` needs the judge key and npm; run it with
  `--only mutations` for the deterministic leg. Mutations seed against the project's
  own documents of each kind — in a fresh skeleton those are the 00- guides, whose
  shapes cover most anchors; rows that find nothing to mutate report
  `mutation not applicable` or a miss instead of passing.
- The Git step is optional. A subproject uses its parent's hook configuration;
  a nested `.pre-commit-config.yaml` does not install a working parent hook.
- The copied `.doc-verify.yaml` is rooted for a standalone repository. In a
  subproject it requires the prefix and parent-config integration above before
  doc-verify can read it. Do not report the gate as PASS on an unwired copy.
- The prek hook stays uninstalled until the key exists (an unkeyed hook refuses every
  document commit).

## Owning records

- Reference instance: the `init/` directory beside this file. Optional Git
  files are in `git/`.
- Engine: home.conf `main` at `b9e950d` (the WFS kernel, PR #11); bump deliberately and rerun the
  baseline (`cfdf457` showed an engine change can silently shift verdicts).
