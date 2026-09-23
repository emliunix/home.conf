# report-style — changelog

One row per change: date, what changed, the finding that caused it, and the record that showed it. Records
live in `visflow/worklog/report-style-review/` and, for the trials, `visflow/worklog/report-style-trials/`.

| date | version | change | finding | record |
|---|---|---|---|---|
| 2026-09-19 | v0 | created: the two shapes, the one warrant rule, Variant A's order and legend, Variant B's nine elements | — | — |
| 2026-09-20 | v1 | − the *"durable artifact"* premise from the description; − the Order section and the Checklist section (each restated material already present); the two variants stated under one rule | the premise made the **brief** read as a fallback for the record, when the brief is the common case in chat; the cut sections were the skill's own subtraction rule applied to itself | commit `5e6e296` |
| 2026-09-20 | v1 + furniture | tests added: `DESIGN.md` (r2), `rubric.yaml`, `cases/trigger.yaml`, `cases/production.yaml`, `frozen.lock.json`; this file and `README.md` | round-1 design review (two seats, ten findings, all reproduced): the oracle was unscoreable as specified and the pinned source set was overstated | `worklog/report-style-review/round-1-adjudication.md` |
| 2026-09-20 | v1 + trigger fix | + *"not for reviewing someone else's report"* to the description; + `tests/l0.py`, the landing check the design promised but had not shipped; `trigger.yaml` and `DESIGN.md` updated where they called the exclusion *conditional* | trigger trial, two routes: prose polish stayed silent on both, but **the review case fired `visflow-evaluate` on route 2 and stayed silent on route 1**, so the exclusion was incidental rather than explicit. **No `disable-model-invocation` added** — the defect was a missing clause, not excessive visibility | `worklog/report-style-trials/round-1.md` |
| 2026-09-23 | v2 | separated report **kind** from report **shape**; added a reader-question catalog and seven kind-specific reference files; scoped work chronology to cases where process, causality, migration, or present status is the subject | a domain-change report was first organized as an execution ledger and then over-corrected into a feature list; both failures came from treating one outline as universal instead of selecting the reader's question | task-svc `worklog/domain-model-and-policy-changes-2026-09-23.md` and the 2026-09-23 owner corrections |

**Open at v1:** the production/induction claim is **not established** — Batch 2's task said *"write the
brief"*, the skill's own noun, and the control arm produced all nine elements and all four boundary classes
unaided, so the structural items passed for it too; the full arm was also 438 words longer with no
mechanical warrant gain. The named follow-up is the trigger set's paraphrase, which states the need without
the vocabulary. The `SKILL.md:102` boundary clause is **unpriced** (the ablation changed nothing, and the
`closing_boundary_heading` probe was mis-specified for run-in bold), not proven decoration. Details:
`worklog/report-style-trials/round-1.md`.

**Confirmed 2026-09-20:** the review clause works — route 2, which fired `visflow-evaluate` before the
edit, now returns `none`. **Still open:** `T2` (already-enumerated evidence) stays silent on route 1 but is
attracted on route 2 by `visflow-records`, whose description positively claims *"adding a record to one"*.
That is a **catalog collision on the word "record"**, not a defect in this skill's description — it names
the exclusion and the model quotes it before routing away — so the fix, if any, belongs in
`visflow-records`' entry surface.

**Open at v2:** the kind router and chronology filter have smoke coverage but have not yet
passed a blinded production trial. The v1 production result therefore remains the last behavioral
measurement; do not refresh `tests/frozen.lock.json` until the v2 routing and chronology cases are run.
