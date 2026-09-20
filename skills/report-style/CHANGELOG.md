# report-style — changelog

One row per change: date, what changed, the finding that caused it, and the record that showed it. Records
live in `visflow/worklog/report-style-review/` and, for the trials, `visflow/worklog/report-style-trials/`.

| date | version | change | finding | record |
|---|---|---|---|---|
| 2026-09-19 | v0 | created: the two shapes, the one warrant rule, Variant A's order and legend, Variant B's nine elements | — | — |
| 2026-09-20 | v1 | − the *"durable artifact"* premise from the description; − the Order section and the Checklist section (each restated material already present); the two variants stated under one rule | the premise made the **brief** read as a fallback for the record, when the brief is the common case in chat; the cut sections were the skill's own subtraction rule applied to itself | commit `5e6e296` |
| 2026-09-20 | v1 + furniture | tests added: `DESIGN.md` (r2), `rubric.yaml`, `cases/trigger.yaml`, `cases/production.yaml`, `frozen.lock.json`; this file and `README.md` | round-1 design review (two seats, ten findings, all reproduced): the oracle was unscoreable as specified and the pinned source set was overstated | `worklog/report-style-review/round-1-adjudication.md` |
| 2026-09-20 | v1 + trigger fix | + *"not for reviewing someone else's report"* to the description; + `tests/l0.py`, the landing check the design promised but had not shipped; `trigger.yaml` and `DESIGN.md` updated where they called the exclusion *conditional* | trigger trial, two routes: prose polish stayed silent on both, but **the review case fired `visflow-evaluate` on route 2 and stayed silent on route 1**, so the exclusion was incidental rather than explicit. **No `disable-model-invocation` added** — the defect was a missing clause, not excessive visibility | `worklog/report-style-trials/round-1.md` |

**Open at v1:** the production/induction claim is **not established** — Batch 2's task said *"write the
brief"*, the skill's own noun, and the control arm produced all nine elements and all four boundary classes
unaided, so the structural items passed for it too; the full arm was also 438 words longer with no
mechanical warrant gain. The named follow-up is the trigger set's paraphrase, which states the need without
the vocabulary. The `SKILL.md:102` boundary clause is **unpriced** (the ablation changed nothing, and the
`closing_boundary_heading` probe was mis-specified for run-in bold), not proven decoration. The review trap
is re-run on both routes to confirm the new clause. Details: `worklog/report-style-trials/round-1.md`.
