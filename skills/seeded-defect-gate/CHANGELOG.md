# seeded-defect-gate — changelog

One row per change: date, what changed, the finding that caused it, and the record that showed it.

| date | version | change | finding | record |
|---|---|---|---|---|
| 2026-10-05 | v1 | consolidated from `visflow-gate`: description and steps generalised, step 3 gains the restore-to-green half the rubric already scored (`R-RESTORE`), a wrong-reason flip routed to `finding-triage`, the boundary between this skill and `verification` stated, the visflow ledgers moved to a labelled *Worked instances* subsection, *Project binding* added | the project-specific skills could not be used in any other repository run the same way | the C1 skills-consolidation brief (2026-10-05, branch `skills/consolidate`) |
| 2026-10-05 | v1.1 | renamed from `gate` to `seeded-defect-gate`: directory, frontmatter, `skill:` fields, trigger expectations, lock and every cross-reference | owner review: `gate` is too general as a skill name | the C1 skills-consolidation brief, rename follow-up (2026-10-05, branch `skills/consolidate`) |
| 2026-10-07 | v2 | "Worked instances" no longer names a project: the heading drops "(visflow)" and project paths and names become roles; no rule changed | home.conf must not depend on a consumer project (owner, 2026-10-07) | lock moved without a new trial (wording only) |
