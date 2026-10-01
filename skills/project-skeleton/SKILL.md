---
name: project-skeleton
description: Bootstrap a new project with the verified document spine — constitution, design/goal/worklog, typed docs canon, doc-verify modules and hook, layering and canon-pairing gates, and the rule-quality harness. Use when starting a new repository that should follow the visflow/home.conf document-contract method, or when asked to "skeleton a project", "set up the spine", or install the doc gates on a fresh repo.
---

# Project skeleton

Extracted from visflow (design 10, task #14). The template directory beside this file is
the reference instance; `bootstrap.sh TARGET_DIR NAME` copies it into a new git repo.

## What the skeleton installs

| Piece | File | Gate it provides |
|---|---|---|
| Spine | `constitution.md`, `AGENTS.md`, `docs/architecture.md`, `docs/index.md` | orientation; spine module checks roots/falsifiers |
| Decision records | `design/00-design-file-guide.md` + `doc-verify/modules/{artifact,design}.yaml` | status vocabulary, heads, claim-level falsification |
| Epics | `goals/00-goal-file-guide.md` + `doc-verify/modules/goal.yaml` | anchored root, coverage, ledger rules |
| Typed canon | `docs/modules/<pkg>/{contract,model,properties,verification}.md` + `canon.yaml` | shape rules + current-not-history oracle |
| Docs gate | `.doc-verify.yaml` + `.pre-commit-config.yaml` (pinned `2381b1f`) | `doc-verify check --all` |
| Layering gate | `tests/test_layering.py` | import direction between packages |
| Pairing gate | `tests/test_canon_docs.py` | every P-`<pkg>`-NN has a runnable check row |
| Rule quality | `tools/rule_quality/` | seeded mutations prove the doc rules bite |

## Setup steps (in the bootstrapped project)

1. `./bootstrap.sh ../my-project my-project`, then `cd ../my-project`.
2. Fill the constitution's `>` placeholders and the `docs/modules/core/` example with
   real content (the placeholders pass the gates; they are not honest law).
3. Edit `tests/test_layering.py`'s `PACKAGES`/`LAYER_OF` for the project's layout the
   first time a package splits out.
4. Judge key: `ln -s ~/.config/doc-verify/credentials.env .env.doc-verify`, then
   optionally `uv tool install prek && prek install`.
5. Verify: `uv run --group test python -m pytest -q` and
   `npm exec --yes --package=github:emliunix/home.conf#2381b1fd3dcb9f02ec7d8bee096ba155e9456266d -- doc-verify check --all`.

## Validation protocol (how this skill was proven, and how to re-prove it)

Bootstrap a scratch project and require, out of the box:

1. `doc-verify check --all` → PASS (structural + semantic, with the key).
2. `pytest -q` → green (layering + canon pairing + the placeholder witness).
3. Seed one defect per gate and show each goes red:
   - constitution falsifier made vague → `spine-falsifiers-observable` NO-GO;
   - a design Status line made multi-word → `design-status-is-one-word` NO-GO;
   - a canon verification row stripped of its node id → `test_canon_docs` red;
   - a property's row removed entirely → `test_canon_docs` red;
   - a cross-layer import against the table (configure `PACKAGES`/`LAYER_OF`/`MAY_IMPORT`
     first) → `test_layering` red, while an allowed-direction import stays green;
   - a seeded doc mutation → `tools/rule_quality` reports the flip.

## Limits

- The template's placeholder content passes the gates but is not real law; the first
  real edit should replace it.
- `tools/rule_quality` needs the judge key and npm; run it with
  `--only mutations` for the deterministic leg.
- The prek hook stays uninstalled until the key exists (an unkeyed hook refuses every
  document commit).

## Owning records

- Reference instance: visflow (constitution, `design/09`, `design/10`, `docs/modules/`).
- Engine: home.conf `doc-verify-v2` at `2381b1f`; bump deliberately and rerun the
  baseline (`cfdf457` showed an engine change can silently shift verdicts).
