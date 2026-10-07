# adversarial-evaluate — changelog

One row per change: date, what changed, the finding that caused it, and the record that showed it.

| date | version | change | finding | record |
|---|---|---|---|---|
| 2026-10-05 | v3 | consolidated from `visflow-evaluate` (v2): description and steps generalised (model-route table, prompts directory and verdict file given as roles); the exemplar that seated a model with defects in the range became an explicit exclusion in step 2; the cases table keeps the subjects, and the evidence column (what each cited artifact actually is) moved to a labelled *Worked instances (visflow)* subsection; *Project binding* added; the `record` dimension renamed `production` and an `ablation` dimension added so the package carries the four standard dimensions plus `coverage`. History of v0-v2 is in the `visflow-evaluate` package at the commit before this one | the project-specific skills could not be used in any other repository run the same way | the C1 skills-consolidation brief (2026-10-05, branch `skills/consolidate`) |
| 2026-10-07 | v2 | "Worked instances" no longer names a project: the heading drops "(visflow)" and project paths and names become roles; no rule changed | home.conf must not depend on a consumer project (owner, 2026-10-07) | lock moved without a new trial (wording only) |

**Carried from v2, still queued** (entry-surface change → needs a trigger run, not a reading): add the two
missing case kinds (a tree record, a round verdict) to the `description`.

**Still shipped without case files, deliberately:** `procedure`, `coverage` and `production` name arms but ship
no cases, so those arms will invent theirs.
