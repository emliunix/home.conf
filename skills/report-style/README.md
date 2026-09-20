# report-style — design philosophy and dimensions

**What it is.** The method for writing a report in either of its two shapes: the **record** (durable,
source-keyed) and the **brief** (a one-sitting transfer to a peer). `SKILL.md` is the artifact; this package
is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **Shape before prose.** A record and a brief argue differently — one survives the conversation, one
   assumes it. Pick the shape before writing; the wrong shape is not a style problem.
2. **Every assertion carries its warrant** — derived, measured, or marked open. This is the one rule both
   shapes obey (`SKILL.md:20-21`), and it is what makes a report auditable rather than persuasive.
3. **A brief has nine elements and each one earns its place** (`SKILL.md:88-98`). The table's third column
   names the failure if the element is dropped; an element whose removal changes nothing is decoration and
   is cut.
4. **The closing paragraph is a boundary, not a summary** (`SKILL.md:102`). Measured / by design /
   unmeasured / not claimed, each residual with where it lives.
5. **Subtract before you add** (`SKILL.md:122-123`). An order section that repeats the skeleton, or a
   checklist that repeats the elements, is a defect — which is why this package's own furniture is kept
   thin.
6. **A brief may assume the conversation; a record may not.** The record's keys must resolve
   (`SKILL.md:38-42`) and its links are verified against the filesystem before finishing.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the surface fire on report-shaped work — *both* shapes — and stay silent on prose polish, review, and already-enumerated evidence? | trigger pass over `tests/cases/trigger.yaml` triplets, entry-only arm over the full catalog |
| **procedure** | does an agent produce the record's order and legend, or the brief's nine elements in order? | entry-only vs full arm on the same request; the produced record is checked for resolving keys, the brief for the elements and its boundary |
| **comprehension** | is the warrant rule visible in the output (`SKILL.md:20-21`), and does a reader pick the right shape? | mechanical status-tag scan of the full arm's output, plus a wrong-shape probe |
| **production** | do the produced artifacts survive the pinned source set? | the acceptance check over `tests/cases/production.yaml`: status tag per claim, a contrast pair, a closing boundary, the nine elements in order, resolving keys |
| **induction** | does the brief arm produce a shorter, more warrant-visible piece from the same material? | full vs control on the pinned set, judged pairwise and blinded, plus a mechanical word count |
| **ablation** | does each brief element earn its place? | full vs full-minus-one-element; an element the trial never exercised is recorded **unpriced**, not deleted |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`. The
production oracle's judges, axes, order-swap and pass bar are specified in `tests/DESIGN.md`.

## What it refuses

Prose polish (the AI-tells pass is another surface); reviewing someone else's report; a record whose
evidence is already enumerated elsewhere (`SKILL.md:8-9`); motivational framing and restatement; a
boundary paragraph that is a summary; a diagram whose caption restates the adjacent paragraph
(`SKILL.md:34`); a fact without a resolving key.

## Maintenance

`tests/frozen.lock.json` pins the shipped material (`SKILL.md`, this file, `CHANGELOG.md`, the rubric and
the case files). Regenerate it from the package root after any deliberate edit — it is a SHA-256 per file,
so there is nothing to hand-edit:

```
python3 - <<'PY'
import hashlib, json, pathlib
files = ["SKILL.md", "README.md", "CHANGELOG.md", "tests/rubric.yaml",
         "tests/cases/trigger.yaml", "tests/cases/production.yaml"]
print(json.dumps({"skill": "report-style", "version": 1,
  "files": {f: hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest() for f in files}},
  indent=1, sort_keys=True))
PY
```

A lock that no longer matches is the signal that a trial must be re-run, not that the lock should be
edited. Change rows go in `CHANGELOG.md` with the finding that caused them.
