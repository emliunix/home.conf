# records — design philosophy and dimensions

**What it is.** Convention over configuration for a repository's experiment records: a reader enumerates what a programme has run by naming, checks it against the commits, and adds a record in four fixed steps. `SKILL.md` is the artifact; this package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **The convention is the contract.** Records are named so that `ls` enumerates them; a manifest is a convenience on top.
2. **The commits win.** When a collected list and the commits disagree, the commits decide and the disagreement is a finding.
3. **Generated means regenerated, in the same commit** as the evidence it reads; a page that looks generated but is not is a known trap.
4. **One decision row per landed unit**, so the record of why travels with the record of what.
5. **Names carry dates; living documents keep theirs.** Forward-only, and checked by a script, because a rule with no check is speculation.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire on finding or adding a record, and stay silent on trusting the manifest or hand-writing a generated page? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an agent enumerate by convention, check against the commits, and add a record in the four steps in order? | entry-only vs full arm on the same request; the trajectory and the commit are checked |
| **production** | does the produced commit carry the file, its index row, the regenerated pages and the pinned counts together, and do the checks pass? | the repository's own tests and the worklog name checker are run on the commit |
| **ablation** | does each step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

Trusting the manifest over the commits; hand-writing a page a script generates; reconciling a mismatch silently; renaming old records to fit a new convention.
